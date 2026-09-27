import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  find: vi.fn(),
  update: vi.fn(),
  revalidate: vi.fn(),
}));
vi.mock("@/lib/db", () => ({ db: { event: { findUnique: mocks.find, update: mocks.update } } }));
vi.mock("@/lib/session", () => ({ getSession: mocks.session }));
vi.mock("@/lib/captcha", () => ({ assertCaptcha: vi.fn() }));
vi.mock("@/lib/activity", () => ({ logActivity: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));

import { saveEventSettings } from "@/app/actions/event/settings";

const preferences = {
  guestGoingList: "EXPANDED",
  guestGoingCount: "EXACT",
  guestMaybeList: "COLLAPSED",
  guestMaybeCount: "HIDDEN",
  guestDeclinedList: "COLLAPSED",
  guestDeclinedCount: "CAPPED",
} as const;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.find.mockResolvedValue({
    id: "event-1",
    slug: "party",
    hostId: "host-1",
    coHosts: [{ userId: "cohost-1" }],
  });
  mocks.update.mockResolvedValue({});
});

describe("saving guest RSVP display", () => {
  it.each(["host-1", "cohost-1"])(
    "saves presentation choices for %s and refreshes both views",
    async (userId) => {
      mocks.session.mockResolvedValue({ userId, role: "HOST" });
      await expect(saveEventSettings("event-1", preferences)).resolves.toEqual({ success: true });
      expect(mocks.update).toHaveBeenCalledExactlyOnceWith({
        where: { id: "event-1" },
        data: { ...preferences, rsvpDeadline: undefined },
      });
      expect(mocks.revalidate).toHaveBeenCalledWith("/e/party");
      expect(mocks.revalidate).toHaveBeenCalledWith("/e/party/guests");
      expect(mocks.revalidate).toHaveBeenCalledWith("/e/party/settings");
    }
  );

  it("rejects display settings from a guest", async () => {
    mocks.session.mockResolvedValue({ userId: "guest-1", role: "GUEST" });
    await expect(saveEventSettings("event-1", preferences)).rejects.toThrow("Forbidden");
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("rejects invalid values before writing preferences", async () => {
    mocks.session.mockResolvedValue({ userId: "host-1", role: "HOST" });
    await expect(saveEventSettings("event-1", { guestGoingCount: "CAPPED" })).rejects.toThrow();
    expect(mocks.update).not.toHaveBeenCalled();
  });
});
