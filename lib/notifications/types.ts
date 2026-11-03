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
  hostName: string | null;
  replyTo?: string;
  theme?: EmailThemeInput | null;
};

export type NotificationRecipient = {
  id: string;
  locale: Locale;
  destinations: Readonly<Record<string, string>>;
  policy: { mode: "preferred" | "all"; channels: readonly string[] };
};

export type DeliveryTarget = { recipientId: string; destination: string; locale: Locale };

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
  kinds: readonly EventUpdateMessage["kind"][];
  deliver(
    message: EventUpdateMessage,
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
