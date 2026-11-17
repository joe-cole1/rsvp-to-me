// Regression (01a1a105 QC): verification challenges were kept forever.
//
// Found: 2026-11-05 local QC. Nothing deleted `NotificationChallenge` rows, so used and
// expired challenges kept private destinations (and the RSVP's previous contact)
// indefinitely. The existing cleanup job now purges them a day after they stop mattering.
import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ deleteMany: vi.fn(), rsvpDeleteMany: vi.fn() }));
vi.mock("@/lib/db", () => ({
  db: {
    notificationChallenge: { deleteMany: m.deleteMany },
    rsvpContactChallenge: { deleteMany: m.rsvpDeleteMany },
  },
}));
import { purgeNotificationChallenges } from "@/lib/notifications/lifecycle";

beforeEach(() => {
  m.deleteMany.mockResolvedValue({ count: 3 });
  m.rsvpDeleteMany.mockResolvedValue({ count: 2 });
});

describe("verification challenge retention", () => {
  it("deletes challenges used or expired more than a day ago", async () => {
    const now = new Date("2026-11-05T12:00:00Z");
    expect(await purgeNotificationChallenges(now)).toBe(5);
    const cutoff = new Date("2026-11-04T12:00:00Z");
    expect(m.rsvpDeleteMany).toHaveBeenCalledWith({
      where: { OR: [{ usedAt: { lt: cutoff } }, { expiresAt: { lt: cutoff } }] },
    });
    expect(m.deleteMany).toHaveBeenCalledWith({
      where: { OR: [{ usedAt: { lt: cutoff } }, { expiresAt: { lt: cutoff } }] },
    });
  });
});
