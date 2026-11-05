import "server-only";
import type { Prisma } from "@/app/generated/prisma/client";
import { randomInt, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/session-user";
import { getClientIp } from "@/lib/clientIp";
import { rateLimit } from "@/lib/rateLimit";
import { hashToken } from "@/lib/hash";
import { AddRsvpSchema } from "@/lib/schemas";
import { resolveLocale } from "@/i18n/config";
import { deliver, describeOrganizerRoutes, offeredChannels, organizerEligibility } from "./service";
import { describeRsvpRoutes, type RouteStates } from "./resolve";
import {
  CATEGORIES,
  CHANNELS,
  PreferenceInput,
  applyTableRow,
  legacySettings,
  maskDestination,
  normalizeDestination,
  resolvePreference,
  type Category,
  type Channel,
  type Settings,
} from "./preferences";

export const ScopeInput = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("profile") }).strict(),
  z
    .object({
      kind: z.literal("rsvp"),
      slug: z.string().min(1).max(200),
      token: z.string().min(1).max(128).optional(),
      rsvpId: z.string().min(1).max(128).optional(),
    })
    .strict(),
  z.object({ kind: z.literal("organizer"), eventId: z.string().min(1).max(128) }).strict(),
]);
export type ManagementScope = z.infer<typeof ScopeInput>;

export async function authorizeManagement(raw: unknown) {
  const scope = ScopeInput.parse(raw);
  const user = await getSessionUser();
  if (scope.kind === "profile") {
    if (!user) throw new Error("unauthorized");
    const account = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    return {
      id: `profile:${user.id}`,
      scope,
      user: account,
      rsvp: null,
      event: null,
      title: null,
    };
  }
  if (scope.kind === "organizer") {
    if (!user) throw new Error("unauthorized");
    const event = await db.event.findFirst({
      where: {
        id: scope.eventId,
        status: { not: "DELETED" },
        OR: [{ hostId: user.id }, { coHosts: { some: { userId: user.id } } }],
      },
      select: { id: true, title: true, hostAlertEmail: true, hostAlertSms: true },
    });
    if (!event) throw new Error("unauthorized");
    const account = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    return {
      id: `organizer:${event.id}:${user.id}`,
      scope,
      user: account,
      rsvp: null,
      event,
      title: event.title,
    };
  }
  if (!scope.token && (!user || !scope.rsvpId)) throw new Error("unauthorized");
  const rsvp = await db.rSVP.findFirst({
    where: {
      ...(scope.token ? { editToken: scope.token } : { id: scope.rsvpId, userId: user!.id }),
      event: { slug: scope.slug, status: { not: "DELETED" } },
    },
    include: { event: { select: { id: true, title: true } }, user: true },
  });
  if (!rsvp) throw new Error("unauthorized");
  if (!scope.token) {
    const connections = await db.notificationConnection.findMany({
      where: { userId: user!.id, revokedAt: null, channel: { in: [...CHANNELS] } },
    });
    const proof = connections.find((connection) => {
      const contact = connection.channel === "email" ? rsvp.guestEmail : rsvp.guestPhone;
      return (
        contact && normalizeDestination(connection.channel, contact) === connection.destination
      );
    });
    if (!proof) throw new Error("proofRequired");
  }
  return {
    id: `rsvp:${rsvp.id}`,
    scope,
    user: rsvp.user,
    rsvp,
    event: null,
    title: rsvp.event.title,
  };
}

export type ContactState = "verified" | "on_file" | "paused" | "missing" | "unverified";

/** The message types each scope controls. */
function scopeCategories(kind: ManagementScope["kind"]): readonly Category[] {
  return kind === "organizer"
    ? ["host_alerts"]
    : kind === "rsvp"
      ? ["updates", "reminders", "confirmations"]
      : CATEGORIES;
}

function contactState(state: RouteStates[Channel]): ContactState {
  if (state.state === "missing" || state.state === "paused") return state.state;
  if (state.state === "unverified") return "unverified";
  return state.proved ? "verified" : "on_file";
}

const include = { categories: true } as const;
/** Masked, scope-limited view. Summaries come from the same resolvers producers use. */
export async function readManagement(raw: unknown) {
  const context = await authorizeManagement(raw);
  const signedIn = await getSessionUser();
  const kind = context.scope.kind;
  const [stored, profile, connections, offered] = await Promise.all([
    db.notificationSettings.findUnique({ where: { id: context.id }, include }),
    context.user
      ? db.notificationSettings.findUnique({ where: { id: `profile:${context.user.id}` }, include })
      : null,
    signedIn
      ? db.notificationConnection.findMany({
          where: { userId: signedIn.id, revokedAt: null },
          include: { bindings: true },
        })
      : [],
    offeredChannels({ hostAlerts: kind === "organizer" }),
  ]);
  const base = (profile as Settings | null) ?? legacySettings(context.user);
  const scoped = kind === "profile" ? null : (stored as Settings | null);
  const categories = scopeCategories(kind);
  // The same resolver producers use, so a checked box is a channel that message may use.
  const rows = categories.map((category) => ({
    category,
    channels: resolvePreference(category, base, scoped).channels.filter(
      (channel): channel is Channel => offered.includes(channel as Channel)
    ),
  }));

  let contacts: { channel: Channel; destination: string | null; state: ContactState }[] = [];
  const offeredStates = (states: RouteStates) =>
    offered.map((channel) => ({
      channel,
      destination: states[channel].destination
        ? maskDestination(channel, states[channel].destination!)
        : null,
      state: contactState(states[channel]),
    }));
  if (kind === "rsvp") {
    const described = await describeRsvpRoutes(context.rsvp!.id, categories);
    if (described) contacts = offeredStates(described.contacts);
  } else if (kind === "organizer") {
    const described = await describeOrganizerRoutes(context.event!.id, context.user!.id);
    if (described) contacts = offeredStates(described.states);
  }
  const binds = (
    bindings: { rsvpId: string | null; settingsId: string | null; revokedAt: Date | null }[]
  ) =>
    bindings.some(
      (binding) =>
        !binding.revokedAt &&
        (kind === "rsvp" ? binding.rsvpId === context.rsvp!.id : binding.settingsId === context.id)
    );
  return {
    kind,
    title: context.title,
    revision: stored?.revision ?? 0,
    offered,
    linked: kind !== "rsvp" || !!context.rsvp!.userId,
    hostAlertsEnabled: context.event
      ? context.event.hostAlertEmail || context.event.hostAlertSms
      : null,
    // An event scope either follows the profile entirely or sets every row itself.
    own:
      kind === "profile" ||
      !!scoped?.categories.some((row) => categories.includes(row.category as Category)),
    categories,
    rows,
    contacts,
    connections: connections
      .filter((row) => offered.includes(row.channel as Channel))
      .map((row) => ({
        id: row.id,
        channel: row.channel as Channel,
        destination: maskDestination(row.channel, row.destination),
        bound: kind !== "profile" && binds(row.bindings),
      })),
  };
}
export type ManagementData = Awaited<ReturnType<typeof readManagement>>;

/**
 * Consent changes need no destination proof: they never add a destination. Proof is
 * required where a destination is added or replaced, and decides separate copies at send time.
 *
 * The profile always writes every row. An event scope writes every row it controls, or none
 * to follow the profile again.
 */
export async function saveManagement(rawScope: unknown, rawData: unknown) {
  const context = await authorizeManagement(rawScope);
  const input = PreferenceInput.parse(rawData);
  const kind = context.scope.kind;
  const allowed = scopeCategories(kind);
  if (
    input.categories.some((row) => !allowed.includes(row.category)) ||
    (input.categories.length !== allowed.length && (kind === "profile" || input.categories.length))
  )
    throw new Error("invalidPreferences");
  const offered = await offeredChannels({ hostAlerts: kind === "organizer" });
  await db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${context.id}, 0))`;
    const previous = (await tx.notificationSettings.findUnique({
      where: { id: context.id },
      include,
    })) as (Settings & { revision: number }) | null;
    if ((previous?.revision ?? 0) !== input.revision) throw new Error("settingsChanged");
    const profile =
      kind === "profile"
        ? previous
        : context.user
          ? ((await tx.notificationSettings.findUnique({
              where: { id: `profile:${context.user.id}` },
              include,
            })) as Settings | null)
          : null;
    const base = profile ?? legacySettings(context.user);
    // Hidden channels keep what this row (or the row it inherited) already said.
    const before = (category: Category) =>
      (
        previous?.categories.find((row) => row.category === category) ??
        base.categories.find((row) => row.category === category)
      )?.channels ?? base.channels;
    const categories = input.categories.map((row) => ({
      category: row.category,
      channels: applyTableRow(before(row.category), row.channels, offered),
    }));
    // The table replaces the old hard blocks for every channel it shows.
    const blockedChannels = (
      previous?.blockedChannels ?? (kind === "profile" ? base.blockedChannels : [])
    ).filter((channel) => !offered.includes(channel as Channel));
    const data = { blockedChannels, revision: input.revision + 1 };
    await tx.notificationSettings.upsert({
      where: { id: context.id },
      update: data,
      create: {
        id: context.id,
        userId: context.rsvp ? null : context.user!.id,
        rsvpId: context.rsvp?.id,
        eventId: context.event?.id ?? null,
        channels: kind === "profile" ? base.channels : [],
        // A first organizer write keeps the eligibility the event already gave this person.
        legacyChannels: context.event ? organizerEligibility(context.event) : [],
        ...data,
      },
    });
    await tx.notificationCategoryPreference.deleteMany({ where: { settingsId: context.id } });
    await tx.notificationCategoryPreference.createMany({
      data: categories.map((row) => ({ settingsId: context.id, ...row })),
    });
    if (kind === "profile") {
      // Conservative projections for a legacy binary, which used the Email/SMS switches for
      // reminders and the channel choice for updates. The settings row stays authoritative.
      const effective = (category: Category) =>
        categories
          .find((row) => row.category === category)!
          .channels.filter((channel) => !blockedChannels.includes(channel));
      const updates = effective("updates");
      const reminders = effective("reminders");
      await tx.user.update({
        where: { id: context.user!.id },
        data: {
          emailNotifications: reminders.includes("email"),
          smsNotifications: reminders.includes("sms"),
          notificationChannel:
            updates.length === 1 ? (updates[0] === "email" ? "EMAIL" : "SMS") : "BOTH",
        },
      });
    }
  });
}

const challengeInput = z
  .object({ channel: z.enum(CHANNELS), destination: z.string().min(1).max(320) })
  .strict();
export async function requestDestinationProof(rawScope: unknown, rawInput: unknown) {
  const context = await authorizeManagement(rawScope);
  const input = challengeInput.parse(rawInput);
  if (context.scope.kind === "organizer") throw new Error("useProfileConnections");
  const parsed = (
    input.channel === "email" ? AddRsvpSchema.shape.guestEmail : AddRsvpSchema.shape.guestPhone
  ).safeParse(input.destination);
  if (!parsed.success || !parsed.data) throw new Error("invalidDestination");
  const destination = normalizeDestination(input.channel, parsed.data);
  const ip = await getClientIp();
  for (const key of [`owner:${context.id}`, `destination:${hashToken(destination)}`, `ip:${ip}`]) {
    if (!(await rateLimit(`notification-proof:${key}`, 5, 3600)).success)
      throw new Error("rateLimited");
  }
  const recent = await db.notificationChallenge.findFirst({
    where: {
      ...(context.rsvp ? { rsvpId: context.rsvp.id } : { userId: context.user!.id }),
      createdAt: { gt: new Date(Date.now() - 60000) },
    },
  });
  if (recent) throw new Error("rateLimited");
  const code = randomInt(10000000, 100000000).toString();
  const row = await db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${context.id}, 0))`;
    const owner = context.rsvp ? { rsvpId: context.rsvp.id } : { userId: context.user!.id };
    if (
      await tx.notificationChallenge.findFirst({
        where: { ...owner, createdAt: { gt: new Date(Date.now() - 60000) } },
      })
    )
      throw new Error("rateLimited");
    await tx.notificationChallenge.updateMany({
      where: { ...owner, channel: input.channel, usedAt: null },
      data: { usedAt: new Date() },
    });
    return tx.notificationChallenge.create({
      data: {
        ...owner,
        channel: input.channel,
        destination,
        originalDestination: context.rsvp
          ? input.channel === "email"
            ? context.rsvp.guestEmail
            : context.rsvp.guestPhone
          : null,
        secretHash: hashToken(code),
        expiresAt: new Date(Date.now() + 15 * 60000),
      },
    });
  });
  const locale = resolveLocale(context.user?.preferredLocale);
  const report = await deliver({ kind: "connection_verification", id: row.id, code }, [
    {
      id: row.id,
      locale,
      policy: { channels: [input.channel] },
      destinations: { [input.channel]: destination },
    },
  ]);
  if (!report.summary.accepted && !report.summary.uncertain)
    throw new Error("verificationUnavailable");
  return { challengeId: row.id };
}

export async function verifyDestinationProof(rawScope: unknown, rawInput: unknown) {
  const context = await authorizeManagement(rawScope);
  const { challengeId, code } = z
    .object({ challengeId: z.string().max(128), code: z.string().regex(/^\d{8}$/) })
    .strict()
    .parse(rawInput);
  const valid = await db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${context.id}, 0))`;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`proof:${challengeId}`}, 0))`;
    const row = await tx.notificationChallenge.findUnique({ where: { id: challengeId } });
    if (
      !row ||
      row.usedAt ||
      row.expiresAt < new Date() ||
      row.attempts >= 5 ||
      (context.rsvp
        ? row.rsvpId !== context.rsvp.id
        : row.userId !== context.user?.id || row.rsvpId !== null)
    )
      return false;
    await tx.notificationChallenge.update({
      where: { id: row.id },
      data: { attempts: { increment: 1 } },
    });
    if (!timingSafeEqual(Buffer.from(row.secretHash), Buffer.from(hashToken(code)))) return false;
    await tx.notificationChallenge.update({ where: { id: row.id }, data: { usedAt: new Date() } });
    if (context.rsvp) {
      // Same lock namespace/order as invitation preparation; recheck contact authority.
      const current = await tx.rSVP.findUniqueOrThrow({ where: { id: context.rsvp.id } });
      const old = row.channel === "email" ? current.guestEmail : current.guestPhone;
      if (old !== row.originalDestination) return false;
      for (const contact of [
        ...new Set(
          [old, row.destination]
            .filter((value): value is string => !!value)
            .map((value) => normalizeDestination(row.channel, value))
        ),
      ].sort())
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"invitation:" + current.eventId}), hashtext(${contact}))`;
      await assertNotificationContactAvailable(
        tx,
        current.eventId,
        current.id,
        row.channel,
        row.destination
      );
      await tx.rSVP.update({
        where: { id: current.id },
        data:
          row.channel === "email"
            ? { guestEmail: row.destination }
            : { guestPhone: row.destination },
      });
      await tx.notificationBinding.upsert({
        where: { rsvpId_channel: { rsvpId: current.id, channel: row.channel } },
        create: {
          rsvpId: current.id,
          channel: row.channel,
          destination: row.destination,
          verifiedAt: new Date(),
        },
        update: {
          destination: row.destination,
          verifiedAt: new Date(),
          revokedAt: null,
          connectionId: null,
          connectionGeneration: null,
        },
      });
    } else {
      const existing = await tx.notificationConnection.findUnique({
        where: { userId_channel: { userId: context.user!.id, channel: row.channel } },
      });
      if (existing && !existing.revokedAt && existing.destination === row.destination) {
        // Re-proving the same active address keeps the events already using it.
        await tx.notificationConnection.update({
          where: { id: existing.id },
          data: { verifiedAt: new Date() },
        });
        return true;
      }
      if (existing)
        await tx.notificationBinding.updateMany({
          where: { connectionId: existing.id },
          data: { revokedAt: new Date() },
        });
      await tx.notificationConnection.upsert({
        where: { userId_channel: { userId: context.user!.id, channel: row.channel } },
        create: {
          userId: context.user!.id,
          channel: row.channel,
          destination: row.destination,
          verifiedAt: new Date(),
        },
        update: {
          destination: row.destination,
          generation: { increment: 1 },
          verifiedAt: new Date(),
          revokedAt: null,
        },
      });
    }
    return true;
  });
  if (!valid) throw new Error("invalidProof");
}

/**
 * Removing a verified address withdraws its proof everywhere it was used. It never blocks
 * the channel: consent belongs to the channel switches. Events that used this connection
 * pause that contact until it is verified again.
 */
export async function removeConnection(rawScope: unknown, rawChannel: unknown) {
  const context = await authorizeManagement(rawScope);
  if (context.scope.kind !== "profile") throw new Error("unauthorized");
  const channel = z.enum(CHANNELS).parse(rawChannel);
  await db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${context.id}, 0))`;
    const connection = await tx.notificationConnection.findUnique({
      where: { userId_channel: { userId: context.user!.id, channel } },
    });
    if (connection && !connection.revokedAt) {
      await tx.notificationConnection.update({
        where: { id: connection.id },
        data: { revokedAt: new Date(), generation: { increment: 1 } },
      });
      await tx.notificationBinding.updateMany({
        where: { connectionId: connection.id },
        data: { revokedAt: new Date() },
      });
    }
    await tx.notificationChallenge.updateMany({
      where: { userId: context.user!.id, channel, usedAt: null },
      data: { usedAt: new Date() },
    });
  });
}

/** Call while holding the normalized event/contact invitation locks. */
export async function assertNotificationContactAvailable(
  client: Pick<Prisma.TransactionClient, "rSVP">,
  eventId: string,
  rsvpId: string,
  channel: string,
  destination: string
) {
  const supported = z.enum(CHANNELS).parse(channel);
  const rows = await client.rSVP.findMany({
    where: { eventId, id: { not: rsvpId } },
    select: { guestEmail: true, guestPhone: true },
  });
  if (
    rows.some((row) => {
      const contact = supported === "email" ? row.guestEmail : row.guestPhone;
      return (
        contact &&
        normalizeDestination(supported, contact) === normalizeDestination(supported, destination)
      );
    })
  )
    throw new Error("contactConflict");
}
