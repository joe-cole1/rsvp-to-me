import { db } from "@/lib/db";
import { resolveLocale } from "@/i18n/config";
import {
  CHANNELS,
  legacySettings,
  resolvePreference,
  normalizeDestination,
  type Category,
  type Channel,
  type Policy,
  type Settings,
} from "./preferences";
import type { NotificationRecipient } from "./types";

export type RecipientRow = {
  id: string;
  guestEmail: string | null;
  guestPhone: string | null;
  userId: string | null;
  user: {
    notificationChannel: "EMAIL" | "SMS" | "BOTH";
    emailNotifications: boolean;
    smsNotifications: boolean;
    preferredLocale: string | null;
  } | null;
};

export const recipientSelect = {
  id: true,
  guestEmail: true,
  guestPhone: true,
  userId: true,
  user: {
    select: {
      notificationChannel: true,
      emailNotifications: true,
      smsNotifications: true,
      preferredLocale: true,
    },
  },
} as const;

/**
 * ready: deliverable now (`proved` says whether it gets its own copy). missing: no contact.
 * paused: an earlier proof for this contact was revoked or superseded, so it waits for fresh
 * verification. unverified: an organizer account contact nothing vouches for.
 */
export type RouteState = "ready" | "missing" | "paused" | "unverified";
export type RouteStates = Record<
  Channel,
  { state: RouteState; destination?: string; proved?: boolean }
>;

type BindingRow = {
  rsvpId: string | null;
  channel: string;
  destination: string;
  revokedAt: Date | null;
  connectionId: string | null;
  connectionGeneration: number | null;
  connection: { revokedAt: Date | null; generation: number } | null;
};
type ConnectionRow = { userId: string; channel: string; destination: string };

export function bindingUsable(binding: BindingRow, destination: string) {
  return (
    !binding.revokedAt &&
    binding.destination === destination &&
    (!binding.connectionId ||
      (!!binding.connection &&
        !binding.connection.revokedAt &&
        binding.connection.generation === binding.connectionGeneration))
  );
}

/** Event contacts are eligible because the event holds them; proof decides separate copies. */
export function rsvpRouteStates(
  row: RecipientRow,
  bindings: BindingRow[],
  connections: ConnectionRow[]
): RouteStates {
  const states = {} as RouteStates;
  for (const channel of CHANNELS) {
    const destination = channel === "email" ? row.guestEmail : row.guestPhone;
    if (!destination) {
      states[channel] = { state: "missing" };
      continue;
    }
    const binding = bindings.find((item) => item.rsvpId === row.id && item.channel === channel);
    if (binding && !bindingUsable(binding, destination)) {
      states[channel] = { state: "paused", destination };
      continue;
    }
    const proved =
      !!binding ||
      connections.some(
        (connection) =>
          connection.userId === row.userId &&
          connection.channel === channel &&
          connection.destination === normalizeDestination(channel, destination)
      );
    states[channel] = { state: "ready", destination, proved };
  }
  return states;
}

async function loadRecipientContext(rows: RecipientRow[]) {
  const userIds = rows.flatMap((row) => (row.userId ? [row.userId] : []));
  const [settings, connections, bindings] = await Promise.all([
    db.notificationSettings.findMany({
      where: {
        id: {
          in: [...rows.map((row) => `rsvp:${row.id}`), ...userIds.map((id) => `profile:${id}`)],
        },
      },
      include: { categories: true },
    }),
    db.notificationConnection.findMany({ where: { userId: { in: userIds }, revokedAt: null } }),
    db.notificationBinding.findMany({
      where: { rsvpId: { in: rows.map((row) => row.id) } },
      include: { connection: true },
    }),
  ]);
  return { byId: new Map(settings.map((row) => [row.id, row as Settings])), connections, bindings };
}

function routeFor(
  category: Category,
  row: RecipientRow,
  context: Awaited<ReturnType<typeof loadRecipientContext>>,
  ceiling?: string[]
): { policy: Policy; states: RouteStates } {
  const profile = context.byId.get(`profile:${row.userId}`) ?? legacySettings(row.user);
  const policy = resolvePreference(category, profile, context.byId.get(`rsvp:${row.id}`));
  if (ceiling) policy.channels = policy.channels.filter((channel) => ceiling.includes(channel));
  return {
    policy,
    states: rsvpRouteStates(row, context.bindings, context.connections),
  };
}

/** Deliverable destinations, and which of them are proved and so get their own copy. */
export function readyRoutes(states: RouteStates) {
  const destinations: Record<string, string> = {};
  const proved: Channel[] = [];
  for (const channel of CHANNELS) {
    if (states[channel].state !== "ready") continue;
    destinations[channel] = states[channel].destination!;
    if (states[channel].proved) proved.push(channel);
  }
  return { destinations, proved };
}

export async function resolveRecipients(
  category: Category,
  rows: RecipientRow[],
  ceiling?: string[],
  recheck = true
): Promise<NotificationRecipient[]> {
  const context = await loadRecipientContext(rows);
  return rows.map((row) => {
    const { policy, states } = routeFor(category, row, context, ceiling);
    return {
      id: row.id,
      locale: resolveLocale(row.user?.preferredLocale),
      ...readyRoutes(states),
      policy,
      ...(recheck
        ? {
            canSend: async (channel: string, destination: string) => {
              const fresh = await db.rSVP.findUnique({
                where: { id: row.id },
                select: recipientSelect,
              });
              if (!fresh) return false;
              const [current] = await resolveRecipients(category, [fresh], ceiling, false);
              return (
                current.policy.channels.includes(channel) &&
                current.destinations[channel] === destination
              );
            },
          }
        : {}),
    };
  });
}

/** The same resolution producers use, for showing a guest what would happen now. */
export async function describeRsvpRoutes(rsvpId: string, categories: readonly Category[]) {
  const row = await db.rSVP.findUnique({ where: { id: rsvpId }, select: recipientSelect });
  if (!row) return null;
  const context = await loadRecipientContext([row]);
  return {
    contacts: rsvpRouteStates(row, context.bindings, context.connections),
    routes: categories.map((category) => ({ category, ...routeFor(category, row, context) })),
  };
}
