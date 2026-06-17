import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function tzLocalToUtc(localStr: string, tz: string): Date {
  // localStr: "YYYY-MM-DDTHH:MM" treated as a wall-clock time in timezone tz
  // Converts to the corresponding UTC Date using the 2x trick.
  const asIfUtc = new Date(localStr + ":00Z");
  const parts: Record<string, string> = {};
  for (const p of new Intl.DateTimeFormat("en-CA", {
    timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  }).formatToParts(asIfUtc)) {
    parts[p.type] = p.value;
  }
  const h = parts.hour === "24" ? "00" : parts.hour;
  const localAsUtc = new Date(
    `${parts.year}-${parts.month}-${parts.day}T${h}:${parts.minute}:${parts.second}Z`
  );
  return new Date(2 * asIfUtc.getTime() - localAsUtc.getTime());
}
