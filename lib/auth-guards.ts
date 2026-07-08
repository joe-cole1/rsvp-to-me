import { db } from "@/lib/db";
import { getSession } from "@/lib/session";

export async function assertAdmin() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    throw new Error("Forbidden: Admin access required");
  }
  return session;
}

export async function assertHost(eventId: string) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");
  const event = await db.event.findUnique({
    where: { id: eventId },
    select: { hostId: true, slug: true },
  });
  if (!event) throw new Error("Forbidden");
  const isOwner = event.hostId === session.userId;
  const isAdmin = session.role === "ADMIN";
  if (!isOwner && !isAdmin) throw new Error("Forbidden");
  return event;
}

export async function assertHostOrCohost(eventIdOrSlug: string, isSlug = false) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");
  const event = await db.event.findUnique({
    where: isSlug ? { slug: eventIdOrSlug } : { id: eventIdOrSlug },
    select: { id: true, hostId: true, slug: true, coHosts: { select: { userId: true } } },
  });
  if (!event) throw new Error("Forbidden");
  const isOwner = event.hostId === session.userId;
  const isCohost = event.coHosts.some((ch) => ch.userId === session.userId);
  const isAdmin = session.role === "ADMIN";
  if (!isOwner && !isCohost && !isAdmin) throw new Error("Forbidden");
  return event;
}
