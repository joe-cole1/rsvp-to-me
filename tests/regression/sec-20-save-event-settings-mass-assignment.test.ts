// SEC-20 — Mass assignment in `saveEventSettings`.
//
// Bug (found 2026-06, security review): unlike addRSVP/addComment, this action
// had no Zod schema. `const { password, ...rest } = settings;
// db.event.update({ data: { ...rest, … } })` spread the raw client-supplied
// object straight into the update. Server actions do not enforce their TS
// parameter types at runtime, so a crafted call could write arbitrary Event
// scalar columns (status, slug, hostId, …) on an event the caller hosts.
//
// Fix: validate `settings` against `SaveEventSettingsSchema` (an explicit
// allow-list) before the update, so unknown keys are stripped.

import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockGetSession, mockEventFindUnique, mockEventUpdate } = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockEventFindUnique: vi.fn(),
  mockEventUpdate: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    event: { findUnique: mockEventFindUnique, update: mockEventUpdate },
  },
}));
vi.mock("@/lib/session", () => ({ getSession: mockGetSession }));
vi.mock("@/lib/rateLimit", () => ({ rateLimit: vi.fn() }));
vi.mock("@/lib/clientIp", () => ({ getClientIp: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({ get: vi.fn(), set: vi.fn(), delete: vi.fn() }),
}));
vi.mock("@/lib/email", () => ({
  sendRsvpConfirmationEmail: vi.fn(),
  sendBlastEmail: vi.fn(),
  sendEventInviteEmail: vi.fn(),
  sendApprovalEmail: vi.fn(),
}));
vi.mock("@/lib/sms", () => ({
  sendRsvpConfirmationSms: vi.fn(),
  sendSmsBlast: vi.fn(),
  sendApprovalSms: vi.fn(),
  sendEventInviteSms: vi.fn(),
}));

import { saveEventSettings } from "@/app/actions/event";

describe("SEC-20: saveEventSettings mass assignment", () => {
  beforeEach(() => {
    mockGetSession.mockReset();
    mockEventFindUnique.mockReset();
    mockEventUpdate.mockReset();
    mockGetSession.mockResolvedValue({ userId: "host1", role: "HOST" });
    mockEventFindUnique.mockResolvedValue({ hostId: "host1", slug: "my-party", coHosts: [] });
    mockEventUpdate.mockResolvedValue({});
  });

  it("strips non-allow-listed columns from the update payload", async () => {
    await saveEventSettings("evt1", {
      commentsEnabled: false,
      // Attacker-supplied columns that are NOT part of the allow-list:
      status: "DELETED",
      slug: "stolen-slug",
      hostId: "attacker",
    } as Parameters<typeof saveEventSettings>[1]);

    expect(mockEventUpdate).toHaveBeenCalledOnce();
    const data = mockEventUpdate.mock.calls[0][0].data;

    // The legitimate field is written.
    expect(data.commentsEnabled).toBe(false);
    // The smuggled columns must NOT reach the update.
    expect(data).not.toHaveProperty("status");
    expect(data).not.toHaveProperty("slug");
    expect(data).not.toHaveProperty("hostId");
  });
});
