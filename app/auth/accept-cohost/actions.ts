"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { hashToken } from "@/lib/hash";

export async function acceptCoHost(form: FormData): Promise<void> {
  const token = form.get("token");
  const session = await getSession();
  if (typeof token !== "string" || token.length > 128 || !session) {
    redirect("/auth/sign-in?error=invalid-token");
  }
  const destination = await db.$transaction(async (tx) => {
    const invitation = await tx.coHostInvitation.findUnique({
      where: { token: hashToken(token) },
      include: { event: { select: { slug: true } } },
    });
    const user = await tx.user.findUnique({ where: { id: session.userId } });
    if (
      !invitation ||
      invitation.expiresAt <= new Date() ||
      !user?.email ||
      user.email.toLowerCase() !== invitation.email.toLowerCase()
    )
      return null;
    const consumed = await tx.coHostInvitation.deleteMany({
      where: { id: invitation.id, expiresAt: { gt: new Date() } },
    });
    if (consumed.count !== 1) return null;
    await tx.eventCoHost.upsert({
      where: { eventId_userId: { eventId: invitation.eventId, userId: user.id } },
      create: { eventId: invitation.eventId, userId: user.id },
      update: {},
    });
    if (user.role === "GUEST")
      await tx.user.update({ where: { id: user.id }, data: { role: "HOST" } });
    return `/e/${invitation.event.slug}/settings?section=hosts`;
  });
  redirect(destination ?? "/auth/sign-in?error=invalid-token");
}
