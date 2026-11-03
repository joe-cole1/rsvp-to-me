import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTransportContext, TRANSPORT_TIMEOUT_MS } from "@/lib/notifications/transport";
import type { EventUpdateMessage, DeliveryTarget } from "@/lib/notifications/types";

const mocks = vi.hoisted(() => ({
  config: {} as Record<string, string>,
  enabled: { email: true, sms: true },
  sendMail: vi.fn(),
  close: vi.fn(),
  fetch: vi.fn(),
}));
vi.mock("nodemailer", () => ({
  default: { createTransport: () => ({ sendMail: mocks.sendMail, close: mocks.close }) },
}));
vi.mock("@/lib/config", () => ({
  getSystemConfigMap: async () => mocks.config,
  isChannelEnabled: async (channel: "email" | "sms") => mocks.enabled[channel],
}));
vi.mock("@/lib/db", () => ({ db: { systemConfig: { findUnique: async () => null } } }));
vi.mock("@/lib/crypto", () => ({ decryptConfig: (value: string | undefined) => value ?? "" }));
vi.mock("@/lib/redis", () => ({ isRedisEnabled: () => false }));

import { createEmailNotificationAdapter } from "@/lib/email";
import { createSmsNotificationAdapter } from "@/lib/sms";

const message: EventUpdateMessage = {
  kind: "event_update",
  id: "update-1",
  eventSlug: "party",
  eventTitle: "Party {title}",
  body: "Host's {custom} text",
  hostName: "Host",
  replyTo: "host@example.com",
  theme: {
    baseTheme: "DARK",
    gradientFrom: "#7c3aed",
    gradientTo: "#1e40af",
    accentColor: "#fe00fe",
  },
};
const emailTargets: DeliveryTarget[] = [
  { recipientId: "guest-a", destination: "a@example.com", locale: "en-US" },
  { recipientId: "guest-b", destination: "b@example.com", locale: "en-US" },
];
const phoneTargets: DeliveryTarget[] = [
  { recipientId: "guest-a", destination: "+1 (555) 000-1111", locale: "nl-NL" },
];
const ack = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
beforeEach(() => {
  vi.clearAllMocks();
  mocks.config = {
    email_provider: "smtp",
    smtp_host: "smtp.example.com",
    email_from: "Site <site@example.com>",
    twilio_account_sid: "ACfixture",
    twilio_auth_token: "fixture-token",
    twilio_phone_number: "+15559999999",
  };
  mocks.enabled = { email: true, sms: true };
  mocks.sendMail.mockResolvedValue({
    accepted: ["site@example.com", "a@example.com", "b@example.com"],
    rejected: [],
  });
  mocks.fetch.mockResolvedValue(ack({ ok: true }));
  vi.stubGlobal("fetch", mocks.fetch);
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
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("result-bearing email delivery", () => {
  it("keeps BCC privacy, theme, locale, reply-to and authored text", async () => {
    const adapter = await createEmailNotificationAdapter();
    const outcomes = await adapter.deliver(
      message,
      emailTargets.map((target) => ({ ...target, locale: "nl-NL" })),
      createTransportContext()
    );
    expect(outcomes.map((outcome) => outcome.status)).toEqual(["accepted", "accepted"]);
    expect(mocks.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "Site <site@example.com>",
        bcc: ["a@example.com", "b@example.com"],
        replyTo: "host@example.com",
        html: expect.stringContaining('lang="nl-NL"'),
        text: expect.stringContaining("Host's {custom} text"),
      })
    );
    expect(mocks.sendMail.mock.calls[0][0].html).toContain("#fe00fe");
  });

  it("distinguishes partial SMTP acceptance, rejection and missing acknowledgement", async () => {
    mocks.sendMail.mockResolvedValue({ accepted: ["A@example.com"], rejected: ["b@example.com"] });
    const adapter = await createEmailNotificationAdapter();
    expect(
      (await adapter.deliver(message, emailTargets, createTransportContext())).map(
        (outcome) => outcome.status
      )
    ).toEqual(["accepted", "failed"]);
    mocks.sendMail.mockResolvedValue({ messageId: "not-a-recipient-ack" });
    expect(
      (await adapter.deliver(message, emailTargets, createTransportContext())).map(
        (outcome) => outcome.status
      )
    ).toEqual(["uncertain", "uncertain"]);
  });

  it("classifies explicit SMTP refusal separately from a lost connection", async () => {
    const adapter = await createEmailNotificationAdapter();
    mocks.sendMail.mockRejectedValue({ responseCode: 550, message: "private response" });
    expect((await adapter.deliver(message, emailTargets, createTransportContext()))[0].status).toBe(
      "failed"
    );
    mocks.sendMail.mockRejectedValue(new Error("connection lost after DATA"));
    expect((await adapter.deliver(message, emailTargets, createTransportContext()))[0].status).toBe(
      "uncertain"
    );
  });

  it("closes a timed-out SMTP request and reports uncertainty", async () => {
    vi.useFakeTimers();
    mocks.sendMail.mockImplementation(() => new Promise(() => {}));
    const adapter = await createEmailNotificationAdapter();
    const result = adapter.deliver(message, emailTargets, createTransportContext());
    await vi.advanceTimersByTimeAsync(TRANSPORT_TIMEOUT_MS);
    expect((await result)[0].status).toBe("uncertain");
    expect(mocks.close).toHaveBeenCalledOnce();
  });

  it("does not count disabled or console-only transport as available", async () => {
    mocks.enabled.email = false;
    expect((await createEmailNotificationAdapter()).available).toBe(false);
    mocks.enabled.email = true;
    mocks.config = { email_provider: "console" };
    expect((await createEmailNotificationAdapter()).available).toBe(false);
  });

  it("rejects unsafe worker URLs and invalid recipient destinations", async () => {
    mocks.config = {
      email_provider: "cloudflare",
      cloudflare_worker_email_url: "http://127.0.0.1",
      cloudflare_worker_api_secret: "fixture",
    };
    expect((await createEmailNotificationAdapter()).available).toBe(false);
    mocks.config = { smtp_host: "smtp.example.com" };
    const adapter = await createEmailNotificationAdapter();
    expect(
      (
        await adapter.deliver(
          message,
          [{ ...emailTargets[0], destination: "invalid\r\nBcc: victim@example.com" }],
          createTransportContext()
        )
      )[0].status
    ).toBe("skipped");
    expect(mocks.sendMail).not.toHaveBeenCalled();
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  function worker() {
    mocks.config.email_provider = "cloudflare";
    mocks.config.cloudflare_worker_email_url = "https://worker.example.com";
    mocks.config.cloudflare_worker_api_secret = "fixture-worker-secret";
  }

  it("requires the worker's acknowledgement and carries a cancellation signal", async () => {
    worker();
    const adapter = await createEmailNotificationAdapter();
    expect((await adapter.deliver(message, emailTargets, createTransportContext()))[0].status).toBe(
      "accepted"
    );
    expect(mocks.sendMail).not.toHaveBeenCalled();
    expect(mocks.fetch).toHaveBeenCalledWith(
      "https://worker.example.com/send",
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
    mocks.fetch.mockResolvedValue(ack({ unexpected: true }));
    expect((await adapter.deliver(message, emailTargets, createTransportContext()))[0].status).toBe(
      "uncertain"
    );
    expect(mocks.sendMail).not.toHaveBeenCalled();
  });

  it("uses configured SMTP fallback only after definite worker rejection", async () => {
    worker();
    mocks.fetch.mockResolvedValue(ack({ error: "rejected" }, 401));
    const adapter = await createEmailNotificationAdapter();
    expect((await adapter.deliver(message, emailTargets, createTransportContext()))[0].status).toBe(
      "accepted"
    );
    expect(mocks.sendMail).toHaveBeenCalledOnce();
  });

  it.each([408, 500, 502])("does not repeat HTTP %s through SMTP", async (status) => {
    worker();
    mocks.fetch.mockResolvedValue(ack({ error: "private provider data" }, status));
    const outcomes = await (
      await createEmailNotificationAdapter()
    ).deliver(message, emailTargets, createTransportContext());
    expect(outcomes[0].status).toBe("uncertain");
    expect(mocks.sendMail).not.toHaveBeenCalled();
    expect(JSON.stringify(outcomes)).not.toContain("private");
  });

  it("does not repeat a lost HTTP response through SMTP", async () => {
    worker();
    mocks.fetch.mockRejectedValue(new Error("private provider payload"));
    expect(
      (
        await (
          await createEmailNotificationAdapter()
        ).deliver(message, emailTargets, createTransportContext())
      )[0].status
    ).toBe("uncertain");
    expect(mocks.sendMail).not.toHaveBeenCalled();
  });

  it("handles Cloudflare REST acknowledgements without altering the Worker protocol", async () => {
    mocks.config.email_provider = "cloudflare_api";
    mocks.config.cloudflare_account_id = "account-fixture";
    mocks.config.cloudflare_api_token = "fixture-api-token";
    mocks.fetch.mockResolvedValue(ack({ success: true, result: {} }));
    expect(
      (
        await (
          await createEmailNotificationAdapter()
        ).deliver(message, emailTargets, createTransportContext())
      )[0].status
    ).toBe("accepted");
    expect(mocks.fetch.mock.calls[0][0]).toContain("/accounts/account-fixture/email/sending/send");
    expect(mocks.sendMail).not.toHaveBeenCalled();
  });
});

describe("result-bearing SMS delivery", () => {
  it("submits normalized event contacts with localized copy and literal authored text", async () => {
    mocks.fetch.mockResolvedValue(ack({ sid: "SMfixture", status: "queued" }, 201));
    const adapter = await createSmsNotificationAdapter();
    expect(adapter.available).toBe(true);
    expect((await adapter.deliver(message, phoneTargets, createTransportContext()))[0].status).toBe(
      "accepted"
    );
    const form = mocks.fetch.mock.calls[0][1].body as URLSearchParams;
    expect(form.get("To")).toBe("+15550001111");
    expect(form.get("Body")).toContain("Host's {custom} text");
    expect(form.get("Body")).toContain("Party {title}");
    expect(form.get("Body")).toContain("Host");
  });

  it("reports individual failures rather than the requested-recipient count", async () => {
    mocks.fetch
      .mockResolvedValueOnce(ack({ sid: "SMfixture", status: "queued" }, 201))
      .mockResolvedValueOnce(ack({ error: "rejected" }, 400));
    const outcomes = await (
      await createSmsNotificationAdapter()
    ).deliver(
      message,
      [
        ...phoneTargets,
        { ...phoneTargets[0], recipientId: "guest-b", destination: "+15550002222" },
      ],
      createTransportContext()
    );
    expect(outcomes.map((outcome) => outcome.status)).toEqual(["accepted", "failed"]);
  });

  it.each([
    [ack({ error: "rejected" }, 429), "failed"],
    [ack({ error: "unknown" }, 503), "uncertain"],
    [ack({}), "uncertain"],
    [ack({ sid: "SMfixture", status: "failed" }), "failed"],
  ])("classifies SMS provider responses truthfully", async (response, status) => {
    mocks.fetch.mockResolvedValue(response);
    expect(
      (
        await (
          await createSmsNotificationAdapter()
        ).deliver(message, phoneTargets, createTransportContext())
      )[0].status
    ).toBe(status);
  });

  it("checks readiness and rejects invalid destinations", async () => {
    mocks.config.twilio_phone_number = "";
    expect((await createSmsNotificationAdapter()).available).toBe(false);
    mocks.config.twilio_phone_number = "+15559999999";
    mocks.enabled.sms = false;
    expect((await createSmsNotificationAdapter()).available).toBe(false);
    mocks.enabled.sms = true;
    expect(
      (
        await (
          await createSmsNotificationAdapter()
        ).deliver(
          message,
          [{ ...phoneTargets[0], destination: "not a phone" }],
          createTransportContext()
        )
      )[0].status
    ).toBe("skipped");
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
});
