import { db } from "@/lib/db";
// Root causes (2026-11 audit): child ids escaped authorized parents, mutation
// actions skipped event gates, and unvalidated stored input reached shared pages.
import "@/tests/helpers/english-request-locale";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { NextRequest } from "next/server";
const m = vi.hoisted(() => ({
  event: vi.fn(),
  session: vi.fn(),
  viewer: vi.fn(),
  cookie: vi.fn(),
  write: vi.fn(),
  limit: vi.fn(),
  send: vi.fn(),
  user: vi.fn(),
  activity: vi.fn(),
  events: vi.fn(),
}));
vi.mock("@/lib/db", () => ({
  db: {
    $transaction: async (fn: (tx: typeof db) => Promise<unknown>) => fn(db),
    $executeRaw: vi.fn(),
    event: { findUnique: m.event, findMany: m.events, update: m.write },
    user: { findUnique: m.user, update: m.write },
    magicToken: { create: m.write, updateMany: m.write },
    eventTheme: { upsert: m.write },
    rSVP: { findFirst: vi.fn(async () => null), create: m.write },
    comment: { create: m.write },
    activityEvent: { findMany: m.activity },
  },
}));
vi.mock("@/lib/session", () => ({ getSession: m.session, destroySession: m.write }));
vi.mock("@/lib/session-user", () => ({ getSessionUser: m.viewer }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: m.cookie }) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/captcha", () => ({ assertCaptcha: vi.fn() }));
vi.mock("@/lib/clientIp", () => ({
  isTrustedIpConfigured: () => true,
  getClientIp: async () => "127.0.0.1",
}));
vi.mock("@/lib/rateLimit", () => ({ rateLimit: m.limit }));
vi.mock("@/lib/email", () => ({ sendMagicLinkEmail: m.send }));
vi.mock("@/lib/sms", () => ({ sendMagicLinkSms: m.send }));
import { addRSVP } from "@/app/actions/event/rsvp";
import { addComment } from "@/app/actions/event/comments";
import {
  saveCoverImage,
  saveEventDates,
  saveEventField,
  saveEventTheme,
} from "@/app/actions/event/settings";
import { addCoHost } from "@/app/actions/event/cohosts";
import { getDashboardActivity } from "@/app/actions/event/dashboard";
import { updateProfileSettings } from "@/app/actions/profile";
import { POST } from "@/app/auth/sign-out/route";
import { GET as cohostLink } from "@/app/auth/verify-cohost/route";
import { GET as changeLink } from "@/app/auth/verify-change/route";
import { getUnlockSignature } from "@/lib/crypto";
import { resolveEventAccess } from "@/lib/eventAccess";
import UploadedImage from "@/components/ui/UploadedImage";
import {
  CreatePollSchema,
  PollSettingsSchema,
  PotluckItemSchema,
  PotluckClaimSchema,
  RsvpFieldSchema,
  InfoSectionSchema,
} from "@/lib/schemas";
const uploaded = "/api/uploads/12345678-1234-4123-8123-123456789abc.png";
const event = {
  id: "event",
  slug: "party",
  hostId: "host",
  status: "PUBLISHED",
  visibility: "PUBLIC",
  passwordHash: null as string | null,
  coHosts: [],
  commentsEnabled: true,
  startAt: new Date("2099-01-01"),
  rsvpDeadline: null,
};
beforeEach(() => {
  vi.clearAllMocks();
  m.event.mockResolvedValue(event);
  m.session.mockResolvedValue(null);
  m.viewer.mockResolvedValue(null);
  m.cookie.mockReturnValue(undefined);
  m.limit.mockResolvedValue({ success: true });
});

describe("server-side event gates", () => {
  it.each([
    { visibility: "PRIVATE" },
    { passwordHash: "protected" },
    { status: "DRAFT" },
    { status: "CANCELLED" },
    { status: "DELETED" },
  ])("rejects inaccessible or unpublished RSVP creation: %j", async (overrides) => {
    m.event.mockResolvedValue({ ...event, ...overrides });
    expect(
      (await addRSVP({ eventId: event.id, guestName: "Guest", status: "GOING" })).success
    ).toBe(false);
    expect(m.write).not.toHaveBeenCalled();
  });
  it("rejects a signed-in commenter who has not unlocked the public event", async () => {
    m.viewer.mockResolvedValue({ id: "visitor", role: "GUEST" });
    m.session.mockResolvedValue({ userId: "visitor", role: "GUEST" });
    m.event.mockResolvedValue({ ...event, passwordHash: "protected" });
    expect(
      (await addComment({ eventId: event.id, guestName: "Visitor", body: "Bypass" })).success
    ).toBe(false);
    expect(m.write).not.toHaveBeenCalled();
  });
  it("revokes the old unlock when the password hash changes", async () => {
    m.cookie.mockReturnValue({ value: getUnlockSignature(event.slug, "old-hash") });
    expect(
      (await resolveEventAccess({ ...event, passwordHash: "old-hash" }, event.slug)).decision
    ).toBe("granted");
    expect(
      (await resolveEventAccess({ ...event, passwordHash: "new-hash" }, event.slug)).decision
    ).toBe("password");
  });
  it("filters attendance and hidden RSVP identity from dashboard guests while preserving host access", async () => {
    const activities = ["check_in", "walk_in", "rsvp_new", "event_title"].map((type) => ({
      eventId: event.id,
      type,
    }));
    m.activity.mockResolvedValue(activities);
    m.events.mockResolvedValue([{ ...event, guestListVis: "HOST_ONLY" }]);
    m.session.mockResolvedValue({ userId: "guest" });
    expect((await getDashboardActivity([event.id])).map((row) => row.type)).toEqual([
      "event_title",
    ]);
    m.session.mockResolvedValue({ userId: "host" });
    expect(await getDashboardActivity([event.id])).toEqual(activities);
  });
});

describe("bounded server action inputs and stored images", () => {
  it.each([
    "https://external.example/image.png",
    "http://127.0.0.1/image.png",
    "//example.org/image.png",
    "/api/uploads/../secret.png",
    `${uploaded}?remote=true`,
  ])("rejects unsafe stored image path %s", async (url) => {
    await expect(saveCoverImage(event.id, url)).rejects.toThrow();
    await expect(updateProfileSettings({ name: "Name", avatarUrl: url })).rejects.toThrow();
    expect(m.write).not.toHaveBeenCalled();
    expect(
      renderToStaticMarkup(<UploadedImage src={url} alt="Legacy" width={20} height={20} />)
    ).toBe("");
  });
  it("renders a valid uploaded image", () => {
    expect(
      renderToStaticMarkup(<UploadedImage src={uploaded} alt="Uploaded" width={20} height={20} />)
    ).toContain("Uploaded");
  });
  it("rejects oversized titles, impossible dates and invalid themes before persistence", async () => {
    await expect(saveEventField(event.id, "title", "x".repeat(201))).rejects.toThrow();
    m.session.mockResolvedValue({ userId: "host" });
    for (const start of ["2026-02-30T12:00", "invalid", "2026-12-01T25:00"]) {
      await expect(saveEventDates(event.id, start, null)).rejects.toThrow();
    }
    await expect(
      saveEventTheme(event.id, "DARK", "url(https://external.example)", "#112233", "#112233")
    ).rejects.toThrow();
    await expect(
      saveEventTheme(event.id, "DARK", "#112233", "#112233", "#112233", null, -1)
    ).rejects.toThrow();
    expect(m.write).not.toHaveBeenCalled();
  });
  it("bounds poll, potluck, custom field and info-section payloads and enums", () => {
    expect(
      CreatePollSchema.safeParse({
        question: "x".repeat(201),
        options: [],
        multiChoice: false,
        allowGuestsToAdd: false,
        hideVoters: false,
      }).success
    ).toBe(false);
    expect(PollSettingsSchema.safeParse({ locked: "false" }).success).toBe(false);
    expect(PotluckItemSchema.safeParse({ label: "x".repeat(201), quantity: 1 }).success).toBe(
      false
    );
    for (const claimedQty of [-1, 0, 1.5, Infinity, "1"])
      expect(PotluckClaimSchema.safeParse({ guestName: "Guest", claimedQty }).success).toBe(false);
    expect(
      RsvpFieldSchema.safeParse({ label: "Field", fieldType: "SCRIPT", required: false, order: 0 })
        .success
    ).toBe(false);
    expect(
      InfoSectionSchema.safeParse({
        eventId: event.id,
        type: "script",
        title: null,
        content: "Hello",
        url: null,
        order: 0,
      }).success
    ).toBe(false);
  });
  it("validates and throttles co-host recipients before invitation delivery", async () => {
    m.session.mockResolvedValue({ userId: "host" });
    await expect(addCoHost(event.id, "not-an-email")).rejects.toThrow();
    m.limit.mockResolvedValue({ success: false });
    expect((await addCoHost(event.id, "recipient@example.test")).success).toBe(false);
    expect(m.send).not.toHaveBeenCalled();
    expect(m.write).not.toHaveBeenCalled();
  });
  it.each(["email", "phone"] as const)(
    "keeps %s delivery errors indistinguishable from occupied contacts",
    async (channel) => {
      m.viewer.mockResolvedValue({ id: "user" });
      const user = { id: "user", email: "old@example.test", phone: "+15550001111" };
      m.user.mockImplementation(async (query: { where: { id?: string } }) =>
        query.where.id ? user : null
      );
      m.send.mockRejectedValueOnce(new Error("synthetic provider failure"));
      const data = {
        name: "Name",
        ...(channel === "email" ? { email: "new@example.test" } : { phone: "+15550002222" }),
      };
      const failed = await updateProfileSettings(data);
      expect(m.send).toHaveBeenCalledTimes(1);
      m.user.mockResolvedValue(user);
      const occupied = await updateProfileSettings(data);
      expect(failed).toEqual(occupied);
      expect(failed.success).toBe(true);
      expect(m.send).toHaveBeenCalledTimes(1);
    }
  );
  it("suppresses verification mail when throttled without exposing account availability", async () => {
    m.viewer.mockResolvedValue({ id: "user" });
    m.user.mockResolvedValue({ id: "user", email: "old@example.test" });
    m.limit.mockResolvedValue({ success: false });
    const limited = await updateProfileSettings({ name: "Name", email: "new@example.test" });
    m.limit.mockResolvedValue({ success: true });
    const occupied = await updateProfileSettings({ name: "Name", email: "occupied@example.test" });
    expect(limited).toEqual(occupied);
    expect(m.send).not.toHaveBeenCalled();
  });
});

describe("non-mutating GET and canonical link origins", () => {
  it("rejects cross-origin sign-out without revoking the session", async () => {
    const response = await POST(
      new NextRequest("http://localhost:3000/auth/sign-out", {
        method: "POST",
        headers: { origin: "https://attacker.example" },
      })
    );
    expect(response?.status).toBe(403);
    expect(m.write).not.toHaveBeenCalled();
  });
  it.each([cohostLink, changeLink])(
    "never redirects to a supplied Host header",
    async (handler) => {
      const response = await handler(
        new NextRequest("https://attacker.example/auth/verify", {
          headers: { host: "attacker.example", "x-forwarded-proto": "https" },
        })
      );
      expect(response.headers.get("location")).toMatch(/^http:\/\/localhost:3000\//);
      expect(response.headers.get("set-cookie")).toBeNull();
    }
  );
});
