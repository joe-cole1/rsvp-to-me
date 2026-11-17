// #792: RSVP proof messages contain only a code and proof instructions, never
// an invitation credential or a claim that verification saved a response.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTransportContext } from "@/lib/notifications/transport";
const m = vi.hoisted(() => ({ sendMail: vi.fn(), fetch: vi.fn() }));
vi.mock("nodemailer", () => ({
  default: { createTransport: () => ({ sendMail: m.sendMail, close: vi.fn() }) },
}));
vi.mock("@/lib/config", () => ({
  getSystemConfigMap: async () => ({
    email_provider: "smtp",
    smtp_host: "smtp.example.com",
    email_from: "site@example.com",
    twilio_account_sid: "ACfixture",
    twilio_auth_token: "fixture-token",
    twilio_phone_number: "+15559999999",
  }),
  isChannelEnabled: async () => true,
}));
vi.mock("@/lib/db", () => ({ db: { systemConfig: { findUnique: async () => null } } }));
vi.mock("@/lib/crypto", () => ({ decryptConfig: (value: string | undefined) => value ?? "" }));
vi.mock("@/lib/redis", () => ({ isRedisEnabled: () => false }));
import { createEmailNotificationAdapter } from "@/lib/email";
import { createSmsNotificationAdapter } from "@/lib/sms";
const message = {
  kind: "connection_verification" as const,
  purpose: "rsvp" as const,
  id: "challenge",
  code: "12345678",
};
beforeEach(() => {
  vi.clearAllMocks();
  m.sendMail.mockResolvedValue({ accepted: ["alice@example.com"], rejected: [] });
  m.fetch.mockResolvedValue(new Response(JSON.stringify({ sid: "SMfixture" }), { status: 201 }));
  vi.stubGlobal("fetch", m.fetch);
});
afterEach(() => vi.unstubAllGlobals());
describe("#792 proof delivery copy", () => {
  it("renders an email code with no private RSVP link", async () => {
    const adapter = await createEmailNotificationAdapter();
    expect(
      (
        await adapter.deliver(
          message,
          [{ recipientId: "challenge", destination: "alice@example.com", locale: "en-US" }],
          createTransportContext()
        )
      )[0].status
    ).toBe("accepted");
    const mail = m.sendMail.mock.calls[0][0];
    expect(mail.subject).toBe("Verify your RSVP contact");
    expect(mail.text).toContain(message.code);
    expect(mail.text.replace(/\s+/g, " ")).toContain("does not save an RSVP or sign you in");
    expect(mail.html).not.toContain("?token=");
    expect(mail.text).not.toContain("You're in!");
  });
  it("renders the SMS proof instructions without a private link", async () => {
    const adapter = await createSmsNotificationAdapter();
    expect(
      (
        await adapter.deliver(
          message,
          [{ recipientId: "challenge", destination: "+15551234567", locale: "en-US" }],
          createTransportContext()
        )
      )[0].status
    ).toBe("accepted");
    const body = new URLSearchParams(m.fetch.mock.calls[0][1].body).get("Body");
    expect(body).toContain(message.code);
    expect(body).toContain("does not save an RSVP or sign you in");
    expect(body).not.toContain("?token=");
  });
});
