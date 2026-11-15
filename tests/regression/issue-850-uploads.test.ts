// #850 root cause: upload bytes had no owner/quota and removing references never
// unlinked files. Exercise real files, including legacy/shared/abandoned uploads.
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, mkdir, readFile, writeFile, rm, utimes, symlink, unlink } from "fs/promises";
import { randomUUID } from "crypto";
import path from "path";
const m = vi.hoisted(() => ({
  lock: vi.fn(),
  aggregate: vi.fn(),
  create: vi.fn(),
  deleteMany: vi.fn(),
  covers: vi.fn(),
  avatars: vi.fn(),
  findMany: vi.fn(),
  updateMany: vi.fn(),
}));
vi.mock("@/lib/db", () => {
  const tx = {
    $executeRaw: m.lock,
    upload: { aggregate: m.aggregate, create: m.create, deleteMany: m.deleteMany },
    eventTheme: { count: m.covers },
    user: { count: m.avatars },
  };
  return {
    db: {
      ...tx,
      $transaction: async (fn: (client: typeof tx) => unknown) => fn(tx),
      upload: { ...tx.upload, findMany: m.findMany, updateMany: m.updateMany },
    },
  };
});
vi.mock("fs/promises", async (original) => {
  const actual = await original<typeof import("fs/promises")>();
  return { ...actual, unlink: vi.fn(actual.unlink) };
});
import {
  storeUpload,
  deleteUnusedUpload,
  releaseUpload,
  cleanupOrphanedUploads,
  assertUploadExists,
  releaseAccountUploads,
  UPLOAD_GRACE_MS,
  UPLOAD_QUOTA_BYTES,
  UploadQuotaError,
} from "@/lib/uploads";
let root: string;
let filename: string;
let file: string;
let url: string;
beforeEach(async () => {
  vi.clearAllMocks();
  m.aggregate.mockResolvedValue({ _sum: { bytes: 0 } });
  m.create.mockResolvedValue({});
  m.deleteMany.mockResolvedValue({ count: 1 });
  m.covers.mockResolvedValue(0);
  m.avatars.mockResolvedValue(0);
  m.findMany.mockResolvedValue([]);
  m.updateMany.mockResolvedValue({ count: 1 });
  root = await mkdtemp("/tmp/rsvp-850-unit-");
  await mkdir(path.join(root, "data/uploads"), { recursive: true });
  vi.spyOn(process, "cwd").mockReturnValue(root);
  filename = `${randomUUID()}.png`;
  file = path.join(root, "data/uploads", filename);
  url = `/api/uploads/${filename}`;
});
afterEach(async () => {
  vi.restoreAllMocks();
  await rm(root, { recursive: true, force: true });
});
async function oldFile() {
  await writeFile(file, "image");
  const old = new Date(Date.now() - UPLOAD_GRACE_MS - 60000);
  await utimes(file, old, old);
}
describe("#850 upload lifecycle", () => {
  it("writes and accounts validated uploads within the quota, under the shared lock", async () => {
    await storeUpload("host", filename, Buffer.from("image"));
    expect(await readFile(file, "utf8")).toBe("image");
    expect(m.lock).toHaveBeenCalled();
    expect(m.create).toHaveBeenCalledWith({ data: { filename, ownerId: "host", bytes: 5 } });
    await assertUploadExists(url);
  });
  it("allows the exact quota boundary and refuses the next byte before writing", async () => {
    m.aggregate.mockResolvedValue({ _sum: { bytes: UPLOAD_QUOTA_BYTES - 5 } });
    await storeUpload("host", filename, Buffer.from("image"));
    m.aggregate.mockResolvedValue({ _sum: { bytes: UPLOAD_QUOTA_BYTES } });
    await expect(
      storeUpload("host", `${randomUUID()}.jpg`, Buffer.from("x"))
    ).rejects.toBeInstanceOf(UploadQuotaError);
    expect(m.create).toHaveBeenCalledTimes(1);
  });
  it("rolls back the file when accounting fails, and never overwrites an existing file", async () => {
    m.create.mockRejectedValueOnce(new Error("database unavailable"));
    await expect(storeUpload("host", filename, Buffer.from("image"))).rejects.toThrow(
      "database unavailable"
    );
    await expect(readFile(file)).rejects.toMatchObject({ code: "ENOENT" });
    await writeFile(file, "original");
    await expect(storeUpload("host", filename, Buffer.from("replacement"))).rejects.toMatchObject({
      code: "EEXIST",
    });
    expect(await readFile(file, "utf8")).toBe("original");
  });
  it.each(["cover", "avatar"])("retains files still referenced by another %s", async (kind) => {
    await oldFile();
    (kind === "cover" ? m.covers : m.avatars).mockResolvedValue(1);
    await deleteUnusedUpload(url);
    expect(await readFile(file, "utf8")).toBe("image");
    expect(m.deleteMany).not.toHaveBeenCalled();
  });
  it("unlinks unreferenced files and frees their quota", async () => {
    await writeFile(file, "image");
    // Immediate release has no grace period, even with clock skew or a
    // filesystem timestamp fractionally ahead of Date.now().
    const future = new Date(Date.now() + 60000);
    await utimes(file, future, future);
    await deleteUnusedUpload(url);
    await expect(readFile(file)).rejects.toMatchObject({ code: "ENOENT" });
    expect(m.deleteMany).toHaveBeenCalledWith({ where: { filename } });
  });
  it("removes abandoned legacy files only after the grace period and ignores unrelated files and symlinks", async () => {
    await oldFile();
    const pending = `${randomUUID()}.png`;
    await writeFile(path.join(root, "data/uploads", pending), "pending");
    await writeFile(path.join(root, "data/uploads/keep.txt"), "keep");
    const link = `${randomUUID()}.png`;
    await symlink(file, path.join(root, "data/uploads", link));
    await cleanupOrphanedUploads();
    await expect(readFile(file)).rejects.toMatchObject({ code: "ENOENT" });
    expect(await readFile(path.join(root, "data/uploads", pending), "utf8")).toBe("pending");
    expect(await readFile(path.join(root, "data/uploads/keep.txt"), "utf8")).toBe("keep");
    await expect(assertUploadExists(`/api/uploads/${link}`)).rejects.toBeDefined();
  });
  it("recovers rows for missing files, and tolerates an absent upload directory", async () => {
    m.findMany.mockResolvedValue([{ filename }]);
    await rm(path.join(root, "data/uploads"), { recursive: true });
    await cleanupOrphanedUploads();
    expect(m.deleteMany).toHaveBeenCalledWith({ where: { filename } });
  });
  it("rejects traversal and does not delete non-application paths", async () => {
    await expect(assertUploadExists("/api/uploads/../secret")).rejects.toThrow();
    await expect(storeUpload("host", "../secret", Buffer.from("x"))).rejects.toThrow();
    await deleteUnusedUpload("/api/uploads/../secret");
    expect(m.lock).not.toHaveBeenCalled();
  });
  it("reports deletion failures safely for scheduled retry", async () => {
    await writeFile(file, "image");
    vi.mocked(unlink).mockRejectedValueOnce(new Error("unlink failed"));
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
    await releaseUpload(url);
    expect(warning).toHaveBeenCalled();
    expect(m.deleteMany).not.toHaveBeenCalled();
    expect(await readFile(file, "utf8")).toBe("image");
  });
  it("releases account uploads but retains shared covers and detaches ownership", async () => {
    await oldFile();
    m.findMany.mockResolvedValue([{ filename }]);
    m.covers.mockResolvedValue(1);
    await releaseAccountUploads("host");
    expect(await readFile(file, "utf8")).toBe("image");
    expect(m.updateMany).toHaveBeenCalledWith({
      where: { ownerId: "host" },
      data: { ownerId: null },
    });
  });
});
