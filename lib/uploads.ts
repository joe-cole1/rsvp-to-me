import "server-only";

import { mkdir, writeFile, unlink, lstat, opendir } from "fs/promises";
import path from "path";
import { db } from "./db";
import type { Prisma } from "@/app/generated/prisma/client";
import { safeUploadPath } from "./upload-path";
import { logSafe } from "./logger";

export const UPLOAD_QUOTA_BYTES = 100 * 1024 * 1024;
export const UPLOAD_GRACE_MS = 24 * 60 * 60 * 1000;
const directory = () => path.join(process.cwd(), "data", "uploads");

export class UploadQuotaError extends Error {
  constructor() {
    super("Upload storage limit reached (100 MiB per account). Remove an unused image first.");
  }
}

// Assignment and garbage collection use the same database lock, including when
// Redis is unavailable or multiple application processes share the upload mount.
export function withUploadLock<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  return db.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(850, 1)`;
      return fn(tx);
    },
    { maxWait: 10000, timeout: 15000 }
  );
}

function filenameFor(url: string): string {
  if (!safeUploadPath(url)) throw new Error("Choose an uploaded image.");
  return url.slice("/api/uploads/".length);
}

export async function assertUploadExists(url: string): Promise<void> {
  const stat = await lstat(path.join(directory(), filenameFor(url)));
  if (!stat.isFile()) throw new Error("Choose an uploaded image.");
}

export async function storeUpload(ownerId: string, filename: string, buffer: Buffer) {
  filenameFor(`/api/uploads/${filename}`);
  let written = false;
  try {
    await withUploadLock(async (tx) => {
      const used = await tx.upload.aggregate({ where: { ownerId }, _sum: { bytes: true } });
      if ((used._sum.bytes ?? 0) + buffer.length > UPLOAD_QUOTA_BYTES) throw new UploadQuotaError();
      await mkdir(directory(), { recursive: true });
      await writeFile(path.join(directory(), filename), buffer, { flag: "wx" });
      written = true;
      await tx.upload.create({ data: { filename, ownerId, bytes: buffer.length } });
    });
  } catch (error) {
    // The URL has not been returned, so nobody can have assigned this new file.
    if (written) await unlink(path.join(directory(), filename)).catch(logSafe("upload:rollback"));
    throw error;
  }
}

function isMissing(error: unknown): boolean {
  return !!error && typeof error === "object" && "code" in error && error.code === "ENOENT";
}

export async function deleteUnusedUpload(url: string | null | undefined, minimumAgeMs = 0) {
  if (!safeUploadPath(url)) return;
  const filename = filenameFor(url!);
  await withUploadLock(async (tx) => {
    // A cover can be shared by several events or also used as an avatar.
    if (await tx.eventTheme.count({ where: { coverImageUrl: url } })) return;
    if (await tx.user.count({ where: { avatarUrl: url } })) return;
    try {
      const stat = await lstat(path.join(directory(), filename));
      if (!stat.isFile() || (minimumAgeMs > 0 && Date.now() - stat.mtimeMs < minimumAgeMs)) return;
      await unlink(path.join(directory(), filename));
    } catch (error) {
      if (!isMissing(error)) throw error;
    }
    // If the transaction fails after unlink, the next sweep retries this row.
    await tx.upload.deleteMany({ where: { filename } });
  });
}

// Best effort after a committed reference change; scheduled GC retries failures.
export async function releaseUpload(url: string | null | undefined) {
  await deleteUnusedUpload(url).catch(logSafe("upload:release"));
}

export async function cleanupOrphanedUploads() {
  try {
    const entries = await opendir(directory());
    for await (const entry of entries) {
      if (entry.isFile()) {
        await deleteUnusedUpload(`/api/uploads/${entry.name}`, UPLOAD_GRACE_MS);
      }
    }
  } catch (error) {
    if (!isMissing(error)) throw error;
  }
  // Also recover quota for tracked files removed outside the application.
  const records = await db.upload.findMany({
    where: { createdAt: { lt: new Date(Date.now() - UPLOAD_GRACE_MS) } },
    select: { filename: true },
  });
  for (const record of records) {
    await deleteUnusedUpload(`/api/uploads/${record.filename}`, UPLOAD_GRACE_MS);
  }
}

export async function releaseAccountUploads(userId: string) {
  const uploads = await db.upload.findMany({
    where: { ownerId: userId },
    select: { filename: true },
  });
  for (const upload of uploads) await releaseUpload(`/api/uploads/${upload.filename}`);
  // Covers of retained events stay available without retaining account ownership.
  await db.upload.updateMany({ where: { ownerId: userId }, data: { ownerId: null } });
}
