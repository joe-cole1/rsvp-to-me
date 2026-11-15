// #850 root causes: the public feed lacked publication/date/privacy gates;
// PostgreSQL search was case-sensitive; uploads lacked accounting/cleanup;
// hosts had no comment removal; tombstoning left event-owned rows behind.
import "@/tests/helpers/english-request-locale";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, mkdir, readFile, rm, readdir } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { db, truncateAll } from "@/tests/integration/helpers/db";
import { getUpcomingPublicEvents } from "@/lib/public-events";
import { getAdminUsers, getAdminEvents, deleteEventAdmin } from "@/app/actions/admin";
import { deleteComment } from "@/app/actions/event/comments";
import { saveCoverImage, removeCoverImage, deleteEvent } from "@/app/actions/event/settings";
import { updateProfileSettings } from "@/app/actions/profile";
import { performImmediateUserDeletion } from "@/lib/account-deletion";
import { storeUpload, deleteUnusedUpload, withUploadLock, UPLOAD_QUOTA_BYTES } from "@/lib/uploads";
import type { Prisma } from "@/app/generated/prisma/client";
const m = vi.hoisted(() => ({
  session: null as { userId: string; email: string; role: "HOST" | "GUEST" | "ADMIN" } | null,
}));
vi.mock("@/lib/session", () => ({
  getSession: async () => m.session,
  revokeUserSessions: async () => {},
  invalidateUserSessions: async () => {},
}));
vi.mock("@/lib/session-user", () => ({
  getSessionUser: async () => (m.session ? { id: m.session.userId } : null),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/captcha", () => ({ assertCaptcha: async () => {} }));
let root: string;
let host: { id: string; email: string | null };
const now = new Date("2030-01-01T12:00:00Z");
beforeEach(async () => {
  await truncateAll();
  host = await db.user.create({
    data: { name: "MiXeD Host", email: "mixed@example.test", role: "HOST" },
  });
  m.session = { userId: host.id, email: host.email!, role: "HOST" };
  root = await mkdtemp("/tmp/rsvp-850-integration-");
  await mkdir(path.join(root, "data/uploads"), { recursive: true });
  vi.spyOn(process, "cwd").mockReturnValue(root);
});
afterEach(async () => {
  vi.restoreAllMocks();
  await rm(root, { recursive: true, force: true });
});
function event(data: Partial<Prisma.EventUncheckedCreateInput> = {}) {
  return db.event.create({
    data: {
      hostId: host.id,
      slug: randomUUID(),
      title: "MiXeD Party",
      startAt: new Date(now.getTime() + 60000),
      status: "PUBLISHED",
      visibility: "PUBLIC",
      ...data,
    },
  });
}
async function image() {
  const filename = `${randomUUID()}.png`;
  await storeUpload(host.id, filename, Buffer.from("fixture image"));
  return {
    filename,
    url: `/api/uploads/${filename}`,
    file: path.join(root, "data/uploads", filename),
  };
}
async function comment(eventId: string, parentId?: string) {
  return db.comment.create({ data: { eventId, parentId, guestName: "Guest", body: "A comment" } });
}
describe("#850 public feed", () => {
  it("excludes past/current, draft, cancelled, deleted, private, unlisted and password events before limiting", async () => {
    for (const data of [
      { startAt: new Date(now.getTime() - 1) },
      { startAt: now },
      { status: "DRAFT" },
      { status: "CANCELLED" },
      { status: "DELETED" },
      { visibility: "PRIVATE" },
      { visibility: "UNLISTED" },
      { passwordHash: "protected" },
    ] as Partial<Prisma.EventUncheckedCreateInput>[])
      await event(data);
    const later = await event({ startAt: new Date(now.getTime() + 120000) });
    const sooner = await event();
    expect((await getUpcomingPublicEvents(now)).map((e) => e.id)).toEqual([sooner.id, later.id]);
  });
  it("honors hidden/capped counts, guest-list access, disabled comments and approval", async () => {
    const capped = await event({ guestGoingCount: "CAPPED" });
    const hidden = await event({ guestGoingCount: "HIDDEN" });
    const hostOnly = await event({ guestListVis: "HOST_ONLY", commentsEnabled: false });
    const guestsOnly = await event({ guestListVis: "GUESTS_ONLY" });
    for (const target of [capped, hidden, hostOnly, guestsOnly]) {
      await db.rSVP.createMany({
        data: Array.from({ length: 5 }, (_, i) => ({
          eventId: target.id,
          guestName: String(i),
          status: "GOING" as const,
          approved: true,
        })),
      });
      await comment(target.id);
    }
    const exact = await event();
    await db.rSVP.createMany({
      data: [
        { eventId: exact.id, guestName: "Approved", status: "GOING", approved: true },
        { eventId: exact.id, guestName: "Pending", status: "GOING", approved: false },
        { eventId: exact.id, guestName: "Maybe", status: "MAYBE", approved: true },
      ],
    });
    const events = await getUpcomingPublicEvents(now);
    expect(events.find((e) => e.id === capped.id)?.goingLabel).toBe("3+");
    expect(events.find((e) => e.id === exact.id)?.goingLabel).toBe("1");
    for (const target of [hidden, hostOnly, guestsOnly])
      expect(events.find((e) => e.id === target.id)?.goingLabel).toBeNull();
    expect(events.find((e) => e.id === hostOnly.id)?.commentCount).toBe(0);
    expect(events.find((e) => e.id === capped.id)?.commentCount).toBe(1);
  });
  it("returns the next 20 events even when many older ones exist", async () => {
    for (let i = 0; i < 22; i++) await event({ startAt: new Date(now.getTime() + (i - 1) * 1000) });
    const result = await getUpcomingPublicEvents(now);
    expect(result).toHaveLength(20);
    expect(result[0].startAt.getTime()).toBe(now.getTime() + 1000);
  });
});
describe("#850 admin search against PostgreSQL", () => {
  it("finds mixed-case names, titles and host details, and filters before pagination", async () => {
    m.session!.role = "ADMIN";
    await event({ title: "Birthday Party" });
    for (let i = 0; i < 28; i++)
      await db.user.create({
        data: { name: `Guest ${i}`, email: `guest${i}@example.test`, role: "GUEST" },
      });
    expect((await getAdminUsers("mixed")).items.map((u) => u.id)).toEqual([host.id]);
    expect((await getAdminEvents("BIRTHDAY")).items).toHaveLength(1);
    expect((await getAdminEvents("mixed HOST")).items).toHaveLength(1);
    const first = await getAdminUsers("", 1, { role: "GUEST", status: "ACTIVE" });
    const second = await getAdminUsers("", 2, { role: "GUEST", status: "ACTIVE" });
    expect(first.items).toHaveLength(25);
    expect(first.hasMore).toBe(true);
    expect(second.items).toHaveLength(3);
    expect(second.hasMore).toBe(false);
    expect(new Set([...first.items, ...second.items].map((u) => u.id)).size).toBe(28);
    expect(
      (await getAdminUsers("", 1, { role: "HOST", status: "ACTIVE" })).items.map((u) => u.id)
    ).toEqual([host.id]);
  });
});
describe("#850 upload concurrency and lifecycle", () => {
  it("serializes concurrent uploads so only one can consume the remaining quota", async () => {
    await db.upload.create({
      data: { filename: `${randomUUID()}.png`, ownerId: host.id, bytes: UPLOAD_QUOTA_BYTES - 3 },
    });
    const results = await Promise.allSettled([
      storeUpload(host.id, `${randomUUID()}.png`, Buffer.from("abc")),
      storeUpload(host.id, `${randomUUID()}.png`, Buffer.from("def")),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((r) => r.status === "rejected")).toHaveLength(1);
    expect(
      (await db.upload.aggregate({ where: { ownerId: host.id }, _sum: { bytes: true } }))._sum.bytes
    ).toBe(UPLOAD_QUOTA_BYTES);
    expect(await readdir(path.join(root, "data/uploads"))).toHaveLength(1);
  });
  it("waits for an in-flight assignment and preserves the committed reference", async () => {
    const upload = await image();
    const target = await event();
    let release!: () => void;
    let ready!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const acquired = new Promise<void>((resolve) => {
      ready = resolve;
    });
    const assignment = withUploadLock(async (tx) => {
      await tx.eventTheme.create({ data: { eventId: target.id, coverImageUrl: upload.url } });
      ready();
      await gate;
    });
    await acquired;
    const cleanup = deleteUnusedUpload(upload.url);
    release();
    await assignment;
    await cleanup;
    expect(await readFile(upload.file, "utf8")).toBe("fixture image");
  });
  it("releases replaced covers and avatars, preserving shared files until the last reference goes", async () => {
    const target = await event();
    const first = await image();
    const second = await image();
    await saveCoverImage(target.id, first.url);
    await updateProfileSettings({ name: "Host", avatarUrl: first.url });
    await saveCoverImage(target.id, second.url);
    expect(await readFile(first.file, "utf8")).toBe("fixture image");
    await updateProfileSettings({ name: "Host", avatarUrl: null });
    await expect(readFile(first.file)).rejects.toMatchObject({ code: "ENOENT" });
    await removeCoverImage(target.id);
    await expect(readFile(second.file)).rejects.toMatchObject({ code: "ENOENT" });
    expect(await db.upload.count()).toBe(0);
  });
  it("removes account avatars and unattached uploads while retaining hosted-event covers", async () => {
    await db.user.create({ data: { id: "system", name: "System", role: "GUEST" } });
    const avatar = await image();
    const cover = await image();
    const abandoned = await image();
    const target = await event();
    await db.user.update({ where: { id: host.id }, data: { avatarUrl: avatar.url } });
    await db.eventTheme.create({ data: { eventId: target.id, coverImageUrl: cover.url } });
    await performImmediateUserDeletion(host.id);
    await expect(readFile(avatar.file)).rejects.toMatchObject({ code: "ENOENT" });
    await expect(readFile(abandoned.file)).rejects.toMatchObject({ code: "ENOENT" });
    expect(await readFile(cover.file, "utf8")).toBe("fixture image");
    expect(
      (await db.upload.findUniqueOrThrow({ where: { filename: cover.filename } })).ownerId
    ).toBeNull();
    expect((await db.event.findUniqueOrThrow({ where: { id: target.id } })).hostId).toBe("system");
  });
});
describe("#850 organizer comment removal", () => {
  it("removes a whole thread, or just one reply, and is idempotent", async () => {
    const target = await event();
    const parent = await comment(target.id);
    const reply = await comment(target.id, parent.id);
    const nested = await comment(target.id, reply.id);
    const sibling = await comment(target.id, parent.id);
    expect(new Set((await deleteComment(target.id, reply.id)).removedIds)).toEqual(
      new Set([reply.id, nested.id])
    );
    expect(await db.comment.count({ where: { eventId: target.id } })).toBe(2);
    expect(new Set((await deleteComment(target.id, parent.id)).removedIds)).toEqual(
      new Set([parent.id, sibling.id])
    );
    expect((await deleteComment(target.id, parent.id)).removedIds).toEqual([]);
  });
  it("rejects anonymous/guest/unrelated hosts and cross-event ids; allows co-hosts and admins", async () => {
    const target = await event();
    const other = await event();
    const parent = await comment(target.id);
    const stranger = await db.user.create({
      data: { email: "stranger@example.test", role: "HOST" },
    });
    const organizer = m.session;
    for (const session of [
      null,
      { userId: stranger.id, email: stranger.email!, role: "GUEST" as const },
      { userId: stranger.id, email: stranger.email!, role: "HOST" as const },
    ]) {
      m.session = session;
      await expect(deleteComment(target.id, parent.id)).rejects.toThrow();
    }
    m.session = organizer;
    expect((await deleteComment(other.id, parent.id)).removedIds).toEqual([]);
    await db.eventCoHost.create({ data: { eventId: target.id, userId: stranger.id } });
    m.session = { userId: stranger.id, email: stranger.email!, role: "HOST" };
    expect((await deleteComment(target.id, parent.id)).removedIds).toEqual([parent.id]);
    const another = await comment(target.id);
    m.session = { ...m.session, role: "ADMIN" };
    expect((await deleteComment(target.id, another.id)).removedIds).toEqual([another.id]);
  });
});
describe("#850 event deletion", () => {
  it("tombstones the event and deletes remaining event-owned rows and cover files", async () => {
    const target = await event();
    const other = await event();
    const upload = await image();
    await db.eventTheme.create({ data: { eventId: target.id, coverImageUrl: upload.url } });
    await db.eventTheme.create({ data: { eventId: other.id } });
    await db.coHostInvitation.create({
      data: {
        eventId: target.id,
        email: "cohost@example.test",
        token: randomUUID(),
        expiresAt: new Date("2099-01-01"),
      },
    });
    await db.rSVPField.create({ data: { eventId: target.id, label: "Food?", fieldType: "TEXT" } });
    await db.eventReminderSettings.create({ data: { eventId: target.id } });
    const parent = await comment(target.id);
    await comment(target.id, parent.id);
    await deleteEvent(target.id);
    expect((await db.event.findUniqueOrThrow({ where: { id: target.id } })).status).toBe("DELETED");
    expect(await db.coHostInvitation.count({ where: { eventId: target.id } })).toBe(0);
    expect(await db.rSVPField.count({ where: { eventId: target.id } })).toBe(0);
    expect(await db.eventReminderSettings.count({ where: { eventId: target.id } })).toBe(0);
    expect(await db.eventTheme.count({ where: { eventId: target.id } })).toBe(0);
    expect(await db.comment.count({ where: { eventId: target.id } })).toBe(0);
    expect(await db.eventTheme.count({ where: { eventId: other.id } })).toBe(1);
    await expect(readFile(upload.file)).rejects.toMatchObject({ code: "ENOENT" });
  });
  it("also releases covers on administrator hard deletion", async () => {
    const target = await event();
    const upload = await image();
    await db.eventTheme.create({ data: { eventId: target.id, coverImageUrl: upload.url } });
    m.session!.role = "ADMIN";
    await deleteEventAdmin(target.id);
    expect(await db.event.findUnique({ where: { id: target.id } })).toBeNull();
    await expect(readFile(upload.file)).rejects.toMatchObject({ code: "ENOENT" });
  });
});
