// #914: the Dutch catalog was missing 46 keys, including the now-required
// public RSVP verification email, so Dutch guests got that step in English.
//
// Root cause (found 2026-11): recent PRs added English, German and Spanish copy
// only, and the completeness test in tests/lib/i18n-catalogs.test.ts listed
// `de-DE` and `es-ES` by hand instead of every locale in messages/locales.json.
// The catalog loader falls back to English, so nothing failed at runtime.
//
// Fix: translate the keys and derive the completeness list from the registry.
// This case checks the guest-facing verification copy end to end in Dutch.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTransportContext } from "@/lib/notifications/transport";
import english from "@/messages/en-US.json";
import dutch from "@/messages/nl-NL.json";

const m = vi.hoisted(() => ({ sendMail: vi.fn() }));
vi.mock("nodemailer", () => ({
  default: { createTransport: () => ({ sendMail: m.sendMail, close: vi.fn() }) },
}));
vi.mock("@/lib/config", () => ({
  getSystemConfigMap: async () => ({
    email_provider: "smtp",
    smtp_host: "smtp.example.com",
    email_from: "site@example.com",
  }),
  isChannelEnabled: async () => true,
}));
vi.mock("@/lib/db", () => ({ db: { systemConfig: { findUnique: async () => null } } }));
vi.mock("@/lib/crypto", () => ({ decryptConfig: (value: string | undefined) => value ?? "" }));
vi.mock("@/lib/redis", () => ({ isRedisEnabled: () => false }));
import { createEmailNotificationAdapter } from "@/lib/email";

beforeEach(() => {
  vi.clearAllMocks();
  m.sendMail.mockResolvedValue({ accepted: ["anna@example.nl"], rejected: [] });
});
afterEach(() => vi.unstubAllGlobals());

describe("#914 Dutch RSVP verification copy", () => {
  it("ships native Dutch strings for the public RSVP verification step", () => {
    const englishFlow = english.Ui.Rsvp.RsvpFlow;
    const dutchFlow = dutch.Ui.Rsvp.RsvpFlow as Partial<typeof englishFlow>;
    for (const key of ["verifyContact", "verificationCode", "sendCode", "verifyCode"] as const) {
      expect(dutchFlow[key], key).toBeTypeOf("string");
      expect(dutchFlow[key], key).not.toBe(englishFlow[key]);
    }
  });

  it("sends the RSVP verification email in Dutch", async () => {
    const adapter = await createEmailNotificationAdapter();
    const [outcome] = await adapter.deliver(
      { kind: "connection_verification", purpose: "rsvp", id: "challenge", code: "12345678" },
      [{ recipientId: "challenge", destination: "anna@example.nl", locale: "nl-NL" }],
      createTransportContext()
    );
    expect(outcome.status).toBe("accepted");
    const mail = m.sendMail.mock.calls[0][0] as { subject: string; text: string };
    expect(mail.subject).toBe("Verifieer je RSVP-contact");
    expect(mail.subject).not.toBe(english.Notifications.rsvpVerificationSubject);
    expect(mail.text).toContain("12345678");
    expect(mail.text.replace(/\s+/g, " ")).toContain("De code verloopt na 15 minuten");
  });
});
