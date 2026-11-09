"use server";
import { validPresetPresentation } from "@/lib/theme-preset-presentation";
import { getLibraryIconSummaries, areLibraryIconIdsKnown } from "@/lib/effect-catalog";
import { isLibraryIconIdShape } from "@/lib/effects";
import { getRequestLocale, getRequestTranslator } from "@/i18n/server";
import { DEFAULT_LOCALE } from "@/i18n/config";

import { randomBytes } from "crypto";
import { db } from "@/lib/db";
import { invalidateUserSessions } from "@/lib/session";
import {
  scheduleUserDeletion,
  cancelUserDeletion,
  performImmediateUserDeletion,
} from "@/lib/account-deletion";
import { revalidatePath } from "next/cache";
import { encryptConfig, decryptConfig } from "@/lib/crypto";
import { hashToken } from "@/lib/hash";
import { sendWelcomeEmail } from "@/lib/email";
import { normalizePhone } from "@/lib/auth";
import {
  EMAIL_TEMPLATE_META,
  getEmailTemplateMeta,
  TEMPLATE_IDS,
  type TemplateId,
} from "@/emails/registry";
import { assertAdmin } from "@/lib/auth-guards";
import { isValidFontId } from "@/lib/fonts";
import { getSystemConfigMap } from "@/lib/config";

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
          id: { not: "system" },
          OR: [
            { name: { contains: trimmedQuery } },
            { email: { contains: trimmedQuery } },
            { phone: { contains: trimmedQuery } },
          ],
        }
      : {
          id: { not: "system" },
        },
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
  const tr = await getRequestTranslator();

  const session = await assertAdmin();
  if (userId === session.userId) {
    throw new Error(tr("Ui.Errors.Admin.youCannotChangeYourOwnAdminRole"));
  }
  if (userId === "system") {
    throw new Error(tr("Ui.Errors.Admin.youCannotChangeTheRoleOfTheSystemUser"));
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
  const tr = await getRequestTranslator();

  const session = await assertAdmin();
  if (userId === session.userId) {
    throw new Error(tr("Ui.Errors.Admin.youCannotDeleteYourOwnAdminAccount"));
  }
  if (userId === "system") {
    throw new Error(tr("Ui.Errors.Admin.youCannotDeleteTheSystemUser"));
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
  const tr = await getRequestTranslator();

  await assertAdmin();

  const code = data.code.trim();
  if (!code) throw new Error(tr("Ui.Errors.Admin.inviteCodeCannotBeEmpty"));

  const existing = await db.hostInviteCode.findUnique({ where: { code } });
  if (existing) throw new Error(tr("Ui.Errors.Admin.anInviteCodeWithThisTextAlreadyExists"));

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

  const configMap = { ...(await getSystemConfigMap()) };

  // Ensure default for open_registration
  if (!configMap.hasOwnProperty("open_registration")) {
    configMap["open_registration"] = process.env.OPEN_REGISTRATION ?? "false";
  }

  // Guest messaging channel toggles
  if (!configMap.hasOwnProperty("email_enabled")) {
    configMap["email_enabled"] = "true";
  }
  if (!configMap.hasOwnProperty("sms_enabled")) {
    const hasTwilio = !!(configMap["twilio_account_sid"] || process.env.TWILIO_ACCOUNT_SID);
    configMap["sms_enabled"] = hasTwilio ? "true" : "false";
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
  const tr = await getRequestTranslator();

  const session = await assertAdmin();
  if (!session.email) {
    throw new Error(tr("Ui.Errors.Admin.adminEmailIsRequiredToSendTestEmail"));
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

  const result = await testEmailConfig(
    session.email,
    {
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
    },
    await getRequestLocale()
  );

  return result;
}

// ── Email templates (copy + toggles, previews, test sends) ───────────────────

function parseTemplateId(
  id: string,
  tr: Awaited<ReturnType<typeof getRequestTranslator>>
): TemplateId {
  if (!TEMPLATE_IDS.includes(id as TemplateId)) {
    throw new Error(tr("Ui.Errors.Admin.unknownEmailTemplate"));
  }
  return id as TemplateId;
}

/**
 * The theme an admin preview or test send uses. `sample` is a base theme id
 * (its defaults) or a theme preset id; undefined means a non-event email,
 * which uses the app-shell theme. An unknown sample falls back to DARK.
 */
async function emailThemeForPreview(sample?: string) {
  const { appShellEmailTheme, resolveEmailTheme } = await import("@/lib/email-theme");
  const { BASE_THEMES } = await import("@/lib/theme");
  if (sample === undefined) return appShellEmailTheme();
  const baseTheme = BASE_THEMES.find((b) => b.id === sample);
  if (baseTheme) {
    return resolveEmailTheme({
      baseTheme: baseTheme.id,
      gradientFrom: baseTheme.defaultGradientFrom,
      gradientTo: baseTheme.defaultGradientTo,
      accentColor: baseTheme.defaultAccent,
    });
  }
  const preset =
    typeof sample === "string" && sample.length <= 64
      ? await db.themePreset.findUnique({
          where: { id: sample },
          select: {
            base: true,
            gradientFrom: true,
            gradientTo: true,
            accentColor: true,
            fontId: true,
          },
        })
      : null;
  if (!preset) return resolveEmailTheme();
  return resolveEmailTheme({
    baseTheme: preset.base,
    gradientFrom: preset.gradientFrom,
    gradientTo: preset.gradientTo,
    accentColor: preset.accentColor,
    fontId: preset.fontId,
  });
}

export async function getEmailTemplatesAdmin() {
  await assertAdmin();
  const { getEmailTemplateSettings } = await import("@/lib/email-settings");
  const localizedMeta = getEmailTemplateMeta(await getRequestTranslator());
  const [templates, samplePresets] = await Promise.all([
    Promise.all(
      TEMPLATE_IDS.map(async (id) => ({
        meta: localizedMeta[id],
        overrides: await getEmailTemplateSettings(id),
      }))
    ),
    // The presets hosts can pick, for the preview's sample-theme list.
    db.themePreset.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: { id: true, name: true, emoji: true },
    }),
  ]);
  return { templates, samplePresets };
}

export async function saveEmailTemplateAction(id: string, overrides: unknown) {
  const tr = await getRequestTranslator();

  await assertAdmin();
  const templateId = parseTemplateId(id, await getRequestTranslator());
  const { templateOverridesSchema, templateConfigKey } = await import("@/lib/email-settings");
  const parsed = templateOverridesSchema.safeParse(overrides);
  if (!parsed.success) {
    return { success: false as const, error: tr("Ui.Errors.Admin.invalidTemplateSettings") };
  }
  // Persist only real overrides; empty strings mean "use the default".
  const cleaned = Object.fromEntries(
    Object.entries(parsed.data).filter(([, v]) => v !== undefined && v !== "")
  );
  const key = templateConfigKey(templateId);
  if (Object.keys(cleaned).length === 0) {
    await db.systemConfig.deleteMany({ where: { key } });
  } else {
    const value = JSON.stringify(cleaned);
    await db.systemConfig.upsert({ where: { key }, update: { value }, create: { key, value } });
  }
  revalidatePath("/admin");
  return { success: true as const };
}

export async function resetEmailTemplateAction(id: string) {
  await assertAdmin();
  const templateId = parseTemplateId(id, await getRequestTranslator());
  const { templateConfigKey } = await import("@/lib/email-settings");
  await db.systemConfig.deleteMany({ where: { key: templateConfigKey(templateId) } });
  revalidatePath("/admin");
  return { success: true as const };
}

/** Clear every email-template override at once, restoring all shipped defaults. */
export async function resetAllEmailTemplatesAction() {
  await assertAdmin();
  const { count } = await db.systemConfig.deleteMany({
    where: { key: { startsWith: "email_template_" } },
  });
  revalidatePath("/admin");
  return { success: true as const, cleared: count };
}

/** Live preview for the admin editor — renders unsaved state with sample data. */
export async function previewEmailTemplateAction(
  id: string,
  overrides: unknown,
  sampleTheme?: string
) {
  await assertAdmin();
  const templateId = parseTemplateId(id, await getRequestTranslator());
  const { templateOverridesSchema } = await import("@/lib/email-settings");
  const parsed = templateOverridesSchema.safeParse(overrides ?? {});
  const { buildSampleEmail } = await import("@/emails/registry");
  const { renderEmail } = await import("@/emails/render");
  const meta = EMAIL_TEMPLATE_META[templateId];
  const theme = meta.eventScoped
    ? await emailThemeForPreview(sampleTheme ?? "DARK")
    : await emailThemeForPreview();
  const { subject, element } = await buildSampleEmail(
    templateId,
    theme,
    parsed.success ? parsed.data : {},
    await getRequestLocale()
  );
  const { html } = await renderEmail(element);
  return { subject, html };
}

/** Send a sample of any template to the signed-in admin's email. */
export async function sendEmailTemplateTestAction(id: string, sampleTheme?: string) {
  const tr = await getRequestTranslator();

  const session = await assertAdmin();
  if (!session.email) {
    throw new Error(tr("Ui.Errors.Admin.adminEmailIsRequiredToSendATestEmail"));
  }
  const templateId = parseTemplateId(id, await getRequestTranslator());
  const { rateLimit } = await import("@/lib/rateLimit");
  const limit = await rateLimit(`admin-email-test:${session.userId}`, 10, 3600);
  if (!limit.success) {
    return { success: false as const, error: tr("Ui.Errors.Admin.tooManyTestEmailsTryAgainLater") };
  }
  const { getEmailTemplateSettings } = await import("@/lib/email-settings");
  const { buildSampleEmail } = await import("@/emails/registry");
  const { renderEmail } = await import("@/emails/render");
  const { sendRenderedEmail } = await import("@/lib/email");
  const meta = EMAIL_TEMPLATE_META[templateId];
  const theme = meta.eventScoped
    ? await emailThemeForPreview(sampleTheme ?? "DARK")
    : await emailThemeForPreview();
  const overrides = await getEmailTemplateSettings(templateId);
  const { subject, element } = await buildSampleEmail(
    templateId,
    theme,
    overrides,
    await getRequestLocale()
  );
  const { html, text } = await renderEmail(element);
  // Send the real subject (no prefix) so the test matches exactly what a
  // recipient would receive; it goes only to the admin's own inbox.
  await sendRenderedEmail({ to: session.email, subject, html, text });
  return { success: true as const, sentTo: session.email };
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

  return testSmsConfig(
    data.testTo.trim(),
    {
      sid: (data.sid || "").trim(),
      token: finalToken,
      phone: (data.phone || "").trim(),
    },
    await getRequestLocale()
  );
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
    const msg =
      err instanceof Error
        ? err.message
        : (await getRequestTranslator())("Ui.Errors.Admin.manualBackupFailed");
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
    const msg =
      err instanceof Error
        ? err.message
        : (await getRequestTranslator())("Ui.Errors.Admin.deleteBackupFileFailed");
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
  const tr = await getRequestTranslator();

  await assertAdmin();

  if (keepCount <= 0) {
    throw new Error(tr("Ui.Errors.Admin.backupRetentionCountMustBeAtLeast1"));
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

/** Category, tile icon and default mixture must be well formed and in the local catalog. */
async function validatePresentation(value: unknown, message: string) {
  if (value === undefined) return;
  if (
    !validPresetPresentation(value) ||
    !(await areLibraryIconIdsKnown([value.tileIconId, ...(value.effect?.effectIconIds ?? [])]))
  )
    throw new Error(message);
}

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
  fontId?: string | null;
  presentation?: import("@/app/generated/prisma/client").Prisma.InputJsonValue;
}) {
  const tr = await getRequestTranslator();

  await assertAdmin();
  if (!isValidFontId(data.fontId)) throw new Error(tr("Ui.Errors.Admin.unknownFont"));
  await validatePresentation(data.presentation, tr("Ui.Errors.Admin.invalidPresetPresentation"));
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
    fontId: data.fontId ?? null,
    presentation: data.presentation ?? null,
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
    fontId: preset.fontId ?? null,
    presentation: preset.presentation,
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
    fontId: string | null;
    presentation: import("@/app/generated/prisma/client").Prisma.InputJsonValue;
  }>
) {
  const tr = await getRequestTranslator();

  await assertAdmin();
  if ("fontId" in data && !isValidFontId(data.fontId))
    throw new Error(tr("Ui.Errors.Admin.unknownFont"));
  await validatePresentation(data.presentation, tr("Ui.Errors.Admin.invalidPresetPresentation"));
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
  const tr = await getRequestTranslator();

  await assertAdmin();

  const email = data.email.trim().toLowerCase();
  if (!email) {
    return { success: false, error: tr("Ui.Errors.Admin.emailIsRequired") };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { success: false, error: tr("Ui.Errors.Admin.pleaseEnterAValidEmailAddress") };
  }

  const rawPhone = data.phone?.trim() || undefined;
  const phone = rawPhone ? normalizePhone(rawPhone) : undefined;
  const name = data.name?.trim() || undefined;
  const role = data.role;

  if (!["GUEST", "HOST", "ADMIN"].includes(role)) {
    return { success: false, error: tr("Ui.Errors.Admin.invalidRole") };
  }

  const existingEmail = await db.user.findUnique({ where: { email } });
  if (existingEmail) {
    return { success: false, error: tr("Ui.Errors.Admin.aUserWithThisEmailAlreadyExists") };
  }

  if (phone) {
    const existingPhone = await db.user.findUnique({ where: { phone } });
    if (existingPhone) {
      return { success: false, error: tr("Ui.Errors.Admin.aUserWithThisPhoneNumberAlreadyExists") };
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
    await sendWelcomeEmail(email, magicLink, DEFAULT_LOCALE);
  } catch (err) {
    console.error("[admin:create-user] Failed to send welcome email:", err);
  }

  revalidatePath("/admin");
  return { success: true };
}

export async function cancelAccountDeletion(userId: string) {
  await assertAdmin();
  await cancelUserDeletion(userId);
  revalidatePath("/admin");
  return { success: true };
}

export async function deleteUserAccountImmediately(userId: string) {
  const tr = await getRequestTranslator();

  const session = await assertAdmin();
  if (userId === session.userId) {
    throw new Error(tr("Ui.Errors.Admin.youCannotDeleteYourOwnAdminAccount"));
  }
  if (userId === "system") {
    throw new Error(tr("Ui.Errors.Admin.youCannotDeleteTheSystemUser"));
  }

  await performImmediateUserDeletion(userId);

  revalidatePath("/admin");
  return { success: true };
}

/** Labels for the admin preset editor: a tile icon plus up to three mixture icons. */
export async function getPresetIconSummaries(ids: string[]) {
  const tr = await getRequestTranslator();
  await assertAdmin();
  // Server-action input is untrusted at runtime, whatever its declared type.
  if (!Array.isArray(ids) || ids.length > 4 || !ids.every(isLibraryIconIdShape))
    throw new Error(tr("Ui.Errors.Admin.invalidPresetIcons"));
  return getLibraryIconSummaries(ids);
}
