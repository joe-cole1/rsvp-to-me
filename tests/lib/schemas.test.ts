import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import {
  SendMagicLinkSchema,
  RegisterHostSchema,
  AddCommentSchema,
  CreateEventSchema,
  AddRsvpSchema,
  UpdateRsvpSchema,
} from "@/lib/schemas";

describe("SendMagicLinkSchema", () => {
  it("accepts a valid email string", () => {
    const res = SendMagicLinkSchema.safeParse({ identifier: "joe@example.com" });
    expect(res.success).toBe(true);
  });

  it("accepts a valid phone string", () => {
    const res = SendMagicLinkSchema.safeParse({ identifier: "+15551234567" });
    expect(res.success).toBe(true);
  });

  it("rejects input shorter than 3 chars", () => {
    const res = SendMagicLinkSchema.safeParse({ identifier: "ab" });
    expect(res.success).toBe(false);
  });

  it("rejects input longer than 100 chars", () => {
    const res = SendMagicLinkSchema.safeParse({ identifier: "a".repeat(101) });
    expect(res.success).toBe(false);
  });

  it("trims whitespace from identifier", () => {
    const res = SendMagicLinkSchema.safeParse({ identifier: "  joe@example.com  " });
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.identifier).toBe("joe@example.com");
    }
  });
});

describe("RegisterHostSchema", () => {
  it("accepts valid email, name, inviteCode", () => {
    const res = RegisterHostSchema.safeParse({
      email: "joe@example.com",
      name: "Joe",
      inviteCode: "secret",
    });
    expect(res.success).toBe(true);
  });

  it("lowercases email", () => {
    const res = RegisterHostSchema.safeParse({
      email: "JOE@EXAMPLE.COM",
      name: "Joe",
      inviteCode: "secret",
    });
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.email).toBe("joe@example.com");
    }
  });

  it("rejects invalid email format", () => {
    const res = RegisterHostSchema.safeParse({
      email: "invalid-email",
      name: "Joe",
      inviteCode: "secret",
    });
    expect(res.success).toBe(false);
  });

  it("rejects empty name", () => {
    const res = RegisterHostSchema.safeParse({
      email: "joe@example.com",
      name: "",
      inviteCode: "secret",
    });
    expect(res.success).toBe(false);
  });

  it("accepts empty inviteCode or missing inviteCode", () => {
    const res1 = RegisterHostSchema.safeParse({
      email: "joe@example.com",
      name: "Joe",
      inviteCode: "",
    });
    expect(res1.success).toBe(true);

    const res2 = RegisterHostSchema.safeParse({
      email: "joe@example.com",
      name: "Joe",
    });
    expect(res2.success).toBe(true);
  });
});

describe("AddCommentSchema", () => {
  it("accepts all required fields", () => {
    const res = AddCommentSchema.safeParse({
      eventId: "evt-123",
      guestName: "Guest",
      body: "Hello",
    });
    expect(res.success).toBe(true);
  });

  it("rejects empty guestName", () => {
    const res = AddCommentSchema.safeParse({
      eventId: "evt-123",
      guestName: "",
      body: "Hello",
    });
    expect(res.success).toBe(false);
  });

  it("rejects body over 5000 chars", () => {
    const res = AddCommentSchema.safeParse({
      eventId: "evt-123",
      guestName: "Guest",
      body: "a".repeat(5001),
    });
    expect(res.success).toBe(false);
  });
});

describe("CreateEventSchema", () => {
  it("accepts valid full input", () => {
    const res = CreateEventSchema.safeParse({
      title: "Wine Night",
      startDate: "2026-12-01",
      startTime: "19:00",
      timezone: "America/New_York",
      locationType: "PHYSICAL",
      visibility: "UNLISTED",
    });
    expect(res.success).toBe(true);
  });

  it("rejects invalid startDate pattern", () => {
    const res = CreateEventSchema.safeParse({
      title: "Wine Night",
      startDate: "12-01-2026",
      startTime: "19:00",
    });
    expect(res.success).toBe(false);
  });

  it("defaults timezone, locationType, and visibility", () => {
    const res = CreateEventSchema.safeParse({
      title: "Wine Night",
      startDate: "2026-12-01",
      startTime: "19:00",
    });
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.timezone).toBe("America/New_York");
      expect(res.data.locationType).toBe("PHYSICAL");
      expect(res.data.visibility).toBe("UNLISTED");
    }
  });
});

describe("AddRsvpSchema", () => {
  it("accepts required fields only", () => {
    const res = AddRsvpSchema.safeParse({
      eventId: "evt-123",
      guestName: "Bob",
      status: "GOING",
    });
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.plusOneCount).toBe(0);
    }
  });

  it("rejects plusOneCount > 10", () => {
    const res = AddRsvpSchema.safeParse({
      eventId: "evt-123",
      guestName: "Bob",
      status: "GOING",
      plusOneCount: 11,
    });
    expect(res.success).toBe(false);
  });
});

describe("UpdateRsvpSchema", () => {
  it("accepts valid status + plusOneCount", () => {
    const res = UpdateRsvpSchema.safeParse({
      status: "MAYBE",
      plusOneCount: 2,
    });
    expect(res.success).toBe(true);
  });
});

describe("Zod schemas — property tests", () => {
  it("safeParse never throws for any input shape", () => {
    const schemas = [
      SendMagicLinkSchema,
      RegisterHostSchema,
      AddCommentSchema,
      CreateEventSchema,
      AddRsvpSchema,
      UpdateRsvpSchema,
    ];
    fc.assert(
      fc.property(fc.anything(), (input) => {
        for (const schema of schemas) {
          // Must return a result object, never throw
          const result = schema.safeParse(input);
          expect(typeof result.success).toBe("boolean");
        }
      })
    );
  });

  it("AddRsvpSchema accepts any valid status enum value", () => {
    const validStatuses = ["GOING", "MAYBE", "NO"] as const;
    fc.assert(
      fc.property(
        fc.constantFrom(...validStatuses),
        fc.string({ minLength: 1, maxLength: 100 }).filter((s) => s.trim().length > 0),
        fc.string({ minLength: 1 }).filter((s) => s.trim().length > 0),
        (status, guestName, eventId) => {
          const res = AddRsvpSchema.safeParse({ eventId, guestName, status });
          expect(res.success).toBe(true);
        }
      )
    );
  });

  it("CreateEventSchema rejects arbitrary strings for startDate", () => {
    fc.assert(
      fc.property(
        fc.string().filter((s) => !/^\d{4}-\d{2}-\d{2}$/.test(s)),
        (badDate) => {
          const res = CreateEventSchema.safeParse({
            title: "Test",
            startDate: badDate,
            startTime: "10:00",
          });
          expect(res.success).toBe(false);
        }
      )
    );
  });
});
