// #789 root cause: manual blasts selected RSVP contacts/locale but bypassed recipient
// preferences and counted requested contacts as sent. Exercise the real resolver,
// dispatcher and adapters, replacing only DB, authorization and provider boundaries.
import "@/tests/helpers/english-request-locale";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RecipientRow } from "@/lib/notifications/resolve";

const m = vi.hoisted(() => ({
  config: {} as Record<string, string>,
  enabled: { email: true, sms: true },
  settings: vi.fn(),
  bindings: vi.fn(),
  connections: vi.fn(),
  guests: vi.fn(),
  fresh: vi.fn(),
  event: vi.fn(),
  guard: vi.fn(),
  captcha: vi.fn(),
  limit: vi.fn(),
  mail: vi.fn(),
  fetch: vi.fn(),
}));
vi.mock("nodemailer", () => ({
  default: { createTransport: () => ({ sendMail: m.mail, close: vi.fn() }) },
}));
vi.mock("@/lib/config", () => ({
  getSystemConfigMap: async () => m.config,
  isChannelEnabled: async (channel: "email" | "sms") => m.enabled[channel],
}));
vi.mock("@/lib/crypto", () => ({ decryptConfig: (value: string | undefined) => value ?? "" }));
vi.mock("@/lib/redis", () => ({ isRedisEnabled: () => false }));
vi.mock("@/lib/db", () => ({
  db: {
    systemConfig: { findUnique: async () => null },
    event: { findUnique: m.event },
    rSVP: { findMany: m.guests, findUnique: m.fresh },
    notificationSettings: { findMany: m.settings },
    notificationBinding: { findMany: m.bindings },
    notificationConnection: { findMany: m.connections },
  },
}));
vi.mock("@/app/actions/event/shared", () => ({ assertHostOrCohost: m.guard }));
vi.mock("@/lib/captcha", () => ({ assertCaptcha: m.captcha }));
vi.mock("@/lib/rateLimit", () => ({ rateLimit: m.limit }));
import { sendBlast, sendSmsBlast } from "@/app/actions/event/blasts";

function guest(id: string): RecipientRow {
  return {
    id,
    userId: "user",
    guestEmail: `${id}@example.test`,
    guestPhone: "+15550001111",
    user: {
      notificationChannel: "BOTH",
      emailNotifications: true,
      smsNotifications: true,
      preferredLocale: "nl-NL",
    },
  };
}
const settings = (id: string, channels: string[], blockedChannels: string[] = []) => ({
  id,
  channels: ["email", "sms"],
  blockedChannels,
  categories: [{ category: "updates", channels }],
});
let rows: RecipientRow[];
beforeEach(() => {
  vi.clearAllMocks();
  rows = [guest("guest")];
  m.config = {
    email_provider: "smtp",
    smtp_host: "smtp.example.test",
    email_from: "Site <site@example.test>",
    twilio_account_sid: "ACfixture",
    twilio_auth_token: "fixture-token",
    twilio_phone_number: "+15559999999",
  };
  m.enabled = { email: true, sms: true };
  m.settings.mockResolvedValue([]);
  m.bindings.mockResolvedValue([]);
  m.connections.mockResolvedValue([]);
  m.guests.mockImplementation(async ({ skip, take }: { skip: number; take: number }) =>
    rows.slice(skip, skip + take)
  );
  m.fresh.mockImplementation(async ({ where }: { where: { id: string } }) =>
    rows.find((row) => row.id === where.id)
  );
  m.event.mockResolvedValue({
    title: "Party",
    slug: "party",
    hostDisplayName: "Organizer",
    host: { name: "Host", email: "host@example.test" },
    theme: { baseTheme: "DARK", accentColor: "#fe00fe" },
  });
  m.guard.mockResolvedValue({});
  m.captcha.mockResolvedValue(undefined);
  m.limit.mockResolvedValue({ success: true });
  m.mail.mockImplementation(async ({ bcc }: { bcc: string[] }) => ({ accepted: bcc }));
  m.fetch.mockImplementation(async () => Response.json({ sid: "SMfixture", status: "queued" }));
  vi.stubGlobal("fetch", m.fetch);
  for (const key of [
    "SMTP_HOST",
    "SMTP_PORT",
    "SMTP_SECURE",
    "SMTP_USER",
    "SMTP_PASS",
    "EMAIL_FROM",
    "CLOUDFLARE_WORKER_EMAIL_URL",
    "CLOUDFLARE_WORKER_API_SECRET",
    "CLOUDFLARE_ACCOUNT_ID",
    "CLOUDFLARE_API_TOKEN",
    "TWILIO_ACCOUNT_SID",
    "TWILIO_AUTH_TOKEN",
    "TWILIO_PHONE_NUMBER",
  ])
    vi.stubEnv(key, "");
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

for (const [channel, send] of [
  ["email", sendBlast],
  ["sms", sendSmsBlast],
] as const) {
  describe(`#789 manual ${channel} preferences and outcomes`, () => {
    const provider = channel === "email" ? m.mail : m.fetch;
    it("does not submit a legacy opt-out, while an eligible guest remains reachable", async () => {
      const optedOut = guest("opted-out");
      optedOut.guestPhone = "+15550002222";
      optedOut.user = {
        ...optedOut.user!,
        [channel === "email" ? "emailNotifications" : "smsNotifications"]: false,
      };
      rows.push(optedOut);
      const result = await send("event", "Host-authored {literal} text", ["GOING"]);
      expect(result).toEqual({
        success: true,
        sent: 1,
        summary: { accepted: 1, skipped: 1, failed: 0, uncertain: 0 },
      });
      expect(provider).toHaveBeenCalledTimes(1);
      if (channel === "email") expect(m.mail.mock.calls[0][0].bcc).toEqual([rows[0].guestEmail]);
      else {
        const submitted = new URLSearchParams(m.fetch.mock.calls[0][1].body);
        expect(submitted.get("To")).toBe(rows[0].guestPhone);
        expect(submitted.get("To")).not.toBe(optedOut.guestPhone);
      }
      expect(JSON.stringify(result)).not.toContain("example.test");
      expect(m.guests).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            eventId: "event",
            OR: [{ status: "GOING", responded: true }],
          }),
          take: 500,
          skip: 0,
          orderBy: { id: "asc" },
        })
      );
      expect(m.guard).toHaveBeenCalledBefore(m.captcha);
      expect(m.captcha).toHaveBeenCalledBefore(m.limit);
      expect(m.limit).toHaveBeenCalledWith(`blast:event:${channel}`, 10, 3600);
    });

    it("honors authoritative profile choices even when the legacy switches are on", async () => {
      m.settings.mockResolvedValue([settings("profile:user", [])]);
      expect((await send("event", "Hello", ["ALL"])).summary.skipped).toBe(1);
      expect(provider).not.toHaveBeenCalled();
    });

    it("honors RSVP preferences for a guest without an account", async () => {
      rows[0] = { ...rows[0], userId: null, user: null };
      m.settings.mockResolvedValue([settings("rsvp:guest", [])]);
      expect((await send("event", "Hello", ["ALL"])).sent).toBe(0);
      expect(provider).not.toHaveBeenCalled();
    });

    it("allows an explicit event override but never overrides a hard block", async () => {
      m.settings.mockResolvedValue([
        settings("profile:user", []),
        settings("rsvp:guest", [channel]),
      ]);
      expect((await send("event", "Hello", ["ALL"])).sent).toBe(1);
      provider.mockClear();
      m.settings.mockResolvedValue([
        settings("profile:user", [], [channel]),
        settings("rsvp:guest", [channel]),
      ]);
      expect((await send("event", "Hello", ["ALL"])).summary.skipped).toBe(1);
      expect(provider).not.toHaveBeenCalled();
    });

    it("rechecks consent at the provider boundary", async () => {
      m.settings
        .mockResolvedValueOnce([settings("profile:user", [channel])])
        .mockResolvedValue([settings("profile:user", [])]);
      expect((await send("event", "Hello", ["ALL"])).summary.skipped).toBe(1);
      expect(m.fresh).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "guest" } }));
      expect(provider).not.toHaveBeenCalled();
    });

    it("skips revoked event destinations", async () => {
      m.bindings.mockResolvedValue([
        {
          rsvpId: "guest",
          channel,
          destination: channel === "email" ? rows[0].guestEmail : rows[0].guestPhone,
          revokedAt: new Date(),
          connectionId: null,
          connection: null,
        },
      ]);
      expect((await send("event", "Hello", ["ALL"])).summary.skipped).toBe(1);
      expect(provider).not.toHaveBeenCalled();
    });

    it("does not borrow a profile connection or use an unselected fallback channel", async () => {
      rows[0] = { ...rows[0], [channel === "email" ? "guestEmail" : "guestPhone"]: null };
      m.connections.mockResolvedValue([
        {
          userId: "user",
          channel,
          destination: channel === "email" ? "profile@example.test" : "+15558889999",
        },
      ]);
      expect((await send("event", "Hello", ["ALL"])).summary.skipped).toBe(1);
      expect(m.mail).not.toHaveBeenCalled();
      expect(m.fetch).not.toHaveBeenCalled();
    });

    it("does not count a disabled or unconfigured service as accepted", async () => {
      m.enabled[channel] = false;
      expect((await send("event", "Hello", ["ALL"])).summary).toEqual({
        accepted: 0,
        skipped: 1,
        failed: 0,
        uncertain: 0,
      });
      m.enabled[channel] = true;
      m.config = {};
      expect((await send("event", "Hello", ["ALL"])).sent).toBe(0);
      expect(provider).not.toHaveBeenCalled();
    });

    it("counts explicit rejection and uncertain acceptance independently", async () => {
      if (channel === "email")
        m.mail.mockResolvedValue({ accepted: [], rejected: [rows[0].guestEmail] });
      else m.fetch.mockImplementation(async () => Response.json({}, { status: 400 }));
      expect((await send("event", "Hello", ["ALL"])).summary.failed).toBe(1);
      if (channel === "email") m.mail.mockResolvedValue({ accepted: [], rejected: [] });
      else m.fetch.mockImplementation(async () => Response.json({}));
      expect((await send("event", "Hello", ["ALL"])).summary).toEqual({
        accepted: 0,
        skipped: 0,
        failed: 0,
        uncertain: 1,
      });
      expect(channel === "email" ? m.fetch : m.mail).not.toHaveBeenCalled();
    });

    it("checks CAPTCHA before any recipient or provider work", async () => {
      m.captcha.mockRejectedValue(new Error("CAPTCHA required"));
      await expect(send("event", "Hello", ["ALL"])).rejects.toThrow("CAPTCHA required");
      expect(m.guests).not.toHaveBeenCalled();
      expect(m.limit).not.toHaveBeenCalled();
      expect(provider).not.toHaveBeenCalled();
    });
  });
}

it("keeps locale batches, BCC privacy, theme, reply-to and literal host text", async () => {
  rows.push({ ...guest("english"), user: { ...guest("english").user!, preferredLocale: "en-US" } });
  await sendBlast("event", "Host-authored {literal} text", ["ALL"]);
  expect(m.mail).toHaveBeenCalledTimes(2);
  expect(m.mail).toHaveBeenCalledWith(
    expect.objectContaining({
      to: "Site <site@example.test>",
      bcc: ["guest@example.test"],
      replyTo: "host@example.test",
      html: expect.stringContaining('lang="nl-NL"'),
      text: expect.stringContaining("Host-authored {literal} text"),
    })
  );
  expect(m.mail.mock.calls[0][0].html).toContain("#fe00fe");
});

it("retains completed page counts and redacts a later preparation failure", async () => {
  rows = Array.from({ length: 500 }, (_, index) => guest(`guest-${index}`));
  m.guests.mockResolvedValueOnce(rows).mockRejectedValueOnce(new Error("private-provider-secret"));
  const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
  const result = await sendBlast("event", "Hello", ["ALL"]);
  expect(result).toEqual({
    success: false,
    sent: 500,
    summary: { accepted: 500, skipped: 0, failed: 0, uncertain: 0 },
  });
  expect(m.guests.mock.calls[1][0].skip).toBe(500);
  expect(JSON.stringify(result)).not.toContain("private-provider-secret");
  expect(JSON.stringify(warning.mock.calls)).not.toContain("private-provider-secret");
  expect(JSON.stringify(warning.mock.calls)).not.toContain("example.test");
});
