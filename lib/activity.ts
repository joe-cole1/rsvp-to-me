import { db } from "@/lib/db";

const ICON_LABELS: Record<string, string> = {
  shirt: "dress code",
  utensils: "food",
  parking: "parking",
  link: "link",
  info: "info",
  music: "music",
  gift: "gifts",
  bed: "accommodation",
  mappin: "location",
  calendar: "schedule",
  sparkles: "vibes",
  filetext: "note",
  camera: "photos",
  phone: "contact",
};

export function iconLabel(key: string): string {
  return ICON_LABELS[key] ?? key;
}

export function logActivity(
  eventId: string,
  type: string,
  detail: string,
  actorName?: string
): Promise<void> {
  return db.activityEvent.create({
    data: { eventId, type, detail, actorName: actorName ?? null },
  }).then(() => {});
}
