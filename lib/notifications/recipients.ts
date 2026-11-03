import { resolveLocale } from "@/i18n/config";
import type { NotificationRecipient } from "./types";

type LegacyRecipient = {
  id: string;
  guestEmail: string | null;
  guestPhone: string | null;
  user: {
    notificationChannel: "EMAIL" | "SMS" | "BOTH";
    emailNotifications: boolean;
    smsNotifications: boolean;
    preferredLocale: string | null;
  } | null;
};

/** Compatibility boundary; generic routing never interprets the legacy enum. */
export function resolveUpdateRecipients(rows: LegacyRecipient[]): NotificationRecipient[] {
  return rows.map((row) => {
    const channels =
      row.user?.notificationChannel === "EMAIL"
        ? ["email"]
        : row.user?.notificationChannel === "SMS"
          ? ["sms"]
          : ["email", "sms"];
    const destinations: Record<string, string> = {};
    if (row.guestEmail && row.user?.emailNotifications !== false)
      destinations.email = row.guestEmail;
    if (row.guestPhone && row.user?.smsNotifications !== false) destinations.sms = row.guestPhone;
    return {
      id: row.id,
      locale: resolveLocale(row.user?.preferredLocale),
      destinations,
      policy: { mode: "preferred", channels },
    };
  });
}
