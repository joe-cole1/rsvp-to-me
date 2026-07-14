// SEC-34 — Visibility/password gate bypass on /e/[slug] sub-routes + guest
// RSVP data leak.
//
// Bug (found 2026-07, security review): the main event page /e/[slug] enforced
// a PRIVATE/password gate, but three sibling routes did not:
//   1. calendar.ics/route.ts served the full ICS (description, address,
//      virtual URL, timings) to any anonymous caller.
//   2. guests/page.tsx only checked guestListVis === "HOST_ONLY", so a PRIVATE
//      or password-protected event's guest list was viewable by anyone.
//   4. rsvp/page.tsx let anyone open the RSVP flow directly.
// Plus (3) guests/page.tsx serialized full RSVP rows — editToken, guestEmail,
// guestPhone, questionnaire answers — into the RSC payload for every visitor,
// even though the UI hid them.
//
// Fix: a shared lib/eventAccess.resolveEventAccess gate now backs all four
// routes, and lib/guestList.serializeGuestRsvp strips host-only fields for
// non-hosts. These tests would have failed against the pre-fix code (the gate
// helper did not exist and the serializer shipped every field).

import { describe, it, expect, vi, beforeEach } from "vitest";
import { getUnlockSignature } from "@/lib/crypto";
import { serializeGuestRsvp, type GuestListRsvpInput } from "@/lib/guestList";

const { mockGetSessionUser, mockRsvpFindFirst, mockCookieGet } = vi.hoisted(() => ({
  mockGetSessionUser: vi.fn(),
  mockRsvpFindFirst: vi.fn(),
  mockCookieGet: vi.fn(),
}));

vi.mock("@/lib/session-user", () => ({ getSessionUser: mockGetSessionUser }));
vi.mock("@/lib/db", () => ({ db: { rSVP: { findFirst: mockRsvpFindFirst } } }));
vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({ get: mockCookieGet }),
}));

import { resolveEventAccess } from "@/lib/eventAccess";

const HOST_ID = "host-1";
const COHOST_ID = "cohost-1";
const GUEST_ID = "guest-1";
const SLUG = "party";

function ev(overrides: Partial<Parameters<typeof resolveEventAccess>[0]> = {}) {
  return {
    id: "event-1",
    visibility: "PRIVATE",
    passwordHash: null,
    hostId: HOST_ID,
    coHosts: [{ userId: COHOST_ID }],
    ...overrides,
  };
}

function asUser(id: string, role: "GUEST" | "HOST" | "ADMIN" = "GUEST") {
  mockGetSessionUser.mockResolvedValue({
    id,
    email: `${id}@example.com`,
    name: null,
    avatarUrl: null,
    role,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetSessionUser.mockResolvedValue(null);
  mockRsvpFindFirst.mockResolvedValue(null);
  mockCookieGet.mockReturnValue(undefined);
});

describe("SEC-34: resolveEventAccess denies anonymous access to gated events", () => {
  it("blocks an anonymous visitor from a PRIVATE event with no password", async () => {
    const { decision, isHost } = await resolveEventAccess(ev(), SLUG);
    expect(decision).toBe("private-blocked");
    expect(isHost).toBe(false);
  });

  it("offers the password form on a PRIVATE event that has a password", async () => {
    const { decision } = await resolveEventAccess(ev({ passwordHash: "hash" }), SLUG);
    expect(decision).toBe("password");
  });

  it("offers the password form on a non-private password-protected event", async () => {
    const { decision } = await resolveEventAccess(
      ev({ visibility: "PUBLIC", passwordHash: "hash" }),
      SLUG
    );
    expect(decision).toBe("password");
  });

  it("grants a plain public event with no password", async () => {
    const { decision } = await resolveEventAccess(ev({ visibility: "PUBLIC" }), SLUG);
    expect(decision).toBe("granted");
  });
});

describe("SEC-34: resolveEventAccess grants legitimate access paths", () => {
  it("grants the host owner even on a PRIVATE password event", async () => {
    asUser(HOST_ID, "HOST");
    const { decision, isHost } = await resolveEventAccess(ev({ passwordHash: "hash" }), SLUG);
    expect(decision).toBe("granted");
    expect(isHost).toBe(true);
  });

  it("grants a co-host", async () => {
    asUser(COHOST_ID, "HOST");
    const { decision, isHost } = await resolveEventAccess(ev(), SLUG);
    expect(decision).toBe("granted");
    expect(isHost).toBe(true);
  });

  it("grants a moderating admin (?admin=1) but not without the flag", async () => {
    asUser("admin-1", "ADMIN");
    expect((await resolveEventAccess(ev(), SLUG, { admin: true })).decision).toBe("granted");
    expect((await resolveEventAccess(ev(), SLUG)).decision).toBe("private-blocked");
  });

  it("grants a valid RSVP token holder", async () => {
    mockRsvpFindFirst.mockResolvedValue({ id: "rsvp-9" }); // hasValidToken lookup
    const { decision } = await resolveEventAccess(ev(), SLUG, { token: "tok-123" });
    expect(decision).toBe("granted");
  });

  it("grants a logged-in guest who already has an RSVP on the event", async () => {
    asUser(GUEST_ID, "GUEST");
    mockRsvpFindFirst.mockResolvedValue({
      id: "rsvp-1",
      guestName: "Guest",
      editToken: "tok",
      status: "GOING",
      responded: true,
      approved: true,
      _count: { answers: 0 },
    });
    const { decision, isLoggedInGuest } = await resolveEventAccess(ev(), SLUG);
    expect(decision).toBe("granted");
    expect(isLoggedInGuest).toBe(true);
  });

  it("grants a visitor holding the signed unlock cookie", async () => {
    mockCookieGet.mockImplementation((name: string) =>
      name === `rsvp-unlocked-${SLUG}` ? { value: getUnlockSignature(SLUG) } : undefined
    );
    const { decision } = await resolveEventAccess(ev(), SLUG);
    expect(decision).toBe("granted");
  });

  it("does not grant on a forged unlock cookie", async () => {
    mockCookieGet.mockImplementation((name: string) =>
      name === `rsvp-unlocked-${SLUG}` ? { value: "not-the-signature" } : undefined
    );
    const { decision } = await resolveEventAccess(ev(), SLUG);
    expect(decision).toBe("private-blocked");
  });
});

describe("SEC-34: serializeGuestRsvp strips host-only fields for non-hosts", () => {
  const row: GuestListRsvpInput = {
    id: "rsvp-1",
    guestName: "Alice",
    guestEmail: "alice@example.com",
    guestPhone: "+15550001111",
    status: "GOING",
    plusOneCount: 1,
    note: "Can't wait!",
    createdAt: new Date("2026-07-04T00:00:00.000Z"),
    answers: [{ value: "Vegan", rsvpField: { label: "Diet" } }],
    plusOneGuests: [{ name: "Bob" }],
    editToken: "secret-edit-token",
    user: { avatarUrl: null },
    checkIn: { checkedInAt: new Date("2026-07-04T20:00:00.000Z"), checkedInBy: "host@example.com" },
  };

  it("omits editToken, email, phone, and answers for a non-host", () => {
    const out = serializeGuestRsvp(row, false);
    expect(out.editToken).toBe("");
    expect(out.guestEmail).toBeNull();
    expect(out.guestPhone).toBeNull();
    expect(out.answers).toEqual([]);
    expect(out.checkIn).toBeNull();
    // Public fields survive.
    expect(out.guestName).toBe("Alice");
    expect(out.note).toBe("Can't wait!");
    expect(out.plusOneGuests).toEqual(["Bob"]);
  });

  it("keeps host-only fields for a host", () => {
    const out = serializeGuestRsvp(row, true);
    expect(out.editToken).toBe("secret-edit-token");
    expect(out.guestEmail).toBe("alice@example.com");
    expect(out.guestPhone).toBe("+15550001111");
    expect(out.answers).toEqual([{ label: "Diet", value: "Vegan" }]);
    expect(out.checkIn).toEqual({
      checkedInAt: "2026-07-04T20:00:00.000Z",
      checkedInBy: "host@example.com",
    });
  });
});
