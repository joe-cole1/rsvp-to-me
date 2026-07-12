// SEC-37 — guestEmail / guestPhone not format-validated in AddRsvpSchema.
//
// Bug (found 2026-07, [cd6748] OWASP audit): both fields were accepted as
// length-capped strings only, then `guestEmail` became a `User` upsert key and
// a mail recipient in addRSVP, and `guestPhone` a normalized User lookup key.
// An attacker could pollute the User table with junk identities and skew
// `linkRsvpsToUser` matching.
//
// Fix: `.email()` on guestEmail and the invite-flow phone shape (GuestPhoneRegex)
// on guestPhone in lib/schemas.ts.

import { describe, it, expect } from "vitest";
import { AddRsvpSchema } from "@/lib/schemas";

const base = {
  eventId: "evt-1",
  guestName: "Alice",
  status: "GOING" as const,
  plusOneCount: 0,
};

describe("SEC-37: AddRsvpSchema contact format validation", () => {
  it("rejects a non-email guestEmail", () => {
    expect(() => AddRsvpSchema.parse({ ...base, guestEmail: "not-an-email" })).toThrow();
    expect(() => AddRsvpSchema.parse({ ...base, guestEmail: "junk@" })).toThrow();
  });

  it("rejects a non-phone guestPhone", () => {
    expect(() => AddRsvpSchema.parse({ ...base, guestPhone: "call me maybe" })).toThrow();
    expect(() => AddRsvpSchema.parse({ ...base, guestPhone: "123" })).toThrow();
  });

  it("accepts valid contact info, lowercasing email", () => {
    const parsed = AddRsvpSchema.parse({
      ...base,
      guestEmail: "Alice@Example.com",
      guestPhone: "+1 (555) 123-4567",
    });
    expect(parsed.guestEmail).toBe("alice@example.com");
    expect(parsed.guestPhone).toBe("+1 (555) 123-4567");
  });

  it("still accepts empty / omitted contact fields (anonymous RSVP)", () => {
    expect(() => AddRsvpSchema.parse({ ...base, guestEmail: "", guestPhone: "" })).not.toThrow();
    expect(() => AddRsvpSchema.parse(base)).not.toThrow();
  });
});
