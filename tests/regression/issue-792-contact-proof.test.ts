// #792 root cause: a typed contact was treated as authority to answer an invitation.
// Public verification must reveal no invitation state and grants only event/contact proof.
import "@/tests/helpers/english-request-locale";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { hashToken } from "@/lib/hash";
import { db } from "@/lib/db";
import {
  requestRsvpContactProof,
  verifyRsvpContactProof,
  readRsvpContactProofs,
} from "@/lib/rsvp-contact-proof";
import { requestRsvpVerification, verifyRsvpVerification } from "@/app/actions/event/rsvp";

const m = vi.hoisted(() => ({
  event: vi.fn(),
  recent: vi.fn(),
  create: vi.fn(),
  find: vi.fn(),
  rows: vi.fn(),
  update: vi.fn(),
  rate: vi.fn(),
  deliver: vi.fn(),
  offered: vi.fn(),
  access: vi.fn(),
  captcha: vi.fn(),
  ip: vi.fn(),
  trusted: vi.fn(),
  account: vi.fn(),
  rsvp: vi.fn(),
  invitation: vi.fn(),
}));
vi.mock("@/lib/db", () => ({
  db: {
    $transaction: async (fn: (tx: typeof db) => Promise<unknown>) => fn(db),
    $executeRaw: vi.fn(),
    event: { findUnique: m.event },
    user: { findUnique: m.account },
    rSVP: { findMany: m.rsvp },
    invitation: { findMany: m.invitation },
    rsvpContactChallenge: {
      findFirst: m.recent,
      create: m.create,
      findUnique: m.find,
      findMany: m.rows,
      update: m.update,
    },
  },
}));
vi.mock("@/lib/rateLimit", () => ({ rateLimit: m.rate }));
vi.mock("@/lib/clientIp", () => ({ isTrustedIpConfigured: m.trusted, getClientIp: m.ip }));
vi.mock("@/lib/eventAccess", () => ({ resolveEventAccess: m.access }));
vi.mock("@/lib/notifications/service", () => ({ deliver: m.deliver, offeredChannels: m.offered }));
vi.mock("@/lib/captcha", () => ({ assertCaptcha: m.captcha }));
vi.mock("@/lib/session-user", () => ({ getSessionUser: async () => null }));
vi.mock("@/lib/session", () => ({ getSession: async () => null }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const id = "5363013c-3e8b-4258-8b40-a1cf45b560f2";
const receipt = "51ce01b2-ab56-4a0f-8d77-78b4b8eed679";
const event = () => ({
  id: "event",
  slug: "party",
  status: "PUBLISHED",
  startAt: new Date("2099-01-01"),
  rsvpDeadline: null,
});
const request = { eventId: "event", channel: "email", destination: " Alice@Example.com " };
const proof = { challengeId: id, receipt };
const check = { eventId: "event", challengeId: id, code: "12345678" };
const row = () => ({
  id,
  eventId: "event",
  channel: "email",
  destination: "alice@example.com",
  secretHash: hashToken(check.code),
  receiptHash: hashToken(receipt),
  attempts: 0,
  verifiedAt: null,
  usedAt: null,
  expiresAt: new Date(Date.now() + 900000),
});
beforeEach(() => {
  vi.clearAllMocks();
  m.rate.mockResolvedValue({ success: true });
  m.trusted.mockReturnValue(false);
  m.ip.mockResolvedValue("203.0.113.1");
  m.event.mockResolvedValue(event());
  m.access.mockResolvedValue({ decision: "granted" });
  m.offered.mockResolvedValue(["email", "sms"]);
  m.recent.mockResolvedValue(null);
  m.create.mockImplementation(async ({ data }) => ({ id, ...data }));
  m.deliver.mockResolvedValue({ summary: { accepted: 1, uncertain: 0 } });
  m.find.mockResolvedValue(row());
  m.rows.mockResolvedValue([{ ...row(), verifiedAt: new Date() }]);
  m.captcha.mockResolvedValue(undefined);
});

describe("#792 proof issuance without invitation enumeration", () => {
  it.each(["new", "invited"])("uses the same public contract for a %s contact", async () => {
    expect(await requestRsvpVerification(request, "captcha-token")).toEqual({
      success: true,
      challengeId: id,
    });
    expect(m.captcha).toHaveBeenCalledWith("rsvp_create", "captcha-token");
    expect(m.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        eventId: "event",
        channel: "email",
        destination: "alice@example.com",
        secretHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        expiresAt: expect.any(Date),
      }),
    });
    const [message, recipients] = m.deliver.mock.calls[0];
    expect(message).toEqual({
      kind: "connection_verification",
      purpose: "rsvp",
      id,
      code: expect.stringMatching(/^\d{8}$/),
    });
    expect(recipients).toEqual([
      {
        id,
        locale: "en-US",
        policy: { channels: ["email"] },
        destinations: { email: "alice@example.com" },
      },
    ]);
    expect(m.account).not.toHaveBeenCalled();
    expect(m.rsvp).not.toHaveBeenCalled();
    expect(m.invitation).not.toHaveBeenCalled();
  });
  it("normalizes phones and applies destination plus trusted-IP limits", async () => {
    m.trusted.mockReturnValue(true);
    expect(
      (
        await requestRsvpContactProof({
          ...request,
          channel: "sms",
          destination: "+1 (555) 123-4567",
        })
      ).success
    ).toBe(true);
    expect(m.rate).toHaveBeenCalledWith(
      `rsvp-proof:destination:${hashToken("sms:+15551234567")}`,
      5,
      3600
    );
    expect(m.rate).toHaveBeenCalledWith("rsvp-proof:ip:203.0.113.1", 15, 600);
  });
  it.each([
    { ...request, channel: "bad" },
    { ...request, destination: "invalid" },
    { ...request, channel: "sms", destination: "bad" },
    { ...request, channel: "sms", destination: "" },
    { ...request, extra: true },
  ])("rejects invalid request %j", async (input) => {
    expect(await requestRsvpContactProof(input)).toMatchObject({
      success: false,
      reason: "invalidRsvp",
    });
    expect(m.create).not.toHaveBeenCalled();
  });
  it("fails closed on CAPTCHA rejection", async () => {
    m.captcha.mockRejectedValue(new Error("captcha rejected"));
    await expect(requestRsvpVerification(request)).rejects.toThrow("captcha rejected");
    expect(m.event).not.toHaveBeenCalled();
  });
  it.each(["quota", "cooldown"])("enforces %s without guest lookup", async (kind) => {
    if (kind === "quota") m.rate.mockResolvedValue({ success: false });
    else m.recent.mockResolvedValue({ id });
    expect(await requestRsvpContactProof(request)).toMatchObject({
      success: false,
      reason: "rsvpProofRateLimited",
    });
    expect(m.deliver).not.toHaveBeenCalled();
  });
  it.each([
    [null, "eventNotFound"],
    [{ ...event(), status: "DRAFT" }, "forbidden"],
    [{ ...event(), startAt: new Date(0) }, "eventStarted"],
    [{ ...event(), rsvpDeadline: new Date(0) }, "deadlinePassed"],
  ])("respects event rules before issuing proof", async (value, reason) => {
    m.event.mockResolvedValue(value);
    expect(await requestRsvpContactProof(request)).toMatchObject({ success: false, reason });
    expect(m.create).not.toHaveBeenCalled();
  });
  it("respects private/password access", async () => {
    m.access.mockResolvedValue({ decision: "private-blocked" });
    expect(await requestRsvpContactProof(request)).toMatchObject({
      success: false,
      reason: "forbidden",
    });
  });
  it.each(["disabled", "failed", "uncertain"])("handles %s verification delivery", async (kind) => {
    if (kind === "disabled") m.offered.mockResolvedValue([]);
    if (kind === "failed") m.deliver.mockResolvedValue({ summary: { accepted: 0, uncertain: 0 } });
    if (kind === "uncertain")
      m.deliver.mockResolvedValue({ summary: { accepted: 0, uncertain: 1 } });
    expect((await requestRsvpContactProof(request)).success).toBe(kind === "uncertain");
  });
});

describe("#792 code verification", () => {
  it("consumes a code once into a distinct receipt without saving a response", async () => {
    const result = await verifyRsvpVerification(check);
    expect(result).toMatchObject({
      success: true,
      proof: { challengeId: id, receipt: expect.any(String) },
    });
    expect(JSON.stringify(result)).not.toContain(check.code);
    expect(m.update).toHaveBeenCalledWith({ where: { id }, data: { attempts: { increment: 1 } } });
    expect(m.update).toHaveBeenCalledWith({
      where: { id },
      data: { verifiedAt: expect.any(Date), receiptHash: expect.stringMatching(/^[a-f0-9]{64}$/) },
    });
    expect(m.rsvp).not.toHaveBeenCalled();
    expect(m.account).not.toHaveBeenCalled();
  });
  it.each([
    null,
    { ...row(), eventId: "other" },
    { ...row(), usedAt: new Date() },
    { ...row(), verifiedAt: new Date() },
    { ...row(), expiresAt: new Date(0) },
    { ...row(), attempts: 5 },
  ])("rejects missing, mismatched, spent, expired, or exhausted challenges", async (value) => {
    m.find.mockResolvedValue(value);
    expect(await verifyRsvpContactProof(check)).toMatchObject({
      success: false,
      reason: "rsvpProofInvalid",
    });
    expect(m.update).not.toHaveBeenCalled();
  });
  it("counts incorrect guesses without creating receipts", async () => {
    expect(await verifyRsvpContactProof({ ...check, code: "87654321" })).toMatchObject({
      success: false,
    });
    expect(m.update).toHaveBeenCalledTimes(1);
  });
  it.each([
    { ...check, code: "bad" },
    { ...check, challengeId: "invalid" },
  ])("rejects malformed checks", async (input) => {
    expect(await verifyRsvpContactProof(input)).toMatchObject({ success: false });
    expect(m.find).not.toHaveBeenCalled();
  });
  it("bounds verification requests", async () => {
    m.rate.mockResolvedValue({ success: false });
    expect(await verifyRsvpContactProof(check)).toMatchObject({ success: false });
    expect(m.find).not.toHaveBeenCalled();
  });
});

describe("#792 final receipt authority", () => {
  const read = (input = { guestEmail: "alice@example.com" }, proofs: unknown = [proof]) =>
    readRsvpContactProofs(db, "event", input, proofs);
  it("permits contactless RSVPs and matches normalized proved contacts", async () => {
    expect(await readRsvpContactProofs(db, "event", {}, undefined)).toEqual([]);
    expect(await read({ guestEmail: " Alice@Example.com " })).toEqual([id]);
  });
  it.each([undefined, [], [proof, proof], [{ challengeId: id, receipt: "bad" }]])(
    "rejects missing, duplicated, or malformed receipts",
    async (proofs) => {
      expect(await read({ guestEmail: "alice@example.com" }, proofs ?? [])).toBeNull();
    }
  );
  it("requires separate proof for every supplied contact", async () => {
    expect(
      await readRsvpContactProofs(
        db,
        "event",
        { guestEmail: "alice@example.com", guestPhone: "+15551234567" },
        [proof]
      )
    ).toBeNull();
    expect(
      await readRsvpContactProofs(
        db,
        "event",
        { guestEmail: "alice@example.com", guestPhone: "+15551234567" },
        [proof, proof]
      )
    ).toBeNull();
  });
  it.each(
    [
      [],
      [{ ...row(), verifiedAt: null }],
      [{ ...row(), verifiedAt: new Date(), eventId: "other" }],
      [{ ...row(), verifiedAt: new Date(), destination: "other@example.com" }],
      [{ ...row(), verifiedAt: new Date(), usedAt: new Date() }],
      [{ ...row(), verifiedAt: new Date(), expiresAt: new Date(0) }],
      [{ ...row(), verifiedAt: new Date(), receiptHash: null }],
      [{ ...row(), verifiedAt: new Date(), receiptHash: hashToken("other") }],
    ].map((rows) => [rows])
  )("fails closed on invalid persisted proof", async (rows) => {
    m.rows.mockResolvedValue(rows);
    expect(await read()).toBeNull();
  });
});
