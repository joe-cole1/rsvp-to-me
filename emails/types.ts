import type { EmailI18nProps } from "./i18n";
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

export type RsvpStatus = "GOING" | "MAYBE" | "NO";

export interface InviteEmailProps extends EmailI18nProps {
  theme: EmailTheme;
  body: string;
  toggles: TemplateToggles;
  event: EventEmailDetails;
  hostName: string;
  rsvpBaseUrl: string;
  maybeEnabled: boolean;
  eventUrl: string;
}

export interface RsvpConfirmationEmailProps extends EmailI18nProps {
  theme: EmailTheme;
  body: string;
  toggles: TemplateToggles;
  event: EventEmailDetails;
  status: RsvpStatus;
  eventUrl: string;
  editUrl: string;
  manageUrl?: string;
}

export interface ApprovalEmailProps extends EmailI18nProps {
  theme: EmailTheme;
  toggles: TemplateToggles;
  eventTitle: string;
  approved: boolean;
  hostMessage?: string;
  eventUrl: string;
}

export interface BlastEmailProps extends EmailI18nProps {
  theme: EmailTheme;
  toggles: TemplateToggles;
  eventTitle: string;
  hostName: string;
  message: string;
  eventUrl: string;
}

export interface HostRsvpAlertEmailProps extends EmailI18nProps {
  theme: EmailTheme;
  guestName: string;
  status: RsvpStatus;
  plusOneCount: number;
  note?: string | null;
  eventTitle: string;
  goingCount: number;
  maybeCount: number;
  noCount: number;
  guestListUrl: string;
}

export interface MagicLinkEmailProps extends EmailI18nProps {
  theme: EmailTheme;
  body: string;
  magicLink: string;
  code: string;
}

export interface WelcomeEmailProps extends EmailI18nProps {
  theme: EmailTheme;
  body: string;
  magicLink: string;
}

export interface TestEmailProps extends EmailI18nProps {
  theme: EmailTheme;
  body: string;
}
