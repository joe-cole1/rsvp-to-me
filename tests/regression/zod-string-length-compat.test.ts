/**
 * Found during the September 2026 Zod update: 4.5+ counts code points for
 * string bounds, silently widening existing caps for emoji and tightening
 * the sign-in minimum. Keep our JavaScript/HTML UTF-16 length contract.
 */
import { describe, expect, it, vi } from "vitest";
import {
  AddCommentSchema,
  AddRsvpSchema,
  AddWalkInSchema,
  CreateEventSchema,
  HttpUrlSchema,
  RegisterHostSchema,
  SaveEventSettingsSchema,
  SendMagicLinkSchema,
  UpdateRsvpSchema,
} from "@/lib/schemas";
import { templateOverridesSchema } from "@/lib/email-settings";

vi.mock("@/lib/db", () => ({ db: {} }));

const boundedStrings = [
  ["sign-in identifier", SendMagicLinkSchema.shape.identifier, 100],
  ["host name", RegisterHostSchema.shape.name, 100],
  ["invite code", RegisterHostSchema.shape.inviteCode, 100],
  ["comment author", AddCommentSchema.shape.guestName, 100],
  ["comment body", AddCommentSchema.shape.body, 5000],
  ["event title", CreateEventSchema.shape.title, 200],
  ["event description", CreateEventSchema.shape.description, 10000],
  ["event timezone", CreateEventSchema.shape.timezone, 100],
  ["location name", CreateEventSchema.shape.locationName, 200],
  ["location address", CreateEventSchema.shape.locationAddress, 500],
  ["virtual URL", HttpUrlSchema, 1000],
  ["RSVP name", AddRsvpSchema.shape.guestName, 100],
  ["RSVP note", AddRsvpSchema.shape.note, 1000],
  ["edited RSVP note", UpdateRsvpSchema.shape.note, 1000],
  ["host display name", SaveEventSettingsSchema.shape.hostDisplayName, 100],
  ["walk-in name", AddWalkInSchema.shape.guestName, 100],
  ["email subject", templateOverridesSchema.shape.subject, 200],
  ["email body", templateOverridesSchema.shape.body, 5000],
] as const;

describe("validation string length compatibility", () => {
  it.each(boundedStrings)("%s preserves its existing maximum", (_name, schema, maximum) => {
    for (const unit of ["a", "😀", "a😀", "e\u0301", "🧑‍🍼", "\ud83d"]) {
      const boundary =
        unit.repeat(Math.floor(maximum / unit.length)) + "a".repeat(maximum % unit.length);
      expect(schema.safeParse(boundary).success).toBe(true);
      expect(schema.safeParse(boundary + "a").success).toBe(false);
    }
  });

  it("measures the sign-in minimum after trimming, in UTF-16 units", () => {
    expect(SendMagicLinkSchema.parse({ identifier: "  a😀  " })).toEqual({
      identifier: "a😀",
    });
    const result = SendMagicLinkSchema.safeParse({ identifier: "  😀  " });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toEqual([
        expect.objectContaining({
          code: "too_small",
          origin: "string",
          minimum: 3,
          inclusive: true,
          path: ["identifier"],
        }),
      ]);
    }
  });

  it.each([
    ["new RSVP", AddRsvpSchema.shape.plusOneGuestNames],
    ["edited RSVP", UpdateRsvpSchema.shape.plusOneGuestNames],
  ] as const)("%s checks each plus-one name after trimming", (_name, schema) => {
    const boundary = "😀".repeat(50);
    expect(schema.parse(["  " + boundary + "  "])).toEqual([boundary]);
    const result = schema.safeParse(["Guest", boundary + "a"]);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toEqual([
        expect.objectContaining({ code: "too_big", maximum: 100, path: [1] }),
      ]);
    }
  });

  it.each([
    ["new RSVP", AddRsvpSchema],
    ["edited RSVP", UpdateRsvpSchema],
  ] as const)("%s preserves SEC-38 answer-key and value caps", (_name, schema) => {
    const base = { eventId: "evt-1", guestName: "Guest", status: "GOING" };
    const key = "😀".repeat(50);
    const answer = "😀".repeat(1000);
    expect(schema.safeParse({ ...base, answers: { [key]: answer } }).success).toBe(true);

    for (const overlongKey of ["a".repeat(101), key + "a"]) {
      const result = schema.safeParse({ ...base, answers: { [overlongKey]: "OK" } });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues).toEqual([
          expect.objectContaining({
            code: "invalid_key",
            path: ["answers", overlongKey],
            issues: [expect.objectContaining({ code: "too_big", origin: "string", maximum: 100 })],
          }),
        ]);
      }
    }

    const result = schema.safeParse({ ...base, answers: { question: answer + "a" } });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toEqual([
        expect.objectContaining({
          code: "too_big",
          origin: "string",
          maximum: 2000,
          inclusive: true,
          path: ["answers", "question"],
          message: "Too big: expected string to have <=2000 characters",
        }),
      ]);
    }
  });

  it("keeps trimming and header sanitization in their original order", () => {
    const name = "😀".repeat(50);
    expect(
      AddRsvpSchema.parse({
        eventId: "evt-1",
        guestName: "  " + name + "  ",
        status: "GOING",
      }).guestName
    ).toBe(name);
    expect(
      templateOverridesSchema.parse({ subject: " Hi\r\nBcc: other@example.com " }).subject
    ).toBe("Hi Bcc: other@example.com");
    // Email subjects are bounded before their transform; surrounding whitespace counts.
    expect(templateOverridesSchema.safeParse({ subject: " " + "😀".repeat(100) }).success).toBe(
      false
    );
  });
});
