// ── Types ──────────────────────────────────────────────────────────────────────

export type SessionUser = {
  email: string;
  name: string | null;
  avatarUrl: string | null;
  role: "GUEST" | "HOST" | "ADMIN";
};

export type CoHostEntry = {
  id: string;
  displayName?: string | null;
  user: { id: string; name: string | null; email: string; avatarUrl?: string | null };
};

export type RsvpFieldEntry = {
  id: string;
  label: string;
  fieldType: "TEXT" | "TEXTAREA" | "SELECT" | "CHECKBOX";
  required: boolean;
  options: string | null;
  order: number;
};

export type PollOptionEntry = {
  id: string;
  pollId: string;
  text: string;
  creatorName: string | null;
  createdAt: Date;
  votes: { id: string; voterName: string; createdAt: Date }[];
};

export type PollEntry = {
  id: string;
  eventId: string;
  question: string;
  multiChoice: boolean;
  allowGuestsToAdd: boolean;
  locked: boolean;
  hideVoters: boolean;
  createdAt: Date;
  updatedAt: Date;
  options: PollOptionEntry[];
};

export type PotluckClaimEntry = {
  id: string;
  potluckItemId: string;
  guestName: string;
  quantity: number;
  createdAt: Date;
};

export type PotluckItemEntry = {
  id: string;
  eventId: string;
  label: string;
  quantity: number;
  createdAt: Date;
  claims: PotluckClaimEntry[];
};

export type EventInput = {
  id: string;
  slug: string;
  commentsEnabled: boolean;
  plusOneAllowed: boolean;
  plusOneMax: number;
  plusOneNamesRequired: boolean;
  guestSharingEnabled: boolean;
  guestsCanInvite: boolean;
  approvalRequired: boolean;
  rsvpDeadline: Date | null;
  allowEditAfterDeadline: boolean;
  capacity: number | null;
  guestListVis: "ALL" | "GUESTS_ONLY" | "HOST_ONLY";
  visibility: "PUBLIC" | "UNLISTED" | "PRIVATE";
  maybeEnabled: boolean;
  questionnaireEnabled: boolean;
  showTimestamps: boolean;
  passwordHash: string | null;
  hostDisplayName: string | null;
  theme: {
    baseTheme: "DARK" | "SOFT" | "BOLD";
    gradientFrom: string;
    gradientTo: string;
    accentColor: string;
    coverImageUrl: string | null;
    appliedPresetId?: string | null;
    cardOpacity?: number | null;
  } | null;
  reminderSettings: {
    emailWeekBefore: boolean;
    emailDayBefore: boolean;
    emailHoursBefore: number;
    smsWeekBefore: boolean;
    smsDayBefore: boolean;
    smsHoursBefore: number;
    nudgeUnresponded: boolean;
  } | null;
  coHosts: CoHostEntry[];
  coHostInvitations: { id: string; email: string; expiresAt: Date }[];
  rsvpFields: RsvpFieldEntry[];
  polls: PollEntry[];
  potluckItems: PotluckItemEntry[];
};

export interface SettingsOverrides {
  commentsEnabled?: boolean;
  plusOneAllowed?: boolean;
  plusOneMax?: number;
  plusOneNamesRequired?: boolean;
  approvalRequired?: boolean;
  rsvpDeadline?: string | null;
  allowEditAfterDeadline?: boolean;
  capacity?: number | null;
  guestListVis?: "ALL" | "GUESTS_ONLY" | "HOST_ONLY";
  visibility?: "PUBLIC" | "UNLISTED" | "PRIVATE";
  maybeEnabled?: boolean;
  questionnaireEnabled?: boolean;
  showTimestamps?: boolean;
  password?: string | null;
  guestSharingEnabled?: boolean;
  guestsCanInvite?: boolean;
  hostDisplayName?: string | null;
}

export interface ReminderOverrides {
  emailWeekBefore?: boolean;
  emailDayBefore?: boolean;
  emailHoursBefore?: number;
  smsWeekBefore?: boolean;
  smsDayBefore?: boolean;
  smsHoursBefore?: number;
  nudgeUnresponded?: boolean;
}

export type ThemeSnapObj = {
  name: string;
  emoji: string;
  base: "DARK" | "SOFT" | "BOLD";
  gradientFrom: string;
  gradientTo: string;
  accentColor: string;
  seasonal: boolean;
  month?: number | null;
  cardOpacity?: number | null;
};

export type DbThemePreset = {
  id: string;
  name: string;
  emoji: string;
  base: "DARK" | "SOFT" | "BOLD";
  gradientFrom: string;
  gradientTo: string;
  accentColor: string;
  seasonal?: boolean | null;
  month?: number | null;
  cardOpacity?: number | null;
  defaultSnapshot?: unknown;
};

export type SettingsSection =
  | "theme"
  | "hosts"
  | "rsvp"
  | "questionnaire"
  | "privacy"
  | "reminders"
  | "polls"
  | "potluck"
  | "emails";
