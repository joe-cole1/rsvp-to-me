"use server";

import { getRequestTranslator } from "@/i18n/server";
import { assertCaptcha } from "@/lib/captcha";
import { normalizeDestination, CHANNELS } from "@/lib/notifications/preferences";
import { organizerEligibility } from "@/lib/notifications/service";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/session-user";
import {
  readManagement,
  saveManagement,
  requestDestinationProof,
  verifyDestinationProof,
  removeConnection,
  authorizeManagement,
  assertNotificationContactAvailable,
} from "@/lib/notifications/manage";

async function result<T>(operation: () => Promise<T>) {
  try {
    return { success: true as const, data: await operation() };
  } catch (error) {
    const keys = [
      "unauthorized",
      "proofRequired",
      "settingsChanged",
      "invalidPreferences",
      "invalidDestination",
      "rateLimited",
      "verificationUnavailable",
      "invalidProof",
      "contactConflict",
      "useProfileConnections",
    ] as const;
    const key = keys.find((key) => error instanceof Error && key === error.message);
    // Unexpected failures were invisible to operators. Log the error's kind only: messages
    // from validation or the database can carry addresses.
    if (!key)
      console.error("[notifications] Unexpected action failure", {
        name: error instanceof Error ? error.name : typeof error,
        code: (error as { code?: unknown } | null)?.code,
      });
    return {
      success: false as const,
      code: key ?? "saveFailed",
      error: (await getRequestTranslator())(`Ui.Notifications.errors.${key ?? "saveFailed"}`),
    };
  }
}

export async function getNotificationManagement(scope: unknown) {
  return result(() => readManagement(scope));
}
export async function saveNotificationPreferences(scope: unknown, data: unknown) {
  return result(async () => {
    await saveManagement(scope, data);
    return readManagement(scope);
  });
}
export async function beginNotificationProof(
  scope: unknown,
  data: unknown,
  captchaToken?: string | null
) {
  return result(async () => {
    await authorizeManagement(scope);
    await assertCaptcha("profile_edit", captchaToken);
    return requestDestinationProof(scope, data);
  });
}
export async function completeNotificationProof(scope: unknown, data: unknown) {
  return result(async () => {
    await verifyDestinationProof(scope, data);
    return readManagement(scope);
  });
}
export async function removeNotificationConnection(scope: unknown, channel: unknown) {
  return result(async () => {
    await removeConnection(scope, channel);
    return readManagement(scope);
  });
}

export async function bindNotificationConnection(scope: unknown, connectionId: string) {
  return result(async () => {
    const context = await authorizeManagement(scope);
    const user = await getSessionUser();
    if (
      context.scope.kind === "profile" ||
      !user ||
      typeof connectionId !== "string" ||
      connectionId.length > 128
    )
      throw new Error("unauthorized");
    await db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${context.id}, 0))`;
      const connection = await tx.notificationConnection.findFirst({
        where: { id: connectionId, userId: user.id, revokedAt: null },
      });
      if (!connection || !(CHANNELS as readonly string[]).includes(connection.channel))
        throw new Error("proofRequired");
      const binding = {
        destination: connection.destination,
        verifiedAt: connection.verifiedAt,
        revokedAt: null,
        connectionId: connection.id,
        connectionGeneration: connection.generation,
      };
      if (context.event) {
        // Creating the personal row keeps the eligibility this organizer already had.
        await tx.notificationSettings.upsert({
          where: { id: context.id },
          update: {},
          create: {
            id: context.id,
            userId: user.id,
            eventId: context.event.id,
            legacyChannels: organizerEligibility(context.event),
          },
        });
        await tx.notificationBinding.upsert({
          where: { settingsId_channel: { settingsId: context.id, channel: connection.channel } },
          create: { settingsId: context.id, channel: connection.channel, ...binding },
          update: binding,
        });
        return;
      }
      const current = await tx.rSVP.findUniqueOrThrow({ where: { id: context.rsvp!.id } });
      const old = connection.channel === "email" ? current.guestEmail : current.guestPhone;
      for (const contact of [
        ...new Set(
          [old, connection.destination]
            .filter((value): value is string => !!value)
            .map((value) => normalizeDestination(connection.channel, value))
        ),
      ].sort())
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"invitation:" + current.eventId}), hashtext(${contact}))`;
      await assertNotificationContactAvailable(
        tx,
        current.eventId,
        current.id,
        connection.channel,
        connection.destination
      );
      await tx.rSVP.update({
        where: { id: current.id },
        data:
          connection.channel === "email"
            ? { guestEmail: connection.destination }
            : { guestPhone: connection.destination },
      });
      await tx.notificationBinding.upsert({
        where: { rsvpId_channel: { rsvpId: current.id, channel: connection.channel } },
        update: binding,
        create: { rsvpId: current.id, channel: connection.channel, ...binding },
      });
    });
    return readManagement(scope);
  });
}
