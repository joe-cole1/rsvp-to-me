import type {
  NotificationAdapter,
  NotificationMessage,
  DeliveryTarget,
} from "@/lib/notifications/types";

/** Provider stub: exercises real recipient resolution and dispatcher policy. */
export function captureAdapter(
  channel: string,
  capture: (message: NotificationMessage, target: DeliveryTarget) => Promise<unknown>
): NotificationAdapter {
  return {
    channel,
    available: true,
    kinds: ["event_update", "confirmation", "approval", "host_alert", "connection_verification"],
    async deliver(message, targets) {
      return Promise.all(
        targets.map(async (target) => {
          await capture(message, target);
          return { status: "accepted" as const };
        })
      );
    },
  };
}
