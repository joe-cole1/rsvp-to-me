import { db } from "@/lib/db";
import { createEmailNotificationAdapter } from "@/lib/email";
import { createSmsNotificationAdapter } from "@/lib/sms";
import { resolveLocale } from "@/i18n/config";
import { dispatchNotification } from "./dispatch";
import {
  CHANNELS,
  legacySettings,
  normalizeDestination,
  resolvePreference,
  type Channel,
  type Policy,
  type Settings,
} from "./preferences";
import {
  bindingUsable,
  readyRoutes,
  recipientSelect,
  resolveRecipients,
  type RouteStates,
} from "./resolve";
import type {
  ApprovalMessage,
  ConfirmationMessage,
  HostAlertMessage,
  NotificationMessage,
  NotificationRecipient,
} from "./types";

export async function deliver(message: NotificationMessage, recipients: NotificationRecipient[]) {
  const adapters = await Promise.all([
    createEmailNotificationAdapter({ hostAlerts: message.kind === "host_alert" }),
    createSmsNotificationAdapter(),
  ]);
  return dispatchNotification(message, recipients, adapters);
}

/** Channels the site actually offers: enabled by an administrator and configured. */
export async function offeredChannels(options: { hostAlerts?: boolean } = {}): Promise<Channel[]> {
  const adapters = await Promise.all([
    createEmailNotificationAdapter(options),
    createSmsNotificationAdapter(),
  ]);
  return CHANNELS.filter((channel) =>
    adapters.some((adapter) => adapter.channel === channel && adapter.available)
  );
}

export async function notifyRsvp(rsvpId: string, message: ConfirmationMessage | ApprovalMessage) {
  const row = await db.rSVP.findUnique({ where: { id: rsvpId }, select: recipientSelect });
  if (!row) return;
  return deliver(message, await resolveRecipients("confirmations", [row]));
}

/** The event's old alert switches are eligibility for account contacts, never a route. */
export function organizerEligibility(event: { hostAlertEmail: boolean; hostAlertSms: boolean }) {
  return CHANNELS.filter((channel) =>
    channel === "email" ? event.hostAlertEmail : event.hostAlertSms
  );
}

/** Without personal choices an organizer follows their profile, limited to eligible contacts. */
export function organizerBaseline(event: { hostAlertEmail: boolean; hostAlertSms: boolean }) {
  return {
    channels: [] as string[],
    blockedChannels: [] as string[],
    categories: [],
    legacyChannels: organizerEligibility(event),
  };
}

async function loadOrganizerContext(eventId: string) {
  const event = await db.event.findUnique({
    where: { id: eventId },
    include: { host: true, coHosts: { include: { user: true } } },
  });
  if (!event || event.status === "DELETED" || (!event.hostAlertEmail && !event.hostAlertSms))
    return null;
  const users = [event.host, ...event.coHosts.map((row) => row.user)];
  const ids = users.map((user) => user.id);
  const [settings, connections, bindings] = await Promise.all([
    db.notificationSettings.findMany({
      where: {
        id: { in: ids.flatMap((id) => [`profile:${id}`, `organizer:${eventId}:${id}`]) },
      },
      include: { categories: true },
    }),
    db.notificationConnection.findMany({ where: { userId: { in: ids }, revokedAt: null } }),
    db.notificationBinding.findMany({
      where: { settingsId: { in: ids.map((id) => `organizer:${eventId}:${id}`) } },
      include: { connection: true },
    }),
  ]);
  return { event, users, settings, connections, bindings };
}

type OrganizerContext = NonNullable<Awaited<ReturnType<typeof loadOrganizerContext>>>;

function organizerRoute(context: OrganizerContext, user: OrganizerContext["users"][number]) {
  const id = `organizer:${context.event.id}:${user.id}`;
  const profile =
    (context.settings.find((row) => row.id === `profile:${user.id}`) as Settings | undefined) ??
    legacySettings(user);
  const personal =
    context.settings.find((row) => row.id === id) ?? organizerBaseline(context.event);
  const policy: Policy = resolvePreference("host_alerts", profile, personal as Settings);
  const states = {} as RouteStates;
  for (const channel of CHANNELS) {
    const account = channel === "email" ? user.email : user.phone;
    const binding = context.bindings.find(
      (row) => row.settingsId === id && row.channel === channel
    );
    if (binding && !(binding.connectionId && bindingUsable(binding, binding.destination))) {
      states[channel] = { state: "paused", destination: binding.destination };
      continue;
    }
    const destination = binding?.destination ?? account;
    if (!destination) {
      states[channel] = { state: "missing" };
      continue;
    }
    const proved =
      !!binding ||
      context.connections.some(
        (row) =>
          row.userId === user.id &&
          row.channel === channel &&
          row.destination === normalizeDestination(channel, destination)
      );
    // Account contacts may come from unverified claims; only the event's old switches
    // vouch for them, and unproved contacts share one message (see deliveryRoutes).
    const eligible = proved || personal.legacyChannels.includes(channel);
    states[channel] = { state: eligible ? "ready" : "unverified", destination, proved };
  }
  return { policy, states };
}

export async function resolveHostRecipients(
  eventId: string,
  recheck = true
): Promise<NotificationRecipient[]> {
  const context = await loadOrganizerContext(eventId);
  if (!context) return [];
  return context.users.map((user): NotificationRecipient => {
    const { policy, states } = organizerRoute(context, user);
    return {
      id: user.id,
      locale: resolveLocale(user.preferredLocale),
      ...readyRoutes(states),
      policy,
      ...(recheck
        ? {
            canSend: async (channel: string, destination: string) => {
              const current = (await resolveHostRecipients(eventId, false)).find(
                (row) => row.id === user.id
              );
              return (
                !!current &&
                current.policy.channels.includes(channel) &&
                current.destinations[channel] === destination
              );
            },
          }
        : {}),
    };
  });
}

/** What one organizer's alerts would do now; null when the event's alerts are off. */
export async function describeOrganizerRoutes(eventId: string, userId: string) {
  const context = await loadOrganizerContext(eventId);
  const user = context?.users.find((row) => row.id === userId);
  return context && user ? organizerRoute(context, user) : null;
}

export async function notifyHostAlert(eventId: string, message: HostAlertMessage) {
  return deliver(message, await resolveHostRecipients(eventId));
}
