/** Event wall-clock time is independent of the server and viewer time zones. */
export function formatEventCardDate(date: Date | string, timezone: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    weekday: "short",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: timezone,
    timeZoneName: "short",
  }).format(new Date(date));
}
