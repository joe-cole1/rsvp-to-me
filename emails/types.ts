import type { EmailTheme } from "@/lib/email-theme";
import type { EventEmailDetails } from "./components/DetailsCard";

export type TemplateToggleKey =
  "showCalendarLinks" | "showMapLink" | "showHostFlourish" | "showCoverImage";

export type TemplateToggles = Record<TemplateToggleKey, boolean>;

export const DEFAULT_TOGGLES: TemplateToggles = {
  showCalendarLinks: true,
  showMapLink: true,
  showHostFlourish: true,
  showCoverImage: true,
};

export type RsvpStatusLabel = "Going" | "Maybe" | "Can't Go";

export interface InviteEmailProps {
  theme: EmailTheme;
  body: string;
  toggles: TemplateToggles;
  event: EventEmailDetails;
  hostName: string;
  rsvpBaseUrl: string;
  maybeEnabled: boolean;
  eventUrl: string;
}

export interface RsvpConfirmationEmailProps {
  theme: EmailTheme;
  body: string;
  toggles: TemplateToggles;
  event: EventEmailDetails;
  statusLabel: RsvpStatusLabel;
  eventUrl: string;
  editUrl: string;
}

export interface ApprovalEmailProps {
  theme: EmailTheme;
  toggles: TemplateToggles;
  eventTitle: string;
  approved: boolean;
  hostMessage?: string;
  eventUrl: string;
}

export interface BlastEmailProps {
  theme: EmailTheme;
  toggles: TemplateToggles;
  eventTitle: string;
  hostName: string;
  message: string;
  eventUrl: string;
}

export interface HostRsvpAlertEmailProps {
  theme: EmailTheme;
  guestName: string;
  statusLabel: RsvpStatusLabel;
  plusOneCount: number;
  note?: string | null;
  eventTitle: string;
  goingCount: number;
  maybeCount: number;
  noCount: number;
  guestListUrl: string;
}

export interface MagicLinkEmailProps {
  theme: EmailTheme;
  body: string;
  magicLink: string;
}

export interface WelcomeEmailProps {
  theme: EmailTheme;
  body: string;
  magicLink: string;
}

export interface TestEmailProps {
  theme: EmailTheme;
  body: string;
}
