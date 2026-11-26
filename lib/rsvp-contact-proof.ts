import "server-only";
import { randomInt, randomUUID, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import type { Prisma } from "@/app/generated/prisma/client";
import { db } from "@/lib/db";
import { hashToken } from "@/lib/hash";
import { AddRsvpSchema } from "@/lib/schemas";
import { normalizePhone } from "@/lib/phone";
import { rateLimit } from "@/lib/rateLimit";
import { getClientIp, isTrustedIpConfigured } from "@/lib/clientIp";
import { resolveEventAccess } from "@/lib/eventAccess";
import { deliver, offeredChannels } from "@/lib/notifications/service";
import { getRequestLocale } from "@/i18n/server";

const RequestInput = z
  .object({
    eventId: z.string().min(1).max(128),
    channel: z.enum(["email", "sms"]),
    destination: z.string().min(1).max(320),
  })
  .strict();
const Receipt = z.object({ challengeId: z.uuid(), receipt: z.uuid() }).strict();
const Receipts = z.array(Receipt).max(2);
export type RsvpContactReceipt = z.infer<typeof Receipt>;
export type RsvpProofFailure =
  | "rsvpProofRequired"
  | "rsvpProofInvalid"
  | "rsvpProofRateLimited"
  | "rsvpProofUnavailable"
  | "invalidRsvp"
  | "forbidden"
  | "rsvpsDisabled"
  | "eventNotFound"
  | "eventStarted"
  | "deadlinePassed";
const failure = (reason: RsvpProofFailure) => ({ success: false as const, reason });
const LIFETIME_MS = 15 * 60 * 1000;

export function rsvpContacts(input: { guestEmail?: string; guestPhone?: string }) {
  return [
    ...(input.guestEmail
      ? [{ channel: "email" as const, destination: input.guestEmail.trim().toLowerCase() }]
      : []),
    ...(input.guestPhone
      ? [{ channel: "sms" as const, destination: normalizePhone(input.guestPhone) }]
      : []),
  ];
}

/** Never look up the submitted contact in account, RSVP, or invitation records. */
export async function requestRsvpContactProof(raw: unknown) {
  const parsed = RequestInput.safeParse(raw);
  if (!parsed.success) return failure("invalidRsvp");
  const input = parsed.data;
  const contact = (
    input.channel === "email" ? AddRsvpSchema.shape.guestEmail : AddRsvpSchema.shape.guestPhone
  ).safeParse(input.destination);
  if (!contact.success || !contact.data) return failure("invalidRsvp");
  const destination = input.channel === "email" ? contact.data : normalizePhone(contact.data);
  if (
    !(
      await rateLimit(
        `rsvp-proof:destination:${hashToken(`${input.channel}:${destination}`)}`,
        5,
        3600
      )
    ).success
  )
    return failure("rsvpProofRateLimited");
  if (
    isTrustedIpConfigured() &&
    !(await rateLimit(`rsvp-proof:ip:${await getClientIp()}`, 15, 600)).success
  )
    return failure("rsvpProofRateLimited");
  const event = await db.event.findUnique({
    where: { id: input.eventId },
    include: { coHosts: { select: { userId: true } } },
  });
  if (!event) return failure("eventNotFound");
  if (event.rsvpEnabled === false) return failure("rsvpsDisabled");
  if (
    event.status !== "PUBLISHED" ||
    (await resolveEventAccess(event, event.slug)).decision !== "granted"
  )
    return failure("forbidden");
  if (event.startAt <= new Date()) return failure("eventStarted");
  if (event.rsvpDeadline && event.rsvpDeadline <= new Date()) return failure("deadlinePassed");
  if (!(await offeredChannels()).includes(input.channel)) return failure("rsvpProofUnavailable");
  const code = randomInt(10000000, 100000000).toString();
  const row = await db.$transaction(async (tx) => {
    const scope = `${input.eventId}:${input.channel}:${destination}`;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`rsvp-proof-request:${scope}`}, 0))`;
    if (
      await tx.rsvpContactChallenge.findFirst({
        where: {
          eventId: input.eventId,
          channel: input.channel,
          destination,
          createdAt: { gt: new Date(Date.now() - 60000) },
        },
      })
    )
      return null;
    return tx.rsvpContactChallenge.create({
      data: {
        eventId: input.eventId,
        channel: input.channel,
        destination,
        secretHash: hashToken(code),
        expiresAt: new Date(Date.now() + LIFETIME_MS),
      },
    });
  });
  if (!row) return failure("rsvpProofRateLimited");
  const locale = await getRequestLocale();
  const report = await deliver(
    { kind: "connection_verification", purpose: "rsvp", id: row.id, code },
    [
      {
        id: row.id,
        locale,
        policy: { channels: [input.channel] },
        destinations: { [input.channel]: destination },
      },
    ]
  );
  if (!report.summary.accepted && !report.summary.uncertain) return failure("rsvpProofUnavailable");
  return { success: true as const, challengeId: row.id };
}

/** Code consumption produces a separate, expiring receipt; it never saves an RSVP. */
export async function verifyRsvpContactProof(raw: unknown) {
  const parsed = z
    .object({
      eventId: z.string().min(1).max(128),
      challengeId: z.uuid(),
      code: z.string().regex(/^\d{8}$/),
    })
    .strict()
    .safeParse(raw);
  if (!parsed.success) return failure("rsvpProofInvalid");
  const input = parsed.data;
  if (!(await rateLimit(`rsvp-proof-check:${input.challengeId}`, 10, 900)).success)
    return failure("rsvpProofInvalid");
  const receipt = randomUUID();
  const valid = await db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`rsvp-proof:${input.challengeId}`}, 0))`;
    const row = await tx.rsvpContactChallenge.findUnique({ where: { id: input.challengeId } });
    if (
      !row ||
      row.eventId !== input.eventId ||
      row.usedAt ||
      row.verifiedAt ||
      row.expiresAt <= new Date() ||
      row.attempts >= 5
    )
      return false;
    await tx.rsvpContactChallenge.update({
      where: { id: row.id },
      data: { attempts: { increment: 1 } },
    });
    if (!timingSafeEqual(Buffer.from(row.secretHash), Buffer.from(hashToken(input.code))))
      return false;
    await tx.rsvpContactChallenge.update({
      where: { id: row.id },
      data: { verifiedAt: new Date(), receiptHash: hashToken(receipt) },
    });
    return true;
  });
  return valid
    ? { success: true as const, proof: { challengeId: input.challengeId, receipt } }
    : failure("rsvpProofInvalid");
}

/** Called inside the event transaction, before any account lookup or RSVP mutation. */
export async function readRsvpContactProofs(
  tx: Prisma.TransactionClient,
  eventId: string,
  input: { guestEmail?: string; guestPhone?: string },
  raw: unknown
) {
  const contacts = rsvpContacts(input);
  const parsed = Receipts.safeParse(raw ?? []);
  if (!parsed.success || parsed.data.length !== contacts.length) return null;
  if (contacts.length === 0) return [];
  if (new Set(parsed.data.map((proof) => proof.challengeId)).size !== contacts.length) return null;
  const rows = await tx.rsvpContactChallenge.findMany({
    where: { id: { in: parsed.data.map((proof) => proof.challengeId) } },
  });
  if (rows.length !== contacts.length) return null;
  for (const contact of contacts) {
    const row = rows.find(
      (candidate) =>
        candidate.channel === contact.channel && candidate.destination === contact.destination
    );
    const proof = parsed.data.find((candidate) => candidate.challengeId === row?.id);
    if (
      !row ||
      !proof ||
      row.eventId !== eventId ||
      !row.verifiedAt ||
      row.usedAt ||
      row.expiresAt <= new Date() ||
      !row.receiptHash ||
      !timingSafeEqual(Buffer.from(row.receiptHash), Buffer.from(hashToken(proof.receipt)))
    )
      return null;
  }
  return rows.map((row) => row.id);
}
