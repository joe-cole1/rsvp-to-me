"use server";

import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { revalidatePath } from "next/cache";

async function assertAdmin() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    throw new Error("Forbidden: Admin access required");
  }
  return session;
}

export async function getAdminStats() {
  await assertAdmin();

  const [totalUsers, totalEvents, totalRsvps, totalCheckIns, totalInviteCodes] = await Promise.all([
    db.user.count(),
    db.event.count(),
    db.rSVP.count(),
    db.checkIn.count(),
    db.hostInviteCode.count(),
  ]);

  return {
    totalUsers,
    totalEvents,
    totalRsvps,
    totalCheckIns,
    totalInviteCodes,
  };
}

export async function getAdminUsers(query: string = "") {
  await assertAdmin();

  const trimmedQuery = query.trim().toLowerCase();

  const users = await db.user.findMany({
    where: trimmedQuery
      ? {
          OR: [
            { name: { contains: trimmedQuery } },
            { email: { contains: trimmedQuery } },
            { phone: { contains: trimmedQuery } },
          ],
        }
      : {},
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      createdAt: true,
      _count: {
        select: {
          events: true,
          rsvps: true,
        },
      },
    },
  });

  return users;
}

export async function updateUserRole(userId: string, role: "GUEST" | "HOST" | "ADMIN") {
  const session = await assertAdmin();
  if (userId === session.userId) {
    throw new Error("You cannot change your own admin role.");
  }

  await db.user.update({
    where: { id: userId },
    data: { role },
  });

  revalidatePath("/admin");
  return { success: true };
}

export async function deleteUserAccount(userId: string) {
  const session = await assertAdmin();
  if (userId === session.userId) {
    throw new Error("You cannot delete your own admin account.");
  }

  // Deleting user's hosted events (this will cascade delete all associated RSVPs, comments, etc.)
  const userEvents = await db.event.findMany({ where: { hostId: userId }, select: { id: true } });
  for (const event of userEvents) {
    await db.event.delete({ where: { id: event.id } });
  }

  // Delete co-host slots
  await db.eventCoHost.deleteMany({ where: { userId } });

  // Delete user record
  await db.user.delete({ where: { id: userId } });

  revalidatePath("/admin");
  return { success: true };
}

export async function getAdminEvents(query: string = "") {
  await assertAdmin();

  const trimmedQuery = query.trim().toLowerCase();

  const events = await db.event.findMany({
    where: trimmedQuery
      ? {
          OR: [
            { title: { contains: trimmedQuery } },
            { slug: { contains: trimmedQuery } },
            { host: { name: { contains: trimmedQuery } } },
            { host: { email: { contains: trimmedQuery } } },
          ],
        }
      : {},
    orderBy: { startAt: "desc" },
    include: {
      host: {
        select: {
          name: true,
          email: true,
        },
      },
      _count: {
        select: {
          rsvps: true,
        },
      },
    },
  });

  return events.map((e) => ({
    id: e.id,
    title: e.title,
    slug: e.slug,
    startAt: e.startAt,
    status: e.status,
    visibility: e.visibility,
    hostName: e.host.name ?? e.host.email?.split("@")[0] ?? "Unknown",
    hostEmail: e.host.email ?? "",
    rsvpCount: e._count.rsvps,
  }));
}

export async function deleteEventAdmin(eventId: string) {
  await assertAdmin();

  await db.event.delete({ where: { id: eventId } });

  revalidatePath("/admin");
  return { success: true };
}

export async function getInviteCodes() {
  await assertAdmin();

  return db.hostInviteCode.findMany({
    orderBy: { createdAt: "desc" },
  });
}

export async function createInviteCode(data: {
  code: string;
  maxUses?: number | null;
  expiresAt?: Date | null;
  note?: string | null;
}) {
  await assertAdmin();

  const code = data.code.trim();
  if (!code) throw new Error("Invite code cannot be empty.");

  const existing = await db.hostInviteCode.findUnique({ where: { code } });
  if (existing) throw new Error("An invite code with this text already exists.");

  const newCode = await db.hostInviteCode.create({
    data: {
      code,
      maxUses: data.maxUses ?? null,
      expiresAt: data.expiresAt ?? null,
      note: data.note ?? null,
    },
  });

  revalidatePath("/admin");
  return { success: true, code: newCode };
}

export async function revokeInviteCode(id: string) {
  await assertAdmin();

  await db.hostInviteCode.delete({ where: { id } });

  revalidatePath("/admin");
  return { success: true };
}

export async function getSystemConfig() {
  await assertAdmin();

  const configs = await db.systemConfig.findMany();
  const configMap: Record<string, string> = {};
  for (const c of configs) {
    configMap[c.key] = c.value;
  }

  // Ensure default for open_registration
  if (!configMap.hasOwnProperty("open_registration")) {
    configMap["open_registration"] = process.env.OPEN_REGISTRATION ?? "false";
  }

  // Ensure defaults for email server configuration
  if (!configMap.hasOwnProperty("email_provider")) {
    let defaultProvider = "console";
    if (process.env.CLOUDFLARE_WORKER_EMAIL_URL) {
      defaultProvider = "cloudflare";
    } else if (process.env.SMTP_HOST) {
      defaultProvider = "smtp";
    }
    configMap["email_provider"] = defaultProvider;
  }

  if (!configMap.hasOwnProperty("email_from")) {
    configMap["email_from"] = process.env.EMAIL_FROM ?? "RSVP to Me <noreply@example.com>";
  }

  if (!configMap.hasOwnProperty("smtp_host")) {
    configMap["smtp_host"] = process.env.SMTP_HOST ?? "";
  }

  if (!configMap.hasOwnProperty("smtp_port")) {
    configMap["smtp_port"] = process.env.SMTP_PORT ?? "587";
  }

  if (!configMap.hasOwnProperty("smtp_secure")) {
    configMap["smtp_secure"] = process.env.SMTP_SECURE ?? "false";
  }

  if (!configMap.hasOwnProperty("smtp_user")) {
    configMap["smtp_user"] = process.env.SMTP_USER ?? "";
  }

  if (!configMap.hasOwnProperty("smtp_pass")) {
    configMap["smtp_pass"] = process.env.SMTP_PASS ?? "";
  }

  if (!configMap.hasOwnProperty("cloudflare_worker_email_url")) {
    configMap["cloudflare_worker_email_url"] = process.env.CLOUDFLARE_WORKER_EMAIL_URL ?? "";
  }

  if (!configMap.hasOwnProperty("cloudflare_worker_api_secret")) {
    configMap["cloudflare_worker_api_secret"] = process.env.CLOUDFLARE_WORKER_API_SECRET ?? "";
  }

  return configMap;
}

export async function updateSystemConfig(key: string, value: string) {
  await assertAdmin();

  await db.systemConfig.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });

  revalidatePath("/admin");
  return { success: true };
}
