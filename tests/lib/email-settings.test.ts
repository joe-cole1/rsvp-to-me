import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockFindUnique } = vi.hoisted(() => ({ mockFindUnique: vi.fn() }));

vi.mock("@/lib/db", () => ({
  db: { systemConfig: { findUnique: mockFindUnique } },
}));

import {
  getEmailTemplateSettings,
  mergeWithDefaults,
  templateConfigKey,
  templateOverridesSchema,
} from "@/lib/email-settings";
import { EMAIL_TEMPLATE_META } from "@/emails/registry";

beforeEach(() => {
  vi.clearAllMocks();
  mockFindUnique.mockResolvedValue(null);
});

describe("lib/email-settings.ts", () => {
  it("strips CR/LF from subjects (header-injection guard)", () => {
    const parsed = templateOverridesSchema.parse({ subject: "Hi\r\nBcc: evil@example.com" });
    expect(parsed.subject).toBe("Hi Bcc: evil@example.com");
  });

  it("rejects unknown keys and oversized copy", () => {
    expect(templateOverridesSchema.safeParse({ nope: true }).success).toBe(false);
    expect(templateOverridesSchema.safeParse({ body: "x".repeat(5001) }).success).toBe(false);
  });

  it("reads overrides from the per-template SystemConfig row", async () => {
    mockFindUnique.mockResolvedValue({
      key: templateConfigKey("invite"),
      value: JSON.stringify({ subject: "Party time: {eventTitle}", showMapLink: false }),
    });
    const settings = await getEmailTemplateSettings("invite");
    expect(mockFindUnique).toHaveBeenCalledWith({ where: { key: "email_template_invite" } });
    expect(settings.subject).toBe("Party time: {eventTitle}");
    expect(settings.showMapLink).toBe(false);
  });

  it("falls back to no overrides on malformed JSON or invalid shape", async () => {
    mockFindUnique.mockResolvedValue({ key: "email_template_invite", value: "{not json" });
    expect(await getEmailTemplateSettings("invite")).toEqual({});
    mockFindUnique.mockResolvedValue({
      key: "email_template_blast",
      value: JSON.stringify({ subject: 42 }),
    });
    expect(await getEmailTemplateSettings("blast")).toEqual({});
  });

  it("merges overrides over registry defaults", () => {
    expect(mergeWithDefaults("invite", {})).toEqual({
      subject: EMAIL_TEMPLATE_META.invite.defaultSubject,
      body: EMAIL_TEMPLATE_META.invite.defaultBody,
    });
    expect(mergeWithDefaults("invite", { subject: "Custom" }).subject).toBe("Custom");
  });

  it("ignores body overrides for templates whose body is not editable", () => {
    expect(mergeWithDefaults("blast", { body: "should not apply" }).body).toBe("");
  });
});
