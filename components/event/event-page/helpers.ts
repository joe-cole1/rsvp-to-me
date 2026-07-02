import {
  MapPin,
  Shirt,
  UtensilsCrossed,
  ParkingCircle,
  Link2,
  FileText,
  Info,
  Music,
  Gift,
  Bed,
  Calendar,
  Sparkles,
  Camera,
  Phone,
  DollarSign,
  Wallet,
} from "lucide-react";

// Cover images display at ~260px tall in a ~800px wide card. 1600×900 is
// plenty for 2× retina; quality 0.85 JPEG keeps file size under ~200KB.
export function compressImage(file: File, maxW = 1600, maxH = 900, quality = 0.85): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(maxW / img.width, maxH / img.height, 1);
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("Compression failed"));
            return;
          }
          resolve(new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg" }));
        },
        "image/jpeg",
        quality
      );
    };
    img.onerror = reject;
    img.src = url;
  });
}

// ── Helpers ────────────────────────────────────────────────────────────────────

export function formatDate(d: Date, tz: string) {
  return new Date(d).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: tz,
  });
}
export function formatTime(d: Date, tz: string) {
  return new Date(d).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: tz,
  });
}
export function timeAgo(d: Date) {
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

// Convert a UTC Date to a "YYYY-MM-DDTHH:MM" string in the given timezone
export function toDateTimeLocal(d: Date, tz: string): string {
  const parts: Record<string, string> = {};
  for (const p of new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(d))) {
    parts[p.type] = p.value;
  }
  const h = parts.hour === "24" ? "00" : parts.hour;
  return `${parts.year}-${parts.month}-${parts.day}T${h}:${parts.minute}`;
}

// Convert "YYYY-MM-DDTHH:MM" in timezone tz back to a UTC Date (mirrors server logic)
export function tzLocalToUtcClient(localStr: string, tz: string): Date {
  const asIfUtc = new Date(localStr + ":00Z");
  const parts: Record<string, string> = {};
  for (const p of new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(asIfUtc)) {
    parts[p.type] = p.value;
  }
  const h = parts.hour === "24" ? "00" : parts.hour;
  const localAsUtc = new Date(
    `${parts.year}-${parts.month}-${parts.day}T${h}:${parts.minute}:${parts.second}Z`
  );
  return new Date(2 * asIfUtc.getTime() - localAsUtc.getTime());
}

export const ICON_SET: { key: string; icon: React.ElementType; label: string }[] = [
  { key: "shirt", icon: Shirt, label: "Dress code" },
  { key: "utensils", icon: UtensilsCrossed, label: "Food & drinks" },
  { key: "parking", icon: ParkingCircle, label: "Parking" },
  { key: "link", icon: Link2, label: "Link" },
  { key: "info", icon: Info, label: "Info" },
  { key: "music", icon: Music, label: "Music" },
  { key: "gift", icon: Gift, label: "Gift registry" },
  { key: "bed", icon: Bed, label: "Accommodation" },
  { key: "mappin", icon: MapPin, label: "Getting here" },
  { key: "calendar", icon: Calendar, label: "Schedule" },
  { key: "sparkles", icon: Sparkles, label: "Vibes" },
  { key: "filetext", icon: FileText, label: "Notes" },
  { key: "camera", icon: Camera, label: "Photos" },
  { key: "phone", icon: Phone, label: "Contact" },
  { key: "zelle", icon: DollarSign, label: "Zelle" },
  { key: "venmo", icon: Wallet, label: "Venmo" },
];

export const PRESET_CHIPS = [
  { key: "link", label: "Link", icon: Link2 },
  { key: "gift", label: "Registry", icon: Gift },
  { key: "shirt", label: "Dress Code", icon: Shirt },
  { key: "utensils", label: "Food Situation", icon: UtensilsCrossed },
  { key: "parking", label: "Parking", icon: ParkingCircle },
  { key: "bed", label: "Accommodations", icon: Bed },
  { key: "info", label: "Additional Info", icon: Info },
  { key: "zelle", label: "Zelle", icon: DollarSign },
  { key: "venmo", label: "Venmo", icon: Wallet },
];

// Maps legacy enum type values to new icon keys
const LEGACY_ICON_MAP: Record<string, string> = {
  DRESS_CODE: "shirt",
  FOOD: "utensils",
  PARKING: "parking",
  LINK: "link",
  CUSTOM: "filetext",
};

export function resolveIconKey(stored: string): string {
  return LEGACY_ICON_MAP[stored] ?? stored;
}

export function getIconItem(stored: string) {
  const key = resolveIconKey(stored);
  return ICON_SET.find((i) => i.key === key) ?? ICON_SET.find((i) => i.key === "filetext")!;
}

export function buildMapUrl(address: string) {
  const encoded = encodeURIComponent(address);
  if (typeof navigator !== "undefined" && /iPhone|iPad|iPod|Mac/.test(navigator.userAgent)) {
    return `https://maps.apple.com/?q=${encoded}`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${encoded}`;
}

export function getPlaceholder(key: string) {
  switch (key) {
    case "link":
      return "Link details (e.g. Group chat, playlist)...";
    case "gift":
      return "Registry details (e.g. Target, Amazon)...";
    case "shirt":
      return "Dress Code (e.g. Cocktail, Casual, Festive)...";
    case "utensils":
      return "Food Situation (e.g. BYOB, dinner provided, potluck)...";
    case "parking":
      return "Parking information (e.g. Street parking, driveway)...";
    case "bed":
      return "Accommodations (e.g. Hotel block, house details)...";
    case "info":
      return "Additional Info...";
    case "zelle":
      return "Zelle details (e.g. Phone, email, or name)...";
    case "venmo":
      return "Venmo username (e.g. @username)...";
    default:
      return "Details…";
  }
}
