import type { Locale } from "@/i18n/config";
import type { EmailThemeInput } from "@/lib/email-theme";

export type DeliveryStatus = "accepted" | "skipped" | "failed" | "uncertain";
export type DeliverySummary = Record<DeliveryStatus, number>;
export type NotificationFeedback =
  { status: "completed"; summary: DeliverySummary } | { status: "failed" } | null;

export type AttemptOutcome = {
  status: DeliveryStatus;
  reason?: "unavailable" | "unsupported" | "invalid_destination" | "rejected" | "unconfirmed";
};

export type EventUpdateMessage = {
  kind: "event_update";
  id: string;
  eventSlug: string;
  eventTitle: string;
  body: string;
  /** Shorter text-message copy for the same occurrence, when the producer has one. */
  smsBody?: string;
  hostName: string | null;
  replyTo?: string;
  theme?: EmailThemeInput | null;
};

export type ConfirmationMessage = {
  kind: "confirmation";
  id: string;
  options: Omit<Parameters<typeof import("@/lib/email").sendRsvpConfirmationEmail>[1], "locale">;
};
export type ApprovalMessage = {
  kind: "approval";
  id: string;
  options: Omit<Parameters<typeof import("@/lib/email").sendApprovalEmail>[1], "locale">;
};
export type HostAlertMessage = {
  kind: "host_alert";
  id: string;
  options: Omit<Parameters<typeof import("@/lib/email").sendHostRsvpAlertEmail>[1], "locale">;
};
export type VerificationMessage = { kind: "connection_verification"; id: string; code: string };
export type NotificationMessage =
  | EventUpdateMessage
  | ConfirmationMessage
  | ApprovalMessage
  | HostAlertMessage
  | VerificationMessage;

export type NotificationRecipient = {
  id: string;
  locale: Locale;
  destinations: Readonly<Record<string, string>>;
  policy: { channels: readonly string[] };
  /** Channels whose destination is proved: each gets its own copy. The rest share one. */
  proved?: readonly string[];
  canSend?: (channel: string, destination: string) => Promise<boolean>;
};

export type DeliveryTarget = {
  recipientId: string;
  destination: string;
  locale: Locale;
  authorize?: () => Promise<boolean>;
};

export interface TransportContext {
  // Adapters perform every provider request through this shared gate/deadline.
  run<T>(
    operation: (signal: AbortSignal) => Promise<T>,
    uncertain: () => T,
    cancel?: () => void
  ): Promise<T>;
}

export interface NotificationAdapter {
  channel: string;
  available: boolean;
  kinds: readonly NotificationMessage["kind"][];
  deliver(
    message: NotificationMessage,
    targets: DeliveryTarget[],
    context: TransportContext
  ): Promise<AttemptOutcome[]>;
}

export type DeliveryResult = {
  recipientId: string;
  status: DeliveryStatus;
  attempts: { channel: string; outcome: AttemptOutcome }[];
};

export type DispatchReport = { deliveries: DeliveryResult[]; summary: DeliverySummary };
