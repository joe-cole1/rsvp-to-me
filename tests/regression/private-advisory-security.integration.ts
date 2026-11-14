// Root causes: cache-only sessions survived deletion; display names acted as
// participation identities; check-then-write paths raced; email links granted
// authority before proof. These tests use real PostgreSQL and Redis.
import "@/tests/helpers/english-request-locale";
import { beforeEach, afterAll, describe, expect, it, vi } from "vitest";
import { db, truncateAll } from "../integration/helpers/db";
const jar = vi.hoisted(() => new Map<string, string>());
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (key: string) => (jar.has(key) ? { value: jar.get(key) } : undefined),
    set: (key: string, value: string) => jar.set(key, value),
    delete: (key: string) => jar.delete(key),
  }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw new Error(`redirect:${path}`);
  },
}));
vi.mock("@/lib/captcha", () => ({ assertCaptcha: vi.fn() }));
vi.mock("@/lib/rateLimit", () => ({ rateLimit: async () => ({ success: true }) }));
import { createSession, getSession, revokeUserSessions, COOKIE_NAME } from "@/lib/session";
import { getRedisClient, redisGet, redisSet } from "@/lib/redis";
import { performImmediateUserDeletion, scheduleUserDeletion } from "@/lib/account-deletion";
import { registerHost, verifyMagicToken, verifySignInCode, verifyChangeToken } from "@/lib/auth";
import { castVote, deletePollOption } from "@/app/actions/event/polls";
import { claimPotluckItem, unclaimPotluckItem } from "@/app/actions/event/potluck";
import { acceptCoHost } from "@/app/auth/accept-cohost/actions";
import { readFileSync } from "node:fs";
import { reorderInfoSections } from "@/app/actions/event/infoSections";
import { hashToken } from "@/lib/hash";

beforeEach(async () => {
  jar.clear();
  await truncateAll();
});
afterAll(async () => {
  const redis = await getRedisClient();
  if (redis?.isOpen) await redis.quit();
});
async function account(role: "ADMIN" | "HOST" | "GUEST" = "HOST") {
  const user = await db.user.create({
    data: { email: `${role.toLowerCase()}@example.test`, role, name: "Original" },
  });
  await createSession({ userId: user.id, email: user.email!, role });
  return user;
}
async function event() {
  const host = await account();
  const event = await db.event.create({
    data: {
      title: "Event",
      slug: "event",
      hostId: host.id,
      startAt: new Date(Date.now() + 86400000),
      status: "PUBLISHED",
    },
  });
  return { event, host };
}
async function guests(eventId: string) {
  return Promise.all(
    [1, 2].map(() =>
      db.rSVP.create({ data: { eventId, guestName: "Same name", status: "GOING", approved: true } })
    )
  );
}

describe("session revocation with real Redis", () => {
  it("removes all cached sessions and never trusts a stale fill after revocation", async () => {
    const user = await account("ADMIN");
    const firstCookie = jar.get(COOKIE_NAME)!;
    const first = await getSession();
    expect(first?.role).toBe("ADMIN");
    expect(await redisGet(`session:${first!.sessionId}`)).not.toBeNull();
    await createSession({ userId: user.id, email: user.email!, role: "ADMIN" });
    const second = await getSession();
    await revokeUserSessions(user.id);
    expect(await db.session.count({ where: { userId: user.id } })).toBe(0);
    expect(await redisGet(`session:${first!.sessionId}`)).toBeNull();
    expect(await redisGet(`session:${second!.sessionId}`)).toBeNull();
    await redisSet(
      `session:${first!.sessionId}`,
      JSON.stringify({
        id: first!.sessionId,
        userId: user.id,
        userRole: "ADMIN",
        expiresAt: new Date(Date.now() + 60000).toISOString(),
      }),
      60
    );
    jar.set(COOKIE_NAME, firstCookie);
    expect(await getSession()).toBeNull();
  });
  it("revokes scheduled-deletion sessions while allowing a fresh grace-period sign-in", async () => {
    const user = await account();
    expect((await scheduleUserDeletion(user.id)).success).toBe(true);
    expect(await getSession()).toBeNull();
    await createSession({ userId: user.id, email: user.email!, role: "HOST" });
    expect((await getSession())?.userId).toBe(user.id);
  });
  it("invalidates cached administrator credentials on immediate deletion", async () => {
    const user = await account("ADMIN");
    await performImmediateUserDeletion(user.id);
    expect(await getSession()).toBeNull();
    expect((await db.user.findUniqueOrThrow({ where: { id: user.id } })).role).toBe("GUEST");
  });
  it("reads a demoted role even if Redis still contains ADMIN", async () => {
    const user = await account("ADMIN");
    await db.user.update({ where: { id: user.id }, data: { role: "GUEST" } });
    expect((await getSession())?.role).toBe("GUEST");
  });
});

describe("participation identity and concurrency", () => {
  it("keeps same-name votes separate and rejects options from another poll", async () => {
    const { event: e } = await event();
    const [a, b] = await guests(e.id);
    const poll = await db.poll.create({
      data: {
        eventId: e.id,
        question: "Choose",
        options: { create: [{ text: "A" }, { text: "B" }] },
      },
      include: { options: true },
    });
    const foreign = await db.poll.create({
      data: {
        eventId: e.id,
        question: "Locked",
        locked: true,
        options: { create: { text: "Foreign" } },
      },
      include: { options: true },
    });
    jar.clear();
    await castVote(poll.id, poll.options[0].id, "fake", true, a.editToken);
    await castVote(poll.id, poll.options[0].id, "fake", true, b.editToken);
    expect(await db.pollVote.count()).toBe(2);
    await castVote(poll.id, poll.options[0].id, "fake", false, a.editToken);
    expect((await db.pollVote.findMany()).map((vote) => vote.rsvpId)).toEqual([b.id]);
    await expect(
      castVote(poll.id, foreign.options[0].id, "fake", true, a.editToken)
    ).rejects.toThrow();
    await Promise.all(
      poll.options.map((option) => castVote(poll.id, option.id, "fake", true, a.editToken))
    );
    expect(await db.pollVote.count({ where: { rsvpId: a.id } })).toBe(1);
  });
  it("cannot delete a foreign option through an authorized poll", async () => {
    const { event: e } = await event();
    const own = await db.poll.create({ data: { eventId: e.id, question: "Own" } });
    const foreign = await db.poll.create({
      data: { eventId: e.id, question: "Other", options: { create: { text: "Keep" } } },
      include: { options: true },
    });
    await expect(deletePollOption(own.id, foreign.options[0].id)).rejects.toThrow();
    expect(await db.pollOption.count()).toBe(1);
  });
  it("serializes capacity and removes only the guest's exact claim, even with identical names", async () => {
    const { event: e } = await event();
    const [a, b] = await guests(e.id);
    const item = await db.potluckItem.create({
      data: { eventId: e.id, label: "Food", quantity: 2 },
    });
    jar.clear();
    const [first, second] = await Promise.all(
      [a, b].map((guest) => claimPotluckItem(item.id, "Same name", 1, guest.editToken))
    );
    expect(first.success && second.success).toBe(true);
    expect((await claimPotluckItem(item.id, "Same name", 1, a.editToken)).success).toBe(false);
    expect((await unclaimPotluckItem(item.id, second.claim!.id, a.editToken)).success).toBe(false);
    expect((await unclaimPotluckItem(item.id, first.claim!.id, a.editToken)).success).toBe(true);
    expect((await db.potluckClaim.findMany()).map((claim) => claim.rsvpId)).toEqual([b.id]);
    const results = await Promise.all(
      [a, b].map((guest) => claimPotluckItem(item.id, "Same name", 1, guest.editToken))
    );
    expect(results.filter((result) => result.success)).toHaveLength(1);
    await expect(claimPotluckItem(item.id, "Same name", -1, a.editToken)).rejects.toThrow();
  });
});

describe("ownership proof and single-use credentials", () => {
  it.each(["link", "code"])(
    "applies registration only after %s proof, consuming invite usage once",
    async (method) => {
      const user = await account("GUEST");
      jar.clear();
      await db.systemConfig.create({ data: { key: "open_registration", value: "false" } });
      const invite = await db.hostInviteCode.create({
        data: { code: "approved-invite", maxUses: 1 },
      });
      const result = await registerHost(user.email!, "Verified name", invite.code);
      expect(result.success).toBe(true);
      expect(await db.user.findUnique({ where: { id: user.id } })).toMatchObject({
        name: "Original",
        role: "GUEST",
      });
      expect((await db.hostInviteCode.findUniqueOrThrow({ where: { id: invite.id } })).uses).toBe(
        0
      );
      const proof = result.challenge!;
      const token = new URL(proof.link).searchParams.get("token")!;
      const verify = () =>
        method === "link" ? verifyMagicToken(token) : verifySignInCode(user.email!, proof.code);
      expect((await Promise.all([verify(), verify()])).filter(Boolean)).toHaveLength(1);
      expect(await db.user.findUnique({ where: { id: user.id } })).toMatchObject({
        name: "Verified name",
        role: "HOST",
      });
      expect((await db.hostInviteCode.findUniqueOrThrow({ where: { id: invite.id } })).uses).toBe(
        1
      );
    }
  );
  it("allows only one concurrent profile-token use", async () => {
    const user = await account();
    jar.clear();
    await db.magicToken.create({
      data: {
        userId: user.id,
        token: hashToken("change-proof"),
        type: "EMAIL_CHANGE",
        metadata: "verified@example.test",
        expiresAt: new Date(Date.now() + 60000),
      },
    });
    const results = await Promise.all([
      verifyChangeToken("change-proof"),
      verifyChangeToken("change-proof"),
    ]);
    expect(results.filter((result) => result.success)).toHaveLength(1);
    expect(await db.session.count()).toBe(2); // original plus exactly one new session
  });
  it("requires the invited account and consumes explicit acceptance once", async () => {
    const { event: e, host } = await event();
    const recipient = await db.user.create({
      data: { email: "recipient@example.test", role: "GUEST" },
    });
    await db.coHostInvitation.create({
      data: {
        eventId: e.id,
        email: recipient.email!,
        token: hashToken("cohost-proof"),
        expiresAt: new Date(Date.now() + 60000),
      },
    });
    const form = new FormData();
    form.set("token", "cohost-proof");
    await expect(acceptCoHost(form)).rejects.toThrow("invalid-token");
    expect(await db.coHostInvitation.count()).toBe(1);
    expect(await db.eventCoHost.count()).toBe(0);
    await createSession({ userId: recipient.id, email: recipient.email!, role: "GUEST" });
    const results = await Promise.all([
      acceptCoHost(form).catch(String),
      acceptCoHost(form).catch(String),
    ]);
    expect(results.filter((result) => result?.includes(`/e/${e.slug}/settings`))).toHaveLength(1);
    expect(await db.eventCoHost.findMany()).toMatchObject([
      { userId: recipient.id, eventId: e.id },
    ]);
    expect((await db.user.findUniqueOrThrow({ where: { id: host.id } })).role).toBe("HOST");
  });
});

describe("participation migration and parent ownership", () => {
  it("rolls back a reorder containing a section from another event", async () => {
    const { event: e, host } = await event();
    const other = await db.event.create({
      data: { title: "Other", slug: "other", hostId: host.id, startAt: new Date() },
    });
    const own = await db.eventInfoSection.create({
      data: { eventId: e.id, type: "info", content: "Own", order: 5 },
    });
    const foreign = await db.eventInfoSection.create({
      data: { eventId: other.id, type: "info", content: "Other", order: 6 },
    });
    await expect(reorderInfoSections(e.id, [own.id, foreign.id])).rejects.toThrow();
    expect((await db.eventInfoSection.findUniqueOrThrow({ where: { id: own.id } })).order).toBe(5);
    expect((await db.eventInfoSection.findUniqueOrThrow({ where: { id: foreign.id } })).order).toBe(
      6
    );
  });
  it("preserves legacy names/counts without granting ownership, and permits same-name RSVP votes", async () => {
    const migration = readFileSync(
      "prisma/postgres-migrations/20261115000000_participation_identity/migration.sql",
      "utf8"
    );
    await db.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        'CREATE TEMP TABLE "PotluckClaim" (id TEXT, "guestName" TEXT, quantity INTEGER) ON COMMIT DROP'
      );
      await tx.$executeRawUnsafe(
        'CREATE TEMP TABLE "PollVote" (id TEXT, "pollOptionId" TEXT, "voterName" TEXT, "userId" TEXT) ON COMMIT DROP'
      );
      await tx.$executeRawUnsafe(
        'CREATE UNIQUE INDEX "PollVote_pollOptionId_voterName_key" ON "PollVote"("pollOptionId", "voterName")'
      );
      await tx.$executeRawUnsafe(
        `INSERT INTO "PollVote" VALUES ('legacy', 'option', 'Same name', 'unproved-user'), ('legacy2', 'option', 'Another name', 'unproved-user')`
      );
      await tx.$executeRawUnsafe(`INSERT INTO "PotluckClaim" VALUES ('claim', 'Same name', 2)`);
      for (const sql of migration.split(";").filter((sql) => sql.trim()))
        await tx.$executeRawUnsafe(sql);
      expect(
        await tx.$queryRawUnsafe(
          'SELECT "voterName", "rsvpId", "userId" FROM "PollVote" ORDER BY id'
        )
      ).toEqual([
        { voterName: "Same name", rsvpId: null, userId: null },
        { voterName: "Another name", rsvpId: null, userId: null },
      ]);
      expect(
        await tx.$queryRawUnsafe(
          'SELECT "guestName", quantity, "rsvpId", "userId" FROM "PotluckClaim"'
        )
      ).toEqual([{ guestName: "Same name", quantity: 2, rsvpId: null, userId: null }]);
      await tx.$executeRawUnsafe(
        `INSERT INTO "PollVote" (id, "pollOptionId", "voterName", "rsvpId") VALUES ('a', 'option', 'Same name', 'rsvp-a'), ('b', 'option', 'Same name', 'rsvp-b')`
      );
      expect(await tx.$queryRawUnsafe('SELECT id FROM "PollVote"')).toHaveLength(4);
    });
  });
});
