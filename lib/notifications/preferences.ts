import { z } from "zod";

export const CHANNELS = ["email", "sms"] as const;
export const CATEGORIES = ["updates", "reminders", "confirmations", "host_alerts"] as const;
export type Channel = (typeof CHANNELS)[number];
export type Category = (typeof CATEGORIES)[number];
export function normalizeDestination(channel: string, destination: string) {
  if (channel === "email") return destination.toLowerCase().trim();
  if (channel === "sms") return destination.trim().replace(/[\s\-().]/g, "");
  return destination;
}
/** The channels one message type may use, in registry order. */
export type Policy = { channels: string[] };
/** A stored row is an explicit choice for that message type; an empty list turns it off. */
export type CategoryPreference = { category: string; channels: string[] };
export type Settings = {
  channels: string[];
  blockedChannels: string[];
  categories: CategoryPreference[];
};

const channels = z
  .array(z.enum(CHANNELS))
  .max(CHANNELS.length)
  .refine((values) => new Set(values).size === values.length, "Duplicate channel");
/** One table write. No rows means "follow my profile" for an event scope. */
export const PreferenceInput = z
  .object({
    revision: z.number().int().min(0),
    categories: z
      .array(z.object({ category: z.enum(CATEGORIES), channels }).strict())
      .max(CATEGORIES.length),
  })
  .strict()
  .superRefine((value, context) => {
    if (new Set(value.categories.map((row) => row.category)).size !== value.categories.length)
      context.addIssue({ code: "custom", message: "Duplicate category" });
  });

export function legacySettings(
  user?: {
    notificationChannel: "EMAIL" | "SMS" | "BOTH";
    emailNotifications: boolean;
    smsNotifications: boolean;
  } | null
): Settings {
  return {
    channels:
      user?.notificationChannel === "EMAIL"
        ? ["email"]
        : user?.notificationChannel === "SMS"
          ? ["sms"]
          : ["email", "sms"],
    blockedChannels: CHANNELS.filter(
      (channel) => user?.[channel === "email" ? "emailNotifications" : "smsNotifications"] === false
    ),
    categories: [],
  };
}

/**
 * A message type follows the event's row, then the profile's row, then the profile default.
 * Hard blocks (kept from the old opt-out switches) apply last.
 */
export function resolvePreference(
  category: Category,
  profile: Settings,
  event?: Settings | null
): Policy {
  const row =
    event?.categories.find((item) => item.category === category) ??
    profile.categories.find((item) => item.category === category);
  const chosen = new Set(row ? row.channels : profile.channels);
  const blocked = new Set([...profile.blockedChannels, ...(event?.blockedChannels ?? [])]);
  return { channels: CHANNELS.filter((channel) => chosen.has(channel) && !blocked.has(channel)) };
}

/**
 * Every checked channel whose destination is proved gets its own copy. The rest share one
 * message, tried in order, so a contact nobody verified never gets more than one message.
 */
export function deliveryRoutes(channels: readonly string[], proved: readonly string[] = []) {
  const unique = [...new Set(channels)];
  const own = unique.filter((channel) => proved.includes(channel));
  const shared = unique.filter((channel) => !proved.includes(channel));
  return [...own.map((channel) => [channel]), ...(shared.length ? [shared] : [])];
}

/**
 * Writes one table row back. Channels the site does not offer right now keep their stored
 * state, so an administrator re-enabling a service restores the recipient's choice.
 */
export function applyTableRow(
  previous: readonly string[],
  checked: readonly string[],
  offered: readonly string[]
): Channel[] {
  return CHANNELS.filter((channel) =>
    offered.includes(channel) ? checked.includes(channel) : previous.includes(channel)
  );
}

export function maskDestination(channel: string, destination: string) {
  if (channel === "email") {
    const [name, domain] = destination.split("@");
    // Keep the last character too, so two addresses with the same initial stay distinct.
    return `${name.slice(0, 1)}•••${name.length > 2 ? name.slice(-1) : ""}@${domain}`;
  }
  return `•••• ${destination.slice(-4)}`;
}
