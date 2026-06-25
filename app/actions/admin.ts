"use server";

import { randomBytes } from "crypto";
import { db } from "@/lib/db";
import { getSession, invalidateUserSessions } from "@/lib/session";
import { scheduleUserDeletion } from "@/lib/account-deletion";
import { revalidatePath } from "next/cache";
import { encryptConfig, decryptConfig } from "@/lib/crypto";
import { hashToken } from "@/lib/hash";
import { sendWelcomeEmail } from "@/lib/email";

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
      deletionRequestedAt: true,
      deletionScheduledAt: true,
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

  // Invalidate any active cached sessions
  await invalidateUserSessions(userId);

  revalidatePath("/admin");
  return { success: true };
}

export async function deleteUserAccount(userId: string) {
  const session = await assertAdmin();
  if (userId === session.userId) {
    throw new Error("You cannot delete your own admin account.");
  }

  const result = await scheduleUserDeletion(userId);

  revalidatePath("/admin");
  return result;
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

  if (!configMap.hasOwnProperty("cloudflare_inbound_forward_to")) {
    configMap["cloudflare_inbound_forward_to"] = process.env.INBOUND_FORWARD_TO ?? "";
  }

  if (!configMap.hasOwnProperty("cloudflare_account_id")) {
    configMap["cloudflare_account_id"] = process.env.CLOUDFLARE_ACCOUNT_ID ?? "";
  }

  if (!configMap.hasOwnProperty("cloudflare_api_token")) {
    configMap["cloudflare_api_token"] = process.env.CLOUDFLARE_API_TOKEN ?? "";
  }

  // Twilio SMS Config
  if (!configMap.hasOwnProperty("twilio_account_sid")) {
    configMap["twilio_account_sid"] = process.env.TWILIO_ACCOUNT_SID ?? "";
  }

  if (!configMap.hasOwnProperty("twilio_auth_token")) {
    configMap["twilio_auth_token"] = process.env.TWILIO_AUTH_TOKEN ?? "";
  }

  if (!configMap.hasOwnProperty("twilio_phone_number")) {
    configMap["twilio_phone_number"] = process.env.TWILIO_PHONE_NUMBER ?? "";
  }

  // Mask sensitive values before returning to client/UI
  if (configMap["smtp_pass"]) {
    configMap["smtp_pass"] = "••••••••";
  }
  if (configMap["cloudflare_worker_api_secret"]) {
    configMap["cloudflare_worker_api_secret"] = "••••••••";
  }
  if (configMap["cloudflare_api_token"]) {
    configMap["cloudflare_api_token"] = "••••••••";
  }
  if (configMap["twilio_auth_token"]) {
    configMap["twilio_auth_token"] = "••••••••";
  }

  return configMap;
}

export async function updateSystemConfig(key: string, value: string) {
  await assertAdmin();

  if (
    (key === "cloudflare_worker_api_secret" ||
      key === "smtp_pass" ||
      key === "cloudflare_api_token" ||
      key === "twilio_auth_token") &&
    value === "••••••••"
  ) {
    return { success: true };
  }

  let finalValue = value;
  if (
    key === "cloudflare_worker_api_secret" ||
    key === "smtp_pass" ||
    key === "cloudflare_api_token" ||
    key === "twilio_auth_token"
  ) {
    finalValue = encryptConfig(value);
  }

  await db.systemConfig.upsert({
    where: { key },
    update: { value: finalValue },
    create: { key, value: finalValue },
  });

  revalidatePath("/admin");
  return { success: true };
}

export async function testEmailConfigAction(data: {
  provider: string;
  from: string;
  smtpHost?: string;
  smtpPort?: string;
  smtpSecure?: boolean;
  smtpUser?: string;
  smtpPass?: string;
  cfWorkerUrl?: string;
  cfWorkerSecret?: string;
  cfAccountId?: string;
  cfApiToken?: string;
}) {
  const session = await assertAdmin();
  if (!session.email) {
    throw new Error("Admin email is required to send test email.");
  }

  let finalSmtpPass = data.smtpPass || "";
  if (finalSmtpPass === "••••••••") {
    const existing = await db.systemConfig.findUnique({ where: { key: "smtp_pass" } });
    finalSmtpPass = existing ? decryptConfig(existing.value) : "";
  }

  let finalCfWorkerSecret = data.cfWorkerSecret || "";
  if (finalCfWorkerSecret === "••••••••") {
    const existing = await db.systemConfig.findUnique({
      where: { key: "cloudflare_worker_api_secret" },
    });
    finalCfWorkerSecret = existing ? decryptConfig(existing.value) : "";
  }

  let finalCfApiToken = data.cfApiToken || "";
  if (finalCfApiToken === "••••••••") {
    const existing = await db.systemConfig.findUnique({ where: { key: "cloudflare_api_token" } });
    finalCfApiToken = existing ? decryptConfig(existing.value) : "";
  }

  const { testEmailConfig } = await import("@/lib/email");

  const result = await testEmailConfig(session.email, {
    provider: data.provider,
    from: (data.from || "").trim(),
    smtp: {
      host: (data.smtpHost || "").trim(),
      port: parseInt((data.smtpPort || "").trim() || "587"),
      secure: !!data.smtpSecure,
      user: (data.smtpUser || "").trim(),
      pass: finalSmtpPass,
    },
    cloudflare: {
      url: (data.cfWorkerUrl || "").trim(),
      secret: finalCfWorkerSecret,
      accountId: (data.cfAccountId || "").trim(),
      apiToken: finalCfApiToken,
    },
  });

  return result;
}

export async function testSmsConfigAction(data: {
  sid: string;
  token: string;
  phone: string;
  testTo: string;
}) {
  await assertAdmin();

  let finalToken = data.token || "";
  if (finalToken === "••••••••") {
    const existing = await db.systemConfig.findUnique({ where: { key: "twilio_auth_token" } });
    finalToken = existing ? decryptConfig(existing.value) : "";
  }

  const { testSmsConfig } = await import("@/lib/sms");

  return testSmsConfig(data.testTo.trim(), {
    sid: (data.sid || "").trim(),
    token: finalToken,
    phone: (data.phone || "").trim(),
  });
}

/**
 * Backup Management Actions
 */
import { runBackup, listBackups, deleteBackup, getBackupKeepCount } from "@/lib/backup";

export async function createBackupAction() {
  await assertAdmin();
  try {
    const filename = await runBackup();
    revalidatePath("/admin");
    return { success: true, filename };
  } catch (err) {
    console.error("[admin] Failed to trigger manual backup:", err);
    const msg = err instanceof Error ? err.message : "Manual database backup failed.";
    throw new Error(msg);
  }
}

export async function listBackupsAction() {
  await assertAdmin();
  return listBackups();
}

export async function deleteBackupAction(filename: string) {
  await assertAdmin();
  try {
    const success = await deleteBackup(filename);
    revalidatePath("/admin");
    return { success };
  } catch (err) {
    console.error("[admin] Failed to delete backup file:", err);
    const msg = err instanceof Error ? err.message : "Failed to delete backup file.";
    throw new Error(msg);
  }
}

export async function getBackupConfig() {
  await assertAdmin();

  const configs = await db.systemConfig.findMany({
    where: {
      key: {
        in: ["backup_schedule", "backup_keep_count", "last_backup_time"],
      },
    },
  });

  const configMap: Record<string, string> = {};
  for (const c of configs) {
    configMap[c.key] = c.value;
  }

  return {
    backup_schedule: configMap["backup_schedule"] ?? process.env.BACKUP_SCHEDULE ?? "disabled",
    backup_keep_count:
      parseInt(configMap["backup_keep_count"] ?? "", 10) || (await getBackupKeepCount()),
    last_backup_time: configMap["last_backup_time"] ?? "",
  };
}

export async function updateBackupConfigAction(schedule: string, keepCount: number) {
  await assertAdmin();

  if (keepCount <= 0) {
    throw new Error("Backup retention count must be at least 1.");
  }

  await db.$transaction([
    db.systemConfig.upsert({
      where: { key: "backup_schedule" },
      update: { value: schedule },
      create: { key: "backup_schedule", value: schedule },
    }),
    db.systemConfig.upsert({
      where: { key: "backup_keep_count" },
      update: { value: keepCount.toString() },
      create: { key: "backup_keep_count", value: keepCount.toString() },
    }),
  ]);

  revalidatePath("/admin");
  return { success: true };
}

// ── Theme Presets (admin CRUD) ────────────────────────────────────────────────

export async function getThemePresets() {
  return db.themePreset.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] });
}

export async function createThemePreset(data: {
  name: string;
  emoji: string;
  base: "DARK" | "SOFT" | "BOLD";
  gradientFrom: string;
  gradientTo: string;
  accentColor: string;
  seasonal: boolean;
  month?: number | null;
  cardOpacity?: number | null;
}) {
  await assertAdmin();
  const maxOrder = await db.themePreset.aggregate({ _max: { sortOrder: true } });
  const snapshot = {
    name: data.name,
    emoji: data.emoji,
    base: data.base,
    gradientFrom: data.gradientFrom,
    gradientTo: data.gradientTo,
    accentColor: data.accentColor,
    seasonal: data.seasonal,
    month: data.month ?? null,
    cardOpacity: data.cardOpacity ?? null,
  };
  const preset = await db.themePreset.create({
    data: {
      ...data,
      active: true,
      sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
      originalSnapshot: snapshot,
      defaultSnapshot: snapshot,
    },
  });
  revalidatePath("/admin");
  return preset;
}

export async function saveThemePresetDefault(id: string) {
  await assertAdmin();
  const preset = await db.themePreset.findUniqueOrThrow({ where: { id } });
  const snapshot = {
    name: preset.name,
    emoji: preset.emoji,
    base: preset.base,
    gradientFrom: preset.gradientFrom,
    gradientTo: preset.gradientTo,
    accentColor: preset.accentColor,
    seasonal: preset.seasonal,
    month: preset.month ?? null,
    cardOpacity: preset.cardOpacity ?? null,
  };
  await db.themePreset.update({ where: { id }, data: { defaultSnapshot: snapshot } });
  revalidatePath("/admin");
}

export async function updateThemePreset(
  id: string,
  data: Partial<{
    name: string;
    emoji: string;
    base: "DARK" | "SOFT" | "BOLD";
    gradientFrom: string;
    gradientTo: string;
    accentColor: string;
    seasonal: boolean;
    active: boolean;
    sortOrder: number;
    month: number | null;
    cardOpacity: number | null;
  }>
) {
  await assertAdmin();
  await db.themePreset.update({ where: { id }, data });
  revalidatePath("/admin");
  return { success: true };
}

export async function deleteThemePreset(id: string) {
  await assertAdmin();
  await db.themePreset.delete({ where: { id } });
  revalidatePath("/admin");
  return { success: true };
}

export async function createAdminUser(data: {
  name?: string;
  email: string;
  phone?: string;
  role: "GUEST" | "HOST" | "ADMIN";
}): Promise<{ success: true } | { success: false; error: string }> {
  await assertAdmin();

  const email = data.email.trim().toLowerCase();
  if (!email) {
    return { success: false, error: "Email is required." };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { success: false, error: "Please enter a valid email address." };
  }

  const phone = data.phone?.trim() || undefined;
  const name = data.name?.trim() || undefined;
  const role = data.role;

  if (!["GUEST", "HOST", "ADMIN"].includes(role)) {
    return { success: false, error: "Invalid role." };
  }

  const existingEmail = await db.user.findUnique({ where: { email } });
  if (existingEmail) {
    return { success: false, error: "A user with this email already exists." };
  }

  if (phone) {
    const existingPhone = await db.user.findUnique({ where: { phone } });
    if (existingPhone) {
      return { success: false, error: "A user with this phone number already exists." };
    }
  }

  const newUser = await db.user.create({
    data: { name, email, phone, role },
  });

  const token = randomBytes(32).toString("hex");
  const hashedToken = hashToken(token);
  await db.magicToken.create({
    data: {
      userId: newUser.id,
      token: hashedToken,
      expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
    },
  });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const magicLink = `${appUrl}/auth/verify?token=${token}`;

  try {
    await sendWelcomeEmail(email, magicLink);
  } catch (err) {
    console.error("[admin:create-user] Failed to send welcome email:", err);
  }

  revalidatePath("/admin");
  return { success: true };
}

export async function cancelAccountDeletion(userId: string) {
  await assertAdmin();
  await db.user.update({
    where: { id: userId },
    data: { deletionRequestedAt: null, deletionScheduledAt: null },
  });
  revalidatePath("/admin");
  return { success: true };
}
