"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { assertHost } from "./shared";

// ── Co-hosts ──────────────────────────────────────────────────────────────────

export async function addCoHost(eventId: string, email: string) {
  const event = await assertHost(eventId);
  const user = await db.user.findUnique({ where: { email } });
  if (!user) return { success: false, error: "No account found for that email" };
  if (user.id === (await getSession())!.userId)
    return { success: false, error: "You are already the host" };
  try {
    await db.eventCoHost.create({ data: { eventId, userId: user.id } });
  } catch {
    return { success: false, error: "Already a co-host" };
  }
  revalidatePath(`/e/${event.slug}/settings`);
  return { success: true, cohostId: user.id, name: user.name, email: user.email };
}

export async function removeCoHost(cohostId: string) {
  const cohost = await db.eventCoHost.findUnique({
    where: { id: cohostId },
    select: { eventId: true, event: { select: { slug: true } } },
  });
  if (!cohost) throw new Error("Forbidden");
  // Deliberately host-only: co-host management stays with the original host.
  await assertHost(cohost.eventId);
  await db.eventCoHost.delete({ where: { id: cohostId } });
  revalidatePath(`/e/${cohost.event.slug}/settings`);
}

export async function updateCoHostDisplayName(cohostId: string, displayName: string | null) {
  const cohost = await db.eventCoHost.findUnique({
    where: { id: cohostId },
    select: { eventId: true, event: { select: { slug: true } } },
  });
  if (!cohost) throw new Error("Forbidden");
  // Deliberately host-only: co-host management stays with the original host.
  await assertHost(cohost.eventId);
  await db.eventCoHost.update({
    where: { id: cohostId },
    data: { displayName: displayName ? displayName.trim() : null },
  });
  revalidatePath(`/e/${cohost.event.slug}/settings`);
  return { success: true };
}
