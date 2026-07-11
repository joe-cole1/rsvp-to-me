// ── Shared types for the Admin panel tabs ──────────────────────────────────

export interface AdminStats {
  totalUsers: number;
  totalEvents: number;
  totalRsvps: number;
  totalCheckIns: number;
  totalInviteCodes: number;
}

export interface AdminUser {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  role: "GUEST" | "HOST" | "ADMIN";
  createdAt: Date;
  deletionRequestedAt: Date | null;
  deletionScheduledAt: Date | null;
  _count: {
    events: number;
    rsvps: number;
  };
}

export interface AdminEvent {
  id: string;
  title: string;
  slug: string;
  startAt: Date;
  status: string;
  visibility: string;
  hostName: string;
  hostEmail: string;
  rsvpCount: number;
}

export interface AdminInviteCode {
  id: string;
  code: string;
  uses: number;
  maxUses: number | null;
  expiresAt: Date | null;
  note: string | null;
  createdAt: Date;
}

export interface BackupFile {
  filename: string;
  sizeBytes: number;
  createdAt: Date;
}

export interface BackupConfig {
  backup_schedule: string;
  backup_keep_count: number;
  last_backup_time: string;
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
  fontId?: string | null;
};

export interface AdminThemePreset {
  id: string;
  name: string;
  emoji: string;
  base: "DARK" | "SOFT" | "BOLD";
  gradientFrom: string;
  gradientTo: string;
  accentColor: string;
  seasonal: boolean;
  active: boolean;
  sortOrder: number;
  month?: number | null;
  cardOpacity?: number | null;
  fontId?: string | null;
  createdAt: Date;
  originalSnapshot: unknown;
  defaultSnapshot: unknown;
}

export type ThemePresetFormState = {
  id?: string;
  name: string;
  emoji: string;
  base: "DARK" | "SOFT" | "BOLD";
  gradientFrom: string;
  gradientTo: string;
  accentColor: string;
  seasonal: boolean;
  month?: number | null;
  cardOpacity?: number | null;
  fontId?: string | null;
};

export type AdminFeedback = { type: "success" | "error"; message: string };

export const VALID_TABS = [
  "overview",
  "users",
  "events",
  "invites",
  "email",
  "sms",
  "backups",
  "themes",
  "docs",
] as const;
export type TabId = (typeof VALID_TABS)[number];
