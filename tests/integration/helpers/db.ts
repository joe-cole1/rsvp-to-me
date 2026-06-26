import { db } from "@/lib/db";

// Tables in safe truncation order (children before parents)
const TRUNCATE_ORDER = [
  "RSVPAnswer",
  "PlusOneGuest",
  "CheckIn",
  "Comment",
  "PollVote",
  "PollOption",
  "Poll",
  "PotluckClaim",
  "PotluckItem",
  "Invitation",
  "EventUpdate",
  "EventInfoSection",
  "SentReminder",
  "ActivityEvent",
  "EventCoHost",
  "EventTheme",
  "EventReminderSettings",
  "RSVPField",
  "RSVP",
  "Event",
  "MagicToken",
  "Session",
  "HostInviteCode",
  "SystemConfig",
  "ThemePreset",
  "User",
];

export async function truncateAll() {
  const quoted = TRUNCATE_ORDER.map((t) => `"${t}"`).join(", ");
  await db.$executeRawUnsafe(`TRUNCATE TABLE ${quoted} RESTART IDENTITY CASCADE`);
}

export { db };
