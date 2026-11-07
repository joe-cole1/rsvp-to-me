"use client";
import { useLocale, useTranslations } from "next-intl";

import { useState, useEffect, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Menu } from "lucide-react";
import DocsPanel, { type PanelDoc } from "@/components/docs/DocsPanel";
import { APP_SHELL, APP_SHELL_THEME as T } from "@/lib/theme";
import { Button } from "@/components/ui/Button";
import { Toast } from "@/components/ui/Feedback";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { AppShell } from "@/components/ui/AppShell";
import {
  updateUserRole,
  deleteUserAccount,
  cancelAccountDeletion,
  deleteUserAccountImmediately,
  createAdminUser,
  deleteEventAdmin,
  createInviteCode,
  revokeInviteCode,
  updateSystemConfig,
  getAdminUsers,
  getAdminEvents,
  testEmailConfigAction,
  testSmsConfigAction,
  createBackupAction,
  listBackupsAction,
  deleteBackupAction,
  updateBackupConfigAction,
  createThemePreset,
  updateThemePreset,
  deleteThemePreset,
  saveThemePresetDefault,
} from "@/app/actions/admin";
import { AdminMobileDrawer } from "./tabs/AdminMobileDrawer";
import { AdminSidebar } from "./tabs/AdminSidebar";
import { BackupsTab } from "./tabs/BackupsTab";
import { CreateUserModal } from "./tabs/CreateUserModal";
import { EmailTab } from "./tabs/EmailTab";
import { EventsTab } from "./tabs/EventsTab";
import { InvitesTab } from "./tabs/InvitesTab";
import { OverviewTab } from "./tabs/OverviewTab";
import { SmsTab } from "./tabs/SmsTab";
import { ThemePresetModal } from "./tabs/ThemePresetModal";
import { ThemesTab } from "./tabs/ThemesTab";
import { UsersTab } from "./tabs/UsersTab";
import {
  VALID_TABS,
  type AdminEvent,
  type AdminFeedback,
  type AdminInviteCode,
  type AdminStats,
  type AdminThemePreset,
  type AdminUser,
  type BackupConfig,
  type BackupFile,
  type TabId,
  type ThemePresetFormState,
  type ThemeSnapObj,
} from "./tabs/types";

interface AdminClientProps {
  initialStats: AdminStats;
  initialUsers: AdminUser[];
  initialEvents: AdminEvent[];
  initialInviteCodes: AdminInviteCode[];
  initialConfig: Record<string, string>;
  initialBackupConfig: BackupConfig;
  initialBackups: BackupFile[];
  initialThemePresets: AdminThemePreset[];
  initialDocs: PanelDoc[];
  sessionUser: {
    id: string;
    name: string | null;
    email: string | null;
    role: "GUEST" | "HOST" | "ADMIN";
    avatarUrl: string | null;
  } | null;
}

export default function AdminClient({
  initialStats,
  initialUsers,
  initialEvents,
  initialInviteCodes,
  initialConfig,
  initialBackupConfig,
  initialBackups,
  initialThemePresets,
  initialDocs,
  sessionUser,
}: AdminClientProps) {
  const tr = useTranslations("Ui.Admin");
  const locale = useLocale();
  const { confirm, dialog: confirmDialog } = useConfirm(T);

  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [copied, setCopied] = useState(false);

  const [users, setUsers] = useState(initialUsers);
  const [events, setEvents] = useState(initialEvents);
  const [inviteCodes, setInviteCodes] = useState(initialInviteCodes);
  const [config, setConfig] = useState(initialConfig);

  // Backup state
  const [backups, setBackups] = useState<BackupFile[]>(initialBackups);
  const [backupSchedule, setBackupSchedule] = useState(initialBackupConfig.backup_schedule);
  const [backupKeepCount, setBackupKeepCount] = useState<number>(
    initialBackupConfig.backup_keep_count
  );
  const [lastBackupTime, setLastBackupTime] = useState(initialBackupConfig.last_backup_time);
  const [isBackupRunning, setIsBackupRunning] = useState(false);
  const [isSavingBackupConfig, setIsSavingBackupConfig] = useState(false);

  // Theme presets state
  const [themePresets, setThemePresets] = useState<AdminThemePreset[]>(initialThemePresets);
  const [themePresetForm, setThemePresetForm] = useState<ThemePresetFormState | null>(null);
  const [themePresetOriginal, setThemePresetOriginal] = useState<ThemePresetFormState | null>(null);
  const [isSavingPreset, setIsSavingPreset] = useState(false);

  const [userSearch, setUserSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"ALL" | "HOST" | "GUEST" | "ADMIN">("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "PENDING_DELETE" | "ACTIVE" | "DELETED">(
    "ACTIVE"
  );
  const [eventSearch, setEventSearch] = useState("");

  const [createUserOpen, setCreateUserOpen] = useState(false);
  const [createUserName, setCreateUserName] = useState("");
  const [createUserEmail, setCreateUserEmail] = useState("");
  const [createUserPhone, setCreateUserPhone] = useState("");
  const [createUserRole, setCreateUserRole] = useState<"GUEST" | "HOST" | "ADMIN">("GUEST");

  const [newCode, setNewCode] = useState("");
  const [maxUses, setMaxUses] = useState<number | "">("");
  const [expiresAt, setExpiresAt] = useState("");
  const [note, setNote] = useState("");

  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<AdminFeedback | null>(null);

  useEffect(() => {
    if (feedback) {
      const timer = setTimeout(() => setFeedback(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [feedback]);

  // Sync active tab from URL query param (?tab=backups)
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const tab = searchParams.get("tab") as TabId | null;
    if (tab && VALID_TABS.includes(tab)) {
      setActiveTab(tab);
    }
  }, [searchParams]);
  /* eslint-enable react-hooks/set-state-in-effect */

  function handleTabChange(id: TabId) {
    setActiveTab(id);
    router.replace(`/admin?tab=${id}`, { scroll: false });
  }

  const [emailProvider, setEmailProvider] = useState(config.email_provider || "console");
  const [emailFrom, setEmailFrom] = useState(config.email_from || "");
  const [smtpHost, setSmtpHost] = useState(config.smtp_host || "");
  const [smtpPort, setSmtpPort] = useState(config.smtp_port || "587");
  const [smtpSecure, setSmtpSecure] = useState(config.smtp_secure === "true");
  const [smtpUser, setSmtpUser] = useState(config.smtp_user || "");
  const [smtpPass, setSmtpPass] = useState(config.smtp_pass || "");
  const [cfWorkerUrl, setCfWorkerUrl] = useState(config.cloudflare_worker_email_url || "");
  const [cfWorkerSecret, setCfWorkerSecret] = useState(config.cloudflare_worker_api_secret || "");
  const [cfInboundForwardTo, setCfInboundForwardTo] = useState(
    config.cloudflare_inbound_forward_to || sessionUser?.email || ""
  );
  const [cfAccountId, setCfAccountId] = useState(config.cloudflare_account_id || "");
  const [cfApiToken, setCfApiToken] = useState(config.cloudflare_api_token || "");
  const [secretCopied, setSecretCopied] = useState(false);
  const [suggestedSubdomain, setSuggestedSubdomain] = useState("your-subdomain");

  const [showCode, setShowCode] = useState(false);
  const [isTestingEmail, setIsTestingEmail] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Twilio SMS config state
  const [twilioAccountSid, setTwilioAccountSid] = useState(config.twilio_account_sid || "");
  const [twilioAuthToken, setTwilioAuthToken] = useState(config.twilio_auth_token || "");
  const [twilioPhoneNumber, setTwilioPhoneNumber] = useState(config.twilio_phone_number || "");
  const [isTestingSms, setIsTestingSms] = useState(false);
  const [smsTestTo, setSmsTestTo] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const hostname = window.location.hostname;
      if (hostname && hostname !== "localhost" && hostname !== "127.0.0.1") {
        const parts = hostname.split(".");
        if (parts.length >= 2) {
          // e.g. rsvp.mybrand.com -> mybrand; mybrand.com -> mybrand
          const sub = parts[parts.length - 2];
          setTimeout(() => {
            setSuggestedSubdomain(sub);
            if (!config.cloudflare_worker_email_url) {
              setCfWorkerUrl(`https://rsvp-email-worker.${sub}.workers.dev`);
            }
          }, 0);
        }
      }
    }
  }, [config.cloudflare_worker_email_url]);

  const handleCreateBackup = async () => {
    setIsBackupRunning(true);
    setFeedback(null);
    try {
      const res = await createBackupAction();
      if (res.success) {
        setFeedback({
          type: "success",
          message: tr("backupCreatedValue0Message", { value0: res.filename }),
        });
        const updated = await listBackupsAction();
        setBackups(updated);
        setLastBackupTime(new Date().toISOString());
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : tr("failedToCreateBackup");
      setFeedback({ type: "error", message: msg });
    } finally {
      setIsBackupRunning(false);
    }
  };

  const handleDeleteBackup = async (filename: string) => {
    const ok = await confirm({
      title: tr("deleteBackupTitle"),
      message: tr("deleteBackupMessage", { filename }),
      confirmLabel: tr("deleteAction"),
    });
    if (!ok) return;
    setFeedback(null);
    try {
      const res = await deleteBackupAction(filename);
      if (res.success) {
        setFeedback({ type: "success", message: tr("backupDeletedSuccessfully") });
        const updated = await listBackupsAction();
        setBackups(updated);
      } else {
        setFeedback({ type: "error", message: tr("failedToDeleteBackup") });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : tr("failedToDeleteBackup");
      setFeedback({ type: "error", message: msg });
    }
  };

  const handleSaveBackupConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingBackupConfig(true);
    setFeedback(null);
    try {
      const res = await updateBackupConfigAction(backupSchedule, backupKeepCount);
      if (res.success) {
        setFeedback({ type: "success", message: tr("backupConfigurationUpdatedSuccessfully") });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : tr("failedToUpdateBackupConfiguration");
      setFeedback({ type: "error", message: msg });
    } finally {
      setIsSavingBackupConfig(false);
    }
  };

  const getFormattedWorkerUrl = (url: string) => {
    const trimmed = url.trim();
    if (!trimmed) return "";
    if (/^https?:\/\//i.test(trimmed)) {
      return trimmed;
    }
    return `https://${trimmed}`;
  };

  const handleTestEmailConfig = async () => {
    setFeedback(null);
    setIsTestingEmail(true);
    try {
      const formattedUrl = getFormattedWorkerUrl(cfWorkerUrl);
      const res = await testEmailConfigAction({
        provider: emailProvider,
        from: emailFrom,
        smtpHost,
        smtpPort,
        smtpSecure,
        smtpUser,
        smtpPass,
        cfWorkerUrl: formattedUrl,
        cfWorkerSecret,
        cfAccountId,
        cfApiToken,
      });

      if (res.success) {
        setFeedback({
          type: "success",
          message: tr("testEmailSentSuccessfullyToValue0PleaseCheckYourMessage", {
            value0: sessionUser?.email ?? tr("yourEmail"),
          }),
        });
      } else {
        setFeedback({
          type: "error",
          message: tr("testConnectionFailedValue0Message", {
            value0: res.error || tr("unknownError"),
          }),
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : tr("failedToTestConnection");
      setFeedback({ type: "error", message });
    } finally {
      setIsTestingEmail(false);
    }
  };

  const handleSaveEmailConfig = (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    startTransition(async () => {
      try {
        const formattedUrl = getFormattedWorkerUrl(cfWorkerUrl);
        await updateSystemConfig("email_provider", emailProvider);
        await updateSystemConfig("email_from", emailFrom.trim());
        await updateSystemConfig("smtp_host", smtpHost.trim());
        await updateSystemConfig("smtp_port", smtpPort.trim());
        await updateSystemConfig("smtp_secure", smtpSecure ? "true" : "false");
        await updateSystemConfig("smtp_user", smtpUser.trim());
        await updateSystemConfig("smtp_pass", smtpPass.trim());
        await updateSystemConfig("cloudflare_worker_email_url", formattedUrl);
        await updateSystemConfig("cloudflare_worker_api_secret", cfWorkerSecret.trim());
        await updateSystemConfig("cloudflare_inbound_forward_to", cfInboundForwardTo.trim());
        await updateSystemConfig("cloudflare_account_id", cfAccountId.trim());
        await updateSystemConfig("cloudflare_api_token", cfApiToken.trim());

        setConfig((prev) => ({
          ...prev,
          email_provider: emailProvider,
          email_from: emailFrom.trim(),
          smtp_host: smtpHost.trim(),
          smtp_port: smtpPort.trim(),
          smtp_secure: smtpSecure ? "true" : "false",
          smtp_user: smtpUser.trim(),
          smtp_pass: smtpPass.trim(),
          cloudflare_worker_email_url: formattedUrl,
          cloudflare_worker_api_secret: cfWorkerSecret.trim(),
          cloudflare_inbound_forward_to: cfInboundForwardTo.trim(),
          cloudflare_account_id: cfAccountId.trim(),
          cloudflare_api_token: cfApiToken.trim(),
        }));
        setFeedback({
          type: "success",
          message: tr("emailDeliveryConfigurationSavedSuccessfully"),
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : tr("failedToSaveConfiguration");
        setFeedback({ type: "error", message });
      }
    });
  };

  const handleTestSmsConfig = async () => {
    if (!smsTestTo.trim()) {
      setFeedback({ type: "error", message: tr("pleaseEnterATestPhoneNumber") });
      return;
    }
    setFeedback(null);
    setIsTestingSms(true);
    try {
      const res = await testSmsConfigAction({
        sid: twilioAccountSid,
        token: twilioAuthToken,
        phone: twilioPhoneNumber,
        testTo: smsTestTo,
      });

      if (res.success) {
        setFeedback({
          type: "success",
          message: tr("testSmsSentSuccessfullyCheckTheDestinationDeviceOr"),
        });
      } else {
        setFeedback({
          type: "error",
          message: tr("testSmsFailedValue0Message", { value0: res.error || tr("unknownError") }),
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : tr("failedToTestTwilioConnection");
      setFeedback({ type: "error", message });
    } finally {
      setIsTestingSms(false);
    }
  };

  const handleSaveSmsConfig = (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    startTransition(async () => {
      try {
        await updateSystemConfig("twilio_account_sid", twilioAccountSid.trim());
        await updateSystemConfig("twilio_auth_token", twilioAuthToken.trim());
        await updateSystemConfig("twilio_phone_number", twilioPhoneNumber.trim());

        setConfig((prev) => ({
          ...prev,
          twilio_account_sid: twilioAccountSid.trim(),
          twilio_auth_token: twilioAuthToken.trim(),
          twilio_phone_number: twilioPhoneNumber.trim(),
        }));
        setFeedback({ type: "success", message: tr("smsConfigurationSavedSuccessfully") });
      } catch (err) {
        const message = err instanceof Error ? err.message : tr("failedToSaveSmsConfiguration");
        setFeedback({ type: "error", message });
      }
    });
  };

  // Search handlers
  const handleUserSearch = async (val: string) => {
    setUserSearch(val);
    try {
      const filtered = await getAdminUsers(val);
      setUsers(filtered);
    } catch (err) {
      console.error(err);
    }
  };

  const handleEventSearch = async (val: string) => {
    setEventSearch(val);
    try {
      const filtered = await getAdminEvents(val);
      setEvents(filtered);
    } catch (err) {
      console.error(err);
    }
  };

  // Actions
  const handleRoleChange = (userId: string, newRole: "GUEST" | "HOST" | "ADMIN") => {
    setFeedback(null);
    startTransition(async () => {
      try {
        const res = await updateUserRole(userId, newRole);
        if (res.success) {
          setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u)));
          setFeedback({ type: "success", message: tr("userRoleUpdatedSuccessfully") });
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : tr("failedToUpdateRole");
        setFeedback({ type: "error", message });
      }
    });
  };

  const handleUserDelete = async (userId: string, name: string) => {
    const ok = await confirm({
      title: tr("scheduleDeletionTitle", { name }),
      message: tr("scheduleDeletionMessage"),
      confirmLabel: tr("scheduleDeletionAction"),
    });
    if (!ok) return;
    setFeedback(null);
    startTransition(async () => {
      try {
        const res = await deleteUserAccount(userId);
        if ("blocked" in res && res.blocked) {
          const titles = res.events.map((e) => `"${e.title}"`).join(", ");
          setFeedback({
            type: "error",
            message: tr("cannotScheduleDeletionValue0HasUpcomingPublishedEventsValue1Message", {
              value0: name,
              value1: titles,
            }),
          });
          return;
        }
        if (res.success) {
          const scheduledAt = new Date(res.scheduledAt);
          setUsers((prev) =>
            prev.map((u) =>
              u.id === userId
                ? { ...u, deletionRequestedAt: new Date(), deletionScheduledAt: scheduledAt }
                : u
            )
          );
          setFeedback({
            type: "success",
            message: tr("value0SAccountScheduledForDeletionOnValue1Message", {
              value0: name,
              value1: scheduledAt.toLocaleDateString(locale),
            }),
          });
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : tr("failedToScheduleDeletion");
        setFeedback({ type: "error", message });
      }
    });
  };

  const handleCancelDeletion = (userId: string, name: string) => {
    setFeedback(null);
    startTransition(async () => {
      try {
        const res = await cancelAccountDeletion(userId);
        if (res.success) {
          setUsers((prev) =>
            prev.map((u) =>
              u.id === userId ? { ...u, deletionRequestedAt: null, deletionScheduledAt: null } : u
            )
          );
          setFeedback({
            type: "success",
            message: tr("value0SAccountHasBeenRestoredMessage", { value0: name }),
          });
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : tr("failedToCancelDeletion");
        setFeedback({ type: "error", message });
      }
    });
  };

  const handleUserDeleteImmediately = async (userId: string, name: string) => {
    const ok = await confirm({
      title: tr("deleteNowTitle", { name }),
      message: tr("deleteNowMessage"),
      confirmLabel: tr("deleteNowAction"),
    });
    if (!ok) return;
    setFeedback(null);
    startTransition(async () => {
      try {
        const res = await deleteUserAccountImmediately(userId);
        if (res.success) {
          setUsers((prev) =>
            prev.map((u) =>
              u.id === userId
                ? {
                    ...u,
                    name: tr("deletedUser"),
                    email: null,
                    phone: null,
                    role: "GUEST",
                    deletionRequestedAt: null,
                    deletionScheduledAt: null,
                  }
                : u
            )
          );
          setFeedback({
            type: "success",
            message: tr("value0SAccountHasBeenPermanentlyDeletedAnonymizedMessage", {
              value0: name,
            }),
          });
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : tr("failedToDeleteImmediately");
        setFeedback({ type: "error", message });
      }
    });
  };

  const handleCreateUser = () => {
    setFeedback(null);
    startTransition(async () => {
      const res = await createAdminUser({
        name: createUserName,
        email: createUserEmail,
        phone: createUserPhone,
        role: createUserRole,
      });
      if (res.success) {
        setFeedback({ type: "success", message: tr("userCreatedAndWelcomeEmailSent") });
        setCreateUserOpen(false);
        setCreateUserName("");
        setCreateUserEmail("");
        setCreateUserPhone("");
        setCreateUserRole("GUEST");
        const updated = await getAdminUsers(userSearch);
        setUsers(updated);
      } else {
        setFeedback({ type: "error", message: res.error });
      }
    });
  };

  const handleEventDelete = async (eventId: string, title: string) => {
    const ok = await confirm({
      title: tr("deleteEventTitle", { title }),
      message: tr("deleteEventMessage"),
      confirmLabel: tr("deleteEventAction"),
    });
    if (!ok) return;
    setFeedback(null);
    startTransition(async () => {
      try {
        const res = await deleteEventAdmin(eventId);
        if (res.success) {
          setEvents((prev) => prev.filter((e) => e.id !== eventId));
          setFeedback({ type: "success", message: tr("eventModeratedAndDeleted") });
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : tr("failedToDeleteEvent");
        setFeedback({ type: "error", message });
      }
    });
  };

  const handleCreateCode = (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    startTransition(async () => {
      try {
        const res = await createInviteCode({
          code: newCode,
          maxUses: maxUses === "" ? null : Number(maxUses),
          expiresAt: expiresAt ? new Date(expiresAt) : null,
          note: note.trim() || null,
        });
        if (res.success) {
          setInviteCodes((prev) => [res.code, ...prev]);
          setNewCode("");
          setMaxUses("");
          setExpiresAt("");
          setNote("");
          setFeedback({ type: "success", message: tr("inviteCodeCreatedSuccessfully") });
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : tr("failedToCreateCode");
        setFeedback({ type: "error", message });
      }
    });
  };

  const handleRevokeCode = (id: string) => {
    setFeedback(null);
    startTransition(async () => {
      try {
        const res = await revokeInviteCode(id);
        if (res.success) {
          setInviteCodes((prev) => prev.filter((c) => c.id !== id));
          setFeedback({ type: "success", message: tr("inviteCodeRevoked") });
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : tr("failedToRevokeCode");
        setFeedback({ type: "error", message });
      }
    });
  };

  const handleToggleOpenReg = () => {
    setFeedback(null);
    const nextVal = config.open_registration === "true" ? "false" : "true";
    setConfig((prev) => ({ ...prev, open_registration: nextVal }));
    startTransition(async () => {
      try {
        await updateSystemConfig("open_registration", nextVal);
        setFeedback({
          type: "success",
          message: tr("openRegistrationToggledToValue0Message", {
            value0: nextVal === "true" ? tr("active") : tr("inactive"),
          }),
        });
      } catch (err) {
        setConfig((prev) => ({
          ...prev,
          open_registration: nextVal === "true" ? "false" : "true",
        })); // Revert
        const message = err instanceof Error ? err.message : tr("failedToUpdateConfiguration");
        setFeedback({ type: "error", message });
      }
    });
  };

  const handleToggleEmailEnabled = () => {
    setFeedback(null);
    const nextVal = config.email_enabled === "false" ? "true" : "false";
    setConfig((prev) => ({ ...prev, email_enabled: nextVal }));
    startTransition(async () => {
      try {
        await updateSystemConfig("email_enabled", nextVal);
        setFeedback({
          type: "success",
          message: tr("guestEmailNotificationsValue0Message", {
            value0: nextVal === "true" ? tr("enabled") : tr("disabled"),
          }),
        });
      } catch (err) {
        setConfig((prev) => ({
          ...prev,
          email_enabled: nextVal === "true" ? "false" : "true",
        }));
        const message = err instanceof Error ? err.message : tr("failedToUpdateConfiguration");
        setFeedback({ type: "error", message });
      }
    });
  };

  const handleToggleSmsEnabled = () => {
    setFeedback(null);
    const nextVal = config.sms_enabled === "true" ? "false" : "true";
    setConfig((prev) => ({ ...prev, sms_enabled: nextVal }));
    startTransition(async () => {
      try {
        await updateSystemConfig("sms_enabled", nextVal);
        setFeedback({
          type: "success",
          message: tr("smsNotificationsValue0Message", {
            value0: nextVal === "true" ? tr("enabled") : tr("disabled"),
          }),
        });
      } catch (err) {
        setConfig((prev) => ({
          ...prev,
          sms_enabled: nextVal === "true" ? "false" : "true",
        }));
        const message = err instanceof Error ? err.message : tr("failedToUpdateConfiguration");
        setFeedback({ type: "error", message });
      }
    });
  };

  const doSaveThemePreset = async (): Promise<boolean> => {
    if (!themePresetForm) return false;
    try {
      if (themePresetForm.id) {
        await updateThemePreset(themePresetForm.id, {
          name: themePresetForm.name,
          emoji: themePresetForm.emoji,
          base: themePresetForm.base,
          gradientFrom: themePresetForm.gradientFrom,
          gradientTo: themePresetForm.gradientTo,
          accentColor: themePresetForm.accentColor,
          seasonal: themePresetForm.seasonal,
          month: themePresetForm.month ?? null,
          cardOpacity: themePresetForm.cardOpacity ?? null,
          fontId: themePresetForm.fontId ?? null,
        });
        setThemePresets((prev) =>
          prev.map((p) => (p.id === themePresetForm.id ? { ...p, ...themePresetForm } : p))
        );
        setFeedback({ type: "success", message: tr("presetUpdated") });
      } else {
        const created = await createThemePreset({
          name: themePresetForm.name,
          emoji: themePresetForm.emoji,
          base: themePresetForm.base,
          gradientFrom: themePresetForm.gradientFrom,
          gradientTo: themePresetForm.gradientTo,
          accentColor: themePresetForm.accentColor,
          seasonal: themePresetForm.seasonal,
          month: themePresetForm.month ?? null,
          cardOpacity: themePresetForm.cardOpacity ?? null,
          fontId: themePresetForm.fontId ?? null,
        });
        setThemePresets((prev) => [...prev, created as AdminThemePreset]);
        setFeedback({ type: "success", message: tr("presetCreated") });
      }
      return true;
    } catch (err) {
      setFeedback({
        type: "error",
        message: err instanceof Error ? err.message : tr("failedToSavePreset"),
      });
      return false;
    }
  };

  const handleSaveThemePreset = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingPreset(true);
    const ok = await doSaveThemePreset();
    if (ok) setThemePresetForm(null);
    setIsSavingPreset(false);
  };

  const handleSaveThemePresetAsDefault = async () => {
    if (!themePresetForm?.id) return;
    setIsSavingPreset(true);
    const ok = await doSaveThemePreset();
    if (ok) {
      await saveThemePresetDefault(themePresetForm.id);
      const snap: ThemeSnapObj = {
        name: themePresetForm.name,
        emoji: themePresetForm.emoji,
        base: themePresetForm.base,
        gradientFrom: themePresetForm.gradientFrom,
        gradientTo: themePresetForm.gradientTo,
        accentColor: themePresetForm.accentColor,
        seasonal: themePresetForm.seasonal,
        month: themePresetForm.month ?? null,
        cardOpacity: themePresetForm.cardOpacity ?? null,
        fontId: themePresetForm.fontId ?? null,
      };
      setThemePresets((prev) =>
        prev.map((p) => (p.id === themePresetForm.id ? { ...p, defaultSnapshot: snap } : p))
      );
      setFeedback({ type: "success", message: tr("presetSavedAndSetAsNewDefault") });
      setThemePresetForm(null);
    }
    setIsSavingPreset(false);
  };

  const handleDeleteThemePreset = async (id: string) => {
    const ok = await confirm({
      title: tr("deletePresetTitle"),
      message: tr("deletePresetMessage"),
      confirmLabel: tr("deleteAction"),
    });
    if (!ok) return;
    try {
      await deleteThemePreset(id);
      setThemePresets((prev) => prev.filter((p) => p.id !== id));
      setFeedback({ type: "success", message: tr("presetDeleted") });
    } catch (err) {
      setFeedback({
        type: "error",
        message: err instanceof Error ? err.message : tr("failedToDeletePreset"),
      });
    }
  };

  const handleTogglePresetActive = async (preset: AdminThemePreset) => {
    try {
      await updateThemePreset(preset.id, { active: !preset.active });
      setThemePresets((prev) =>
        prev.map((p) => (p.id === preset.id ? { ...p, active: !p.active } : p))
      );
    } catch (err) {
      setFeedback({
        type: "error",
        message: err instanceof Error ? err.message : tr("failedToUpdatePreset"),
      });
    }
  };

  const TAB_META: Record<TabId, { title: string; description: string }> = {
    overview: {
      title: tr("overview2"),
      description: tr("aSnapshotOfUsersEventsAndRsvpsAcrossYour"),
    },
    users: {
      title: tr("userManagement"),
      description: tr("viewSearchAndManageAllRegisteredUsersAdjustRoles"),
    },
    events: {
      title: tr("eventModeration"),
      description: tr("reviewAndModerateActiveEventsDeleteEventsThatViolate"),
    },
    invites: {
      title: tr("hostSettings"),
      description: tr("controlHowNewHostsAccessThePlatformViaInvite"),
    },
    email: {
      title: tr("emailSettings"),
      description: tr("chooseYourEmailProviderAndConfigureDeliverySettings"),
    },
    sms: {
      title: tr("smsSettings"),
      description: tr("configureTwilioForSmsNotificationsAndAlerts"),
    },
    themes: {
      title: tr("themePresets2"),
      description: tr("manageThePresetThemesHostsCanPickFromIn"),
    },
    backups: {
      title: tr("databaseBackups"),
      description: tr("scheduleAutomatedBackupsAndManageYourDatabaseSnapshotHistory"),
    },
    docs: {
      title: tr("documentation"),
      description: tr("setupConfigurationAndOperationsGuidesForSelfHostingRsvp"),
    },
  };

  const filteredUsers = users.filter((u) => {
    if (roleFilter !== "ALL" && u.role !== roleFilter) return false;
    if (statusFilter === "PENDING_DELETE" && !u.deletionScheduledAt) return false;
    if (statusFilter === "ACTIVE" && (u.deletionScheduledAt || (!u.email && !u.phone)))
      return false;
    if (statusFilter === "DELETED" && (u.email || u.phone)) return false;
    return true;
  });

  return (
    <AppShell>
      <div
        style={{
          maxWidth: "1200px",
          margin: "40px auto",
          padding: "0 20px",
          boxSizing: "border-box",
        }}
      >
        {/* Banner */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: "16px",
            marginBottom: "32px",
          }}
        >
          {/* Hamburger trigger for the mobile drawer — sidebar is hidden below lg */}
          {/* The wrapper carries lg:hidden: the button's inline display would override it. */}
          <div className="lg:hidden" style={{ flexShrink: 0, marginTop: "4px" }}>
            <Button
              theme={T}
              variant="icon"
              type="button"
              aria-label={tr("openAdminNavigation")}
              onClick={() => setIsDrawerOpen(true)}
            >
              <Menu size={20} aria-hidden="true" />
            </Button>
          </div>
          <div>
            <h2
              style={{
                fontSize: "28px",
                fontWeight: 800,
                background: `linear-gradient(135deg, ${APP_SHELL.textPrimary}, ${APP_SHELL.textSecondary})`,
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              {TAB_META[activeTab].title}
            </h2>
            <p style={{ color: APP_SHELL.textSecondary, fontSize: "14px", marginTop: "4px" }}>
              {TAB_META[activeTab].description}
            </p>
          </div>
        </div>

        {/* Create User Modal */}
        <CreateUserModal
          createUserOpen={createUserOpen}
          setCreateUserOpen={setCreateUserOpen}
          createUserName={createUserName}
          setCreateUserName={setCreateUserName}
          createUserEmail={createUserEmail}
          setCreateUserEmail={setCreateUserEmail}
          createUserPhone={createUserPhone}
          setCreateUserPhone={setCreateUserPhone}
          createUserRole={createUserRole}
          setCreateUserRole={setCreateUserRole}
          handleCreateUser={handleCreateUser}
          isPending={isPending}
        />

        {confirmDialog}
        <Toast
          theme={T}
          toast={feedback && { tone: feedback.type, message: feedback.message }}
          onDismiss={() => setFeedback(null)}
        />

        {/* Content Layout */}
        <div className="flex flex-col lg:flex-row gap-8 lg:gap-10">
          {/* Sidebar Tabs */}
          <AdminSidebar
            activeTab={activeTab}
            handleTabChange={handleTabChange}
            setFeedback={setFeedback}
          />

          {/* Tab Content Panels */}
          <div className="flex-1 min-w-0">
            {/* PANEL: OVERVIEW */}
            {activeTab === "overview" && <OverviewTab initialStats={initialStats} />}

            {/* PANEL: USERS */}
            {activeTab === "users" && (
              <UsersTab
                userSearch={userSearch}
                handleUserSearch={handleUserSearch}
                roleFilter={roleFilter}
                setRoleFilter={setRoleFilter}
                statusFilter={statusFilter}
                setStatusFilter={setStatusFilter}
                setCreateUserOpen={setCreateUserOpen}
                filteredUsers={filteredUsers}
                handleRoleChange={handleRoleChange}
                handleCancelDeletion={handleCancelDeletion}
                handleUserDeleteImmediately={handleUserDeleteImmediately}
                handleUserDelete={handleUserDelete}
                sessionUserId={sessionUser?.id}
              />
            )}

            {/* PANEL: EVENTS */}
            {activeTab === "events" && (
              <EventsTab
                eventSearch={eventSearch}
                handleEventSearch={handleEventSearch}
                events={events}
                handleEventDelete={handleEventDelete}
              />
            )}

            {/* PANEL: HOST SETTINGS */}
            {activeTab === "invites" && (
              <InvitesTab
                config={config}
                handleToggleOpenReg={handleToggleOpenReg}
                handleCreateCode={handleCreateCode}
                newCode={newCode}
                setNewCode={setNewCode}
                maxUses={maxUses}
                setMaxUses={setMaxUses}
                expiresAt={expiresAt}
                setExpiresAt={setExpiresAt}
                note={note}
                setNote={setNote}
                isPending={isPending}
                inviteCodes={inviteCodes}
                handleRevokeCode={handleRevokeCode}
              />
            )}

            {/* PANEL: EMAIL */}
            {activeTab === "email" && (
              <EmailTab
                config={config}
                handleToggleEmailEnabled={handleToggleEmailEnabled}
                handleSaveEmailConfig={handleSaveEmailConfig}
                emailProvider={emailProvider}
                setEmailProvider={setEmailProvider}
                emailFrom={emailFrom}
                setEmailFrom={setEmailFrom}
                smtpHost={smtpHost}
                setSmtpHost={setSmtpHost}
                smtpPort={smtpPort}
                setSmtpPort={setSmtpPort}
                smtpSecure={smtpSecure}
                setSmtpSecure={setSmtpSecure}
                smtpUser={smtpUser}
                setSmtpUser={setSmtpUser}
                smtpPass={smtpPass}
                setSmtpPass={setSmtpPass}
                cfAccountId={cfAccountId}
                setCfAccountId={setCfAccountId}
                cfApiToken={cfApiToken}
                setCfApiToken={setCfApiToken}
                cfWorkerUrl={cfWorkerUrl}
                setCfWorkerUrl={setCfWorkerUrl}
                suggestedSubdomain={suggestedSubdomain}
                cfWorkerSecret={cfWorkerSecret}
                setCfWorkerSecret={setCfWorkerSecret}
                secretCopied={secretCopied}
                setSecretCopied={setSecretCopied}
                cfInboundForwardTo={cfInboundForwardTo}
                setCfInboundForwardTo={setCfInboundForwardTo}
                copied={copied}
                setCopied={setCopied}
                showCode={showCode}
                setShowCode={setShowCode}
                isPending={isPending}
                isTestingEmail={isTestingEmail}
                handleTestEmailConfig={handleTestEmailConfig}
              />
            )}

            {/* PANEL: SMS */}
            {activeTab === "sms" && (
              <SmsTab
                config={config}
                handleToggleSmsEnabled={handleToggleSmsEnabled}
                handleSaveSmsConfig={handleSaveSmsConfig}
                twilioAccountSid={twilioAccountSid}
                setTwilioAccountSid={setTwilioAccountSid}
                twilioAuthToken={twilioAuthToken}
                setTwilioAuthToken={setTwilioAuthToken}
                twilioPhoneNumber={twilioPhoneNumber}
                setTwilioPhoneNumber={setTwilioPhoneNumber}
                smsTestTo={smsTestTo}
                setSmsTestTo={setSmsTestTo}
                isPending={isPending}
                isTestingSms={isTestingSms}
                handleTestSmsConfig={handleTestSmsConfig}
              />
            )}

            {/* PANEL: BACKUPS */}
            {activeTab === "backups" && (
              <BackupsTab
                handleSaveBackupConfig={handleSaveBackupConfig}
                backupSchedule={backupSchedule}
                setBackupSchedule={setBackupSchedule}
                backupKeepCount={backupKeepCount}
                setBackupKeepCount={setBackupKeepCount}
                lastBackupTime={lastBackupTime}
                isSavingBackupConfig={isSavingBackupConfig}
                handleCreateBackup={handleCreateBackup}
                isBackupRunning={isBackupRunning}
                backups={backups}
                handleDeleteBackup={handleDeleteBackup}
              />
            )}

            {/* PANEL: THEME PRESETS */}
            {activeTab === "themes" && (
              <ThemesTab
                themePresets={themePresets}
                setThemePresetForm={setThemePresetForm}
                setThemePresetOriginal={setThemePresetOriginal}
                handleTogglePresetActive={handleTogglePresetActive}
                handleDeleteThemePreset={handleDeleteThemePreset}
              />
            )}

            {/* MODAL: Create / Edit Theme Preset */}
            <ThemePresetModal
              themePresetForm={themePresetForm}
              setThemePresetForm={setThemePresetForm}
              themePresetOriginal={themePresetOriginal}
              themePresets={themePresets}
              isSavingPreset={isSavingPreset}
              handleSaveThemePreset={handleSaveThemePreset}
              handleSaveThemePresetAsDefault={handleSaveThemePresetAsDefault}
            />

            {/* PANEL: DOCUMENTATION */}
            {activeTab === "docs" && <DocsPanel docs={initialDocs} />}
          </div>
          {/* Sliding Drawer for Mobile/Tablet */}
          <AdminMobileDrawer
            isDrawerOpen={isDrawerOpen}
            setIsDrawerOpen={setIsDrawerOpen}
            activeTab={activeTab}
            handleTabChange={handleTabChange}
            setFeedback={setFeedback}
          />
        </div>
      </div>
    </AppShell>
  );
}
