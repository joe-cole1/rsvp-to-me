// Regression (01a1a105 QC): upgrading widened legacy opt-outs to every message.
//
// Found: 2026-11-05 local QC. The old profile said transactional messages (RSVP
// confirmations) are always sent; its "Email/SMS Blasts & Reminders" switches covered
// reminders and host blasts, and its channel choice covered event updates. The migration
// turned those switches into hard channel blocks and derived RSVP eligibility from them, so a
// guest who opted out of email blasts lost confirmations with their edit link, approval
// decisions and (as an organizer) host alerts; an SMS-preference guest with only an email
// contact got no confirmation at all. Migrated profiles now carry those limits as
// update/reminder category choices, and RSVP contacts stay eligible.
// The real SQL is exercised in tests/integration/lib/notification-migration.test.ts.
import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ settings: vi.fn() }));
vi.mock("@/lib/db", () => ({
  db: {
    notificationSettings: { findMany: m.settings },
    notificationConnection: { findMany: async () => [] },
    notificationBinding: { findMany: async () => [] },
  },
}));
import { resolveRecipients, type RecipientRow } from "@/lib/notifications/resolve";

const user = {
  notificationChannel: "BOTH" as const,
  emailNotifications: false,
  smsNotifications: true,
  preferredLocale: "en-US",
};
const row: RecipientRow = {
  id: "rsvp",
  userId: "user",
  guestEmail: "guest@example.com",
  guestPhone: "+15550001111",
  user,
};
// What the migration writes for a Both user who had opted out of email blasts.
const migrated = (channels: string[], restricted: string[]) => ({
  id: "profile:user",
  channels,
  blockedChannels: [],
  categories: ["updates", "reminders"].map((category) => ({ category, channels: restricted })),
});
beforeEach(() => m.settings.mockResolvedValue([migrated(["email", "sms"], ["sms"])]));

describe("legacy opt-out scope after upgrade", () => {
  it("still sends confirmations by email after an email blast opt-out", async () => {
    const [recipient] = await resolveRecipients("confirmations", [row], undefined, false);
    expect(recipient.policy.channels).toEqual(["email", "sms"]);
    expect(recipient.destinations.email).toBe(row.guestEmail);
  });
  it("keeps the opt-out for updates and reminders", async () => {
    for (const category of ["updates", "reminders"] as const)
      expect(
        (await resolveRecipients(category, [row], undefined, false))[0].policy.channels
      ).toEqual(["sms"]);
  });
  it("reaches an SMS-preference guest's only contact, the email on their RSVP", async () => {
    m.settings.mockResolvedValue([migrated(["sms", "email"], ["sms"])]);
    const [recipient] = await resolveRecipients(
      "confirmations",
      [
        {
          ...row,
          guestPhone: null,
          user: { ...user, notificationChannel: "SMS", emailNotifications: true },
        },
      ],
      undefined,
      false
    );
    // Channels resolve in registry order; the only contact still receives it.
    expect(recipient.policy.channels).toEqual(["email", "sms"]);
    expect(recipient.destinations).toEqual({ email: row.guestEmail });
  });
});
