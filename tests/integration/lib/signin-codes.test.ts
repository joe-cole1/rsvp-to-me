import { beforeEach, describe, expect, it, vi } from "vitest";
import { db, truncateAll } from "../helpers/db";
import { createLoginChallenge, verifyMagicToken, verifySignInCode } from "@/lib/auth";
const { session } = vi.hoisted(() => ({ session: vi.fn() }));
vi.mock("@/lib/session", () => ({ createSession: session }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: vi.fn(), set: vi.fn() }) }));
beforeEach(async () => {
  await truncateAll();
  session.mockReset();
  await db.user.create({ data: { email: "code@example.test", role: "HOST" } });
});
function token(link: string) {
  return new URL(link).searchParams.get("token")!;
}

describe("paired LOGIN code/link consumption with PostgreSQL (#844)", () => {
  it("accepts exactly one of simultaneous correct code submissions", async () => {
    const challenge = (await createLoginChallenge("code@example.test"))!;
    const results = await Promise.all(
      Array.from({ length: 4 }, () => verifySignInCode("code@example.test", challenge.code))
    );
    expect(results.filter(Boolean)).toHaveLength(1);
    expect(session).toHaveBeenCalledTimes(1);
    expect(await verifyMagicToken(token(challenge.link))).toBe(false);
  });
  it("accepts exactly one winner when link and code race", async () => {
    const challenge = (await createLoginChallenge("code@example.test"))!;
    const results = await Promise.all([
      verifyMagicToken(token(challenge.link)),
      verifySignInCode("code@example.test", challenge.code),
    ]);
    expect(results.filter(Boolean)).toHaveLength(1);
    expect(session).toHaveBeenCalledTimes(1);
    expect(await verifySignInCode("code@example.test", challenge.code)).toBe(false);
    expect(await verifyMagicToken(token(challenge.link))).toBe(false);
  });
  it("serializes wrong attempts and retires both credentials on the fifth", async () => {
    const challenge = (await createLoginChallenge("code@example.test"))!;
    const wrong = challenge.code === "999999" ? "000000" : "999999";
    const results = await Promise.all(
      Array.from({ length: 7 }, () => verifySignInCode("code@example.test", wrong))
    );
    expect(results.every((result) => !result)).toBe(true);
    const record = await db.magicToken.findFirstOrThrow();
    expect(record).toMatchObject({ used: true, codeAttempts: 5 });
    expect(await verifySignInCode("code@example.test", challenge.code)).toBe(false);
    expect(await verifyMagicToken(token(challenge.link))).toBe(false);
    expect(session).not.toHaveBeenCalled();
  });
  it("resends retire previous credentials and concurrent resends leave one active pair", async () => {
    const first = (await createLoginChallenge("code@example.test"))!;
    await Promise.all([
      createLoginChallenge("code@example.test"),
      createLoginChallenge("code@example.test"),
    ]);
    expect(await db.magicToken.count({ where: { used: false } })).toBe(1);
    expect(await verifyMagicToken(token(first.link))).toBe(false);
  });
  it("expires code and link together without creating a session", async () => {
    const challenge = (await createLoginChallenge("code@example.test"))!;
    await db.magicToken.updateMany({ data: { expiresAt: new Date(Date.now() - 1) } });
    expect(await verifySignInCode("code@example.test", challenge.code)).toBe(false);
    expect(await verifyMagicToken(token(challenge.link))).toBe(false);
    expect(session).not.toHaveBeenCalled();
  });
  it("never accepts an admin welcome link as a code challenge", async () => {
    const user = await db.user.findUniqueOrThrow({ where: { email: "code@example.test" } });
    await db.magicToken.create({
      data: {
        userId: user.id,
        token: "welcome-fixture-hash",
        type: "LOGIN",
        expiresAt: new Date(Date.now() + 48 * 3600000),
      },
    });
    expect(await verifySignInCode("code@example.test", "000000")).toBe(false);
    expect(session).not.toHaveBeenCalled();
  });
});
