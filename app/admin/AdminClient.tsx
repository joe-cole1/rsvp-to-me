"use client";

import { useState, useEffect, useTransition } from "react";
import { Eye, EyeOff } from "lucide-react";
import { APP_SHELL } from "@/lib/theme";
import { AppShell } from "@/components/ui/AppShell";
import { AppNavLogo } from "@/components/ui/AppNav";
import ProfileDropdown from "@/components/ui/ProfileDropdown";
import {
  updateUserRole,
  deleteUserAccount,
  deleteEventAdmin,
  createInviteCode,
  revokeInviteCode,
  updateSystemConfig,
  getAdminUsers,
  getAdminEvents,
  testEmailConfigAction,
  createBackupAction,
  listBackupsAction,
  deleteBackupAction,
  updateBackupConfigAction,
} from "@/app/actions/admin";

interface AdminUser {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  role: "GUEST" | "HOST" | "ADMIN";
  createdAt: Date;
  _count: {
    events: number;
    rsvps: number;
  };
}

interface AdminEvent {
  id: string;
  title: string;
  slug: string;
  startAt: Date;
  status: string;
  visibility: string;
  hostName: string;
  hostEmail: string;
  rsvpCount: number;
}

interface AdminInviteCode {
  id: string;
  code: string;
  uses: number;
  maxUses: number | null;
  expiresAt: Date | null;
  note: string | null;
  createdAt: Date;
}

interface BackupFile {
  filename: string;
  sizeBytes: number;
  createdAt: Date;
}

interface BackupConfig {
  backup_schedule: string;
  backup_keep_count: number;
  last_backup_time: string;
}

interface AdminClientProps {
  initialStats: {
    totalUsers: number;
    totalEvents: number;
    totalRsvps: number;
    totalCheckIns: number;
    totalInviteCodes: number;
  };
  initialUsers: AdminUser[];
  initialEvents: AdminEvent[];
  initialInviteCodes: AdminInviteCode[];
  initialConfig: Record<string, string>;
  initialBackupConfig: BackupConfig;
  initialBackups: BackupFile[];
  sessionUser: {
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
  sessionUser,
}: AdminClientProps) {
  const [activeTab, setActiveTab] = useState<"overview" | "users" | "events" | "invites" | "settings" | "backups">("overview");
  const [copied, setCopied] = useState(false);

  const [users, setUsers] = useState(initialUsers);
  const [events, setEvents] = useState(initialEvents);
  const [inviteCodes, setInviteCodes] = useState(initialInviteCodes);
  const [config, setConfig] = useState(initialConfig);
  
  // Backup state
  const [backups, setBackups] = useState<BackupFile[]>(initialBackups);
  const [backupSchedule, setBackupSchedule] = useState(initialBackupConfig.backup_schedule);
  const [backupKeepCount, setBackupKeepCount] = useState<number>(initialBackupConfig.backup_keep_count);
  const [lastBackupTime, setLastBackupTime] = useState(initialBackupConfig.last_backup_time);
  const [isBackupRunning, setIsBackupRunning] = useState(false);
  const [isSavingBackupConfig, setIsSavingBackupConfig] = useState(false);

  const [userSearch, setUserSearch] = useState("");
  const [eventSearch, setEventSearch] = useState("");

  const [newCode, setNewCode] = useState("");
  const [maxUses, setMaxUses] = useState<number | "">("");
  const [expiresAt, setExpiresAt] = useState("");
  const [note, setNote] = useState("");

  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  useEffect(() => {
    if (feedback) {
      const timer = setTimeout(() => setFeedback(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [feedback]);

  const [emailProvider, setEmailProvider] = useState(config.email_provider || "console");
  const [emailFrom, setEmailFrom] = useState(config.email_from || "");
  const [smtpHost, setSmtpHost] = useState(config.smtp_host || "");
  const [smtpPort, setSmtpPort] = useState(config.smtp_port || "587");
  const [smtpSecure, setSmtpSecure] = useState(config.smtp_secure === "true");
  const [smtpUser, setSmtpUser] = useState(config.smtp_user || "");
  const [smtpPass, setSmtpPass] = useState(config.smtp_pass || "");
  const [cfWorkerUrl, setCfWorkerUrl] = useState(config.cloudflare_worker_email_url || "");
  const [cfWorkerSecret, setCfWorkerSecret] = useState(config.cloudflare_worker_api_secret || "");
  const [cfInboundForwardTo, setCfInboundForwardTo] = useState(config.cloudflare_inbound_forward_to || sessionUser?.email || "");
  const [cfAccountId, setCfAccountId] = useState(config.cloudflare_account_id || "");
  const [cfApiToken, setCfApiToken] = useState(config.cloudflare_api_token || "");
  const [showCfApiToken, setShowCfApiToken] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [secretCopied, setSecretCopied] = useState(false);
  const [suggestedSubdomain, setSuggestedSubdomain] = useState("your-subdomain");

  const [showCode, setShowCode] = useState(false);
  const [isTestingEmail, setIsTestingEmail] = useState(false);

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
        setFeedback({ type: "success", message: `Backup created: ${res.filename}` });
        const updated = await listBackupsAction();
        setBackups(updated);
        setLastBackupTime(new Date().toISOString());
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to create backup.";
      setFeedback({ type: "error", message: msg });
    } finally {
      setIsBackupRunning(false);
    }
  };

  const handleDeleteBackup = async (filename: string) => {
    if (!confirm(`Are you sure you want to delete backup ${filename}?`)) return;
    setFeedback(null);
    try {
      const res = await deleteBackupAction(filename);
      if (res.success) {
        setFeedback({ type: "success", message: "Backup deleted successfully." });
        const updated = await listBackupsAction();
        setBackups(updated);
      } else {
        setFeedback({ type: "error", message: "Failed to delete backup." });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to delete backup.";
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
        setFeedback({ type: "success", message: "Backup configuration updated successfully." });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to update backup configuration.";
      setFeedback({ type: "error", message: msg });
    } finally {
      setIsSavingBackupConfig(false);
    }
  };

  const handleTestEmailConfig = async () => {
    setFeedback(null);
    setIsTestingEmail(true);
    try {
      const res = await testEmailConfigAction({
        provider: emailProvider,
        from: emailFrom,
        smtpHost,
        smtpPort,
        smtpSecure,
        smtpUser,
        smtpPass,
        cfWorkerUrl,
        cfWorkerSecret,
        cfAccountId,
        cfApiToken,
      });

      if (res.success) {
        setFeedback({
          type: "success",
          message: `Test email sent successfully to ${sessionUser?.email ?? "your email"}. Please check your inbox (and spam folder)!`,
        });
      } else {
        setFeedback({
          type: "error",
          message: `Test connection failed: ${res.error || "Unknown error"}`,
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to test connection.";
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
        await updateSystemConfig("email_provider", emailProvider);
        await updateSystemConfig("email_from", emailFrom.trim());
        await updateSystemConfig("smtp_host", smtpHost.trim());
        await updateSystemConfig("smtp_port", smtpPort.trim());
        await updateSystemConfig("smtp_secure", smtpSecure ? "true" : "false");
        await updateSystemConfig("smtp_user", smtpUser.trim());
        await updateSystemConfig("smtp_pass", smtpPass.trim());
        await updateSystemConfig("cloudflare_worker_email_url", cfWorkerUrl.trim());
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
          cloudflare_worker_email_url: cfWorkerUrl.trim(),
          cloudflare_worker_api_secret: cfWorkerSecret.trim(),
          cloudflare_inbound_forward_to: cfInboundForwardTo.trim(),
          cloudflare_account_id: cfAccountId.trim(),
          cloudflare_api_token: cfApiToken.trim(),
        }));
        setFeedback({ type: "success", message: "Email delivery configuration saved successfully." });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to save configuration.";
        setFeedback({ type: "error", message });
      }
    });
  };

  const generateWorkerCode = () => {
    return `// WARNING: If you modify this template, make sure to also update the file
// worker/worker.ts to keep them in sync.

export default {
  async email(message, env) {
    if (!env.INBOUND_FORWARD_TO) {
      throw new Error("INBOUND_FORWARD_TO environment variable is not set.");
    }
    await message.forward(env.INBOUND_FORWARD_TO);
    await env.EMAIL.send({
      from: extractRawEmail(message.to),
      to: message.from,
      subject: \`Re: \${message.headers.get("subject") ?? "Your RSVP"}\`,
      text: "Thanks for your reply. The event host has been notified.",
    });
  },

  async fetch(request, env) {
    if (!env.WORKER_API_SECRET) {
      return new Response("Unauthorized: WORKER_API_SECRET environment variable is not set.", { status: 401 });
    }
    if (request.headers.get("Authorization") !== \`Bearer \${env.WORKER_API_SECRET}\`) {
      return new Response("Unauthorized", { status: 401 });
    }
    if (request.method !== "POST" || new URL(request.url).pathname !== "/send") {
      return new Response("Not found", { status: 404 });
    }

    try {
      const body = await request.json();
      if (!body.from || !body.to || !body.subject || (!body.html && !body.text)) {
        return new Response("Missing required fields", { status: 422 });
      }

      const rawFrom = extractRawEmail(body.from);
      const rawReplyTo = body.replyTo ? extractRawEmail(body.replyTo) : undefined;

      const recipients = Array.isArray(body.to) ? body.to : [body.to];
      const bcc = body.bcc ? (Array.isArray(body.bcc) ? body.bcc : [body.bcc]) : [];
      const allRecipients = [...recipients, ...bcc];

      await env.EMAIL.send({
        from: rawFrom,
        to: recipients,
        bcc: bcc.length > 0 ? bcc : undefined,
        subject: body.subject,
        html: body.html || undefined,
        text: body.text || undefined,
        replyTo: rawReplyTo,
      });

      return Response.json({ ok: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Internal Server Error";
      return new Response(message, { status: 500 });
    }
  },
};

function extractRawEmail(fromStr) {
  const match = fromStr.match(/<([^>]+)>/);
  return match ? match[1].trim() : fromStr.trim();
}
`;
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
          setFeedback({ type: "success", message: "User role updated successfully!" });
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to update role.";
        setFeedback({ type: "error", message });
      }
    });
  };

  const handleUserDelete = (userId: string, name: string) => {
    if (!confirm(`Are you sure you want to delete ${name}'s account? This will permanently delete all events hosted by them and cannot be undone.`)) {
      return;
    }
    setFeedback(null);
    startTransition(async () => {
      try {
        const res = await deleteUserAccount(userId);
        if (res.success) {
          setUsers((prev) => prev.filter((u) => u.id !== userId));
          setFeedback({ type: "success", message: "User account deleted successfully." });
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to delete account.";
        setFeedback({ type: "error", message });
      }
    });
  };

  const handleEventDelete = (eventId: string, title: string) => {
    if (!confirm(`Are you sure you want to moderate/delete the event "${title}"? This is permanent.`)) {
      return;
    }
    setFeedback(null);
    startTransition(async () => {
      try {
        const res = await deleteEventAdmin(eventId);
        if (res.success) {
          setEvents((prev) => prev.filter((e) => e.id !== eventId));
          setFeedback({ type: "success", message: "Event moderated and deleted." });
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to delete event.";
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
          setFeedback({ type: "success", message: "Invite code created successfully." });
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to create code.";
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
          setFeedback({ type: "success", message: "Invite code revoked." });
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to revoke code.";
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
        setFeedback({ type: "success", message: `Open registration toggled to ${nextVal === "true" ? "Active" : "Inactive"}.` });
      } catch (err) {
        setConfig((prev) => ({ ...prev, open_registration: nextVal === "true" ? "false" : "true" })); // Revert
        const message = err instanceof Error ? err.message : "Failed to update configuration.";
        setFeedback({ type: "error", message });
      }
    });
  };

  return (
    <AppShell>
      <AppNavLogo
        href="/dashboard"
        trailing={
          sessionUser ? (
            <ProfileDropdown user={sessionUser} />
          ) : undefined
        }
      />

      <div
        style={{
          maxWidth: "1200px",
          margin: "40px auto",
          padding: "0 20px",
          boxSizing: "border-box",
        }}
      >
        {/* Banner */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "32px" }}>
          <div>
            <h2 style={{ fontSize: "28px", fontWeight: 800, color: APP_SHELL.textPrimary, margin: 0 }}>
              🛡️ System Administration
            </h2>
            <p style={{ color: APP_SHELL.textSecondary, fontSize: "14px", marginTop: "4px" }}>
              Oversee users, moderate events, manage invite codes, and modify configuration.
            </p>
          </div>
        </div>

        {/* Feedback Alerts */}
        {feedback && (
          <div
            onClick={() => setFeedback(null)}
            style={{
              position: "fixed",
              top: "20px",
              left: "50%",
              transform: "translateX(-50%)",
              zIndex: 10000,
              padding: "12px 20px",
              borderRadius: "12px",
              backgroundColor: APP_SHELL.cardBg,
              border: `1px solid ${feedback.type === "success" ? "#22c55e" : "#ef4444"}`,
              color: feedback.type === "success" ? "#22c55e" : "#ef4444",
              boxShadow: "0 8px 30px rgba(0, 0, 0, 0.15)",
              fontSize: "14px",
              fontWeight: 600,
              backdropFilter: "blur(8px)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              maxWidth: "90%",
              width: "max-content",
              boxSizing: "border-box"
            }}
          >
            <span>{feedback.type === "success" ? "✓" : "⚠️"}</span>
            <span>{feedback.message}</span>
          </div>
        )}

        {/* Content Layout */}
        <div className="flex flex-col lg:flex-row gap-8 lg:gap-10">
          {/* Sidebar Tabs */}
          <div
            className="flex lg:flex-col overflow-x-auto lg:overflow-visible gap-2 pb-3 lg:pb-0 lg:w-[240px] shrink-0 border-b border-white/5 lg:border-b-0 mb-4 lg:mb-0 scrollbar-none"
            style={{ display: "flex" }}
          >
            {(
              [
                { id: "overview", label: "📊 Overview" },
                { id: "users", label: "👥 User Management" },
                { id: "events", label: "🎈 Event Moderation" },
                { id: "invites", label: "🔑 Invite Codes" },
                { id: "settings", label: "⚙️ Global Config" },
                { id: "backups", label: "💾 Database Backups" },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  setFeedback(null);
                }}
                style={{
                  textAlign: "left",
                  padding: "10px 14px",
                  borderRadius: "12px",
                  border: "none",
                  backgroundColor: activeTab === tab.id ? APP_SHELL.accent : "transparent",
                  color: activeTab === tab.id ? "#fff" : APP_SHELL.textSecondary,
                  fontSize: "14px",
                  fontWeight: activeTab === tab.id ? 700 : 600,
                  cursor: "pointer",
                  transition: "background 0.2s, color 0.2s",
                  whiteSpace: "nowrap",
                }}
                onMouseEnter={(e) => {
                  if (activeTab !== tab.id) e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.04)";
                }}
                onMouseLeave={(e) => {
                  if (activeTab !== tab.id) e.currentTarget.style.backgroundColor = "transparent";
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content Panels */}
          <div className="flex-1 min-w-0">
            {/* PANEL: OVERVIEW */}
            {activeTab === "overview" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "32px" }}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  {[
                    { label: "Total Users", val: initialStats.totalUsers, glow: "rgba(168, 85, 247, 0.4)", emoji: "👥" },
                    { label: "Total Events", val: initialStats.totalEvents, glow: "rgba(236, 72, 153, 0.4)", emoji: "🎈" },
                    { label: "Total RSVPs", val: initialStats.totalRsvps, glow: "rgba(16, 185, 129, 0.4)", emoji: "✓" },
                    { label: "Guest Check-Ins", val: initialStats.totalCheckIns, glow: "rgba(14, 165, 233, 0.4)", emoji: "📍" },
                  ].map((card, idx) => (
                    <div
                      key={idx}
                      style={{
                        backgroundColor: APP_SHELL.cardBg,
                        border: `1px solid ${APP_SHELL.cardBorder}`,
                        borderRadius: APP_SHELL.cardRadius,
                        padding: "24px",
                        position: "relative",
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          position: "absolute",
                          right: "-20px",
                          bottom: "-20px",
                          fontSize: "80px",
                          opacity: 0.05,
                          userSelect: "none",
                        }}
                      >
                        {card.emoji}
                      </div>
                      <div style={{ color: APP_SHELL.textSecondary, fontSize: "14px", fontWeight: 600 }}>{card.label}</div>
                      <div style={{ color: APP_SHELL.textPrimary, fontSize: "40px", fontWeight: 800, marginTop: "12px" }}>
                        {card.val}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* PANEL: USERS */}
            {activeTab === "users" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
                <input
                  type="text"
                  placeholder="Search users by name, email, or phone..."
                  value={userSearch}
                  onChange={(e) => handleUserSearch(e.target.value)}
                  style={{
                    width: "100%",
                    backgroundColor: APP_SHELL.inputBg,
                    border: `1px solid ${APP_SHELL.inputBorder}`,
                    borderRadius: APP_SHELL.inputRadius,
                    padding: "12px 16px",
                    color: APP_SHELL.textPrimary,
                    fontSize: "14px",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />

                <div
                  style={{
                    backgroundColor: APP_SHELL.cardBg,
                    border: `1px solid ${APP_SHELL.cardBorder}`,
                    borderRadius: APP_SHELL.cardRadius,
                    overflowX: "auto",
                  }}
                >
                  <div style={{ minWidth: "700px" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
                      <thead>
                        <tr style={{ borderBottom: `1px solid ${APP_SHELL.navBorder}`, color: APP_SHELL.textSecondary, textAlign: "left" }}>
                          <th style={{ padding: "16px" }}>User</th>
                          <th style={{ padding: "16px" }}>Contact</th>
                          <th style={{ padding: "16px" }}>Role</th>
                          <th style={{ padding: "16px", textAlign: "right" }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {users.length === 0 ? (
                          <tr>
                            <td colSpan={4} style={{ padding: "32px", textAlign: "center", color: APP_SHELL.textMuted }}>
                              No users found.
                            </td>
                          </tr>
                        ) : (
                          users.map((u) => (
                            <tr key={u.id} style={{ borderBottom: `1px solid ${APP_SHELL.navBorder}` }}>
                              <td style={{ padding: "16px" }}>
                                <div style={{ fontWeight: 700, color: APP_SHELL.textPrimary }}>{u.name || "Unnamed User"}</div>
                                <div style={{ fontSize: "11px", color: APP_SHELL.textMuted }}>Registered {new Date(u.createdAt).toLocaleDateString()}</div>
                              </td>
                              <td style={{ padding: "16px" }}>
                                <div style={{ color: APP_SHELL.textPrimary }}>{u.email || "-"}</div>
                                <div style={{ fontSize: "12px", color: APP_SHELL.textSecondary }}>{u.phone || "-"}</div>
                              </td>
                              <td style={{ padding: "16px" }}>
                                <select
                                  value={u.role}
                                  onChange={(e) => handleRoleChange(u.id, e.target.value as "GUEST" | "HOST" | "ADMIN")}
                                  style={{
                                    backgroundColor: APP_SHELL.inputBg,
                                    border: `1px solid ${APP_SHELL.inputBorder}`,
                                    color: APP_SHELL.textPrimary,
                                    borderRadius: "6px",
                                    padding: "4px 8px",
                                    fontSize: "12px",
                                    outline: "none",
                                    colorScheme: "dark",
                                  }}
                                >
                                  <option value="GUEST" style={{ backgroundColor: "#12091f", color: "#ffffff" }}>GUEST</option>
                                  <option value="HOST" style={{ backgroundColor: "#12091f", color: "#ffffff" }}>HOST</option>
                                  <option value="ADMIN" style={{ backgroundColor: "#12091f", color: "#ffffff" }}>ADMIN</option>
                                </select>
                              </td>
                              <td style={{ padding: "16px", textAlign: "right" }}>
                                <button
                                  onClick={() => handleUserDelete(u.id, u.name || u.email || "Unknown User")}
                                  style={{
                                    backgroundColor: "transparent",
                                    border: "none",
                                    color: "#ef4444",
                                    cursor: "pointer",
                                    fontWeight: 600,
                                    fontSize: "13px",
                                  }}
                                >
                                  Delete
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* PANEL: EVENTS */}
            {activeTab === "events" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
                <input
                  type="text"
                  placeholder="Search events by title, slug, or host details..."
                  value={eventSearch}
                  onChange={(e) => handleEventSearch(e.target.value)}
                  style={{
                    width: "100%",
                    backgroundColor: APP_SHELL.inputBg,
                    border: `1px solid ${APP_SHELL.inputBorder}`,
                    borderRadius: APP_SHELL.inputRadius,
                    padding: "12px 16px",
                    color: APP_SHELL.textPrimary,
                    fontSize: "14px",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />

                <div
                  style={{
                    backgroundColor: APP_SHELL.cardBg,
                    border: `1px solid ${APP_SHELL.cardBorder}`,
                    borderRadius: APP_SHELL.cardRadius,
                    overflowX: "auto",
                  }}
                >
                  <div style={{ minWidth: "700px" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
                      <thead>
                        <tr style={{ borderBottom: `1px solid ${APP_SHELL.navBorder}`, color: APP_SHELL.textSecondary, textAlign: "left" }}>
                          <th style={{ padding: "16px" }}>Event Info</th>
                          <th style={{ padding: "16px" }}>Host</th>
                          <th style={{ padding: "16px" }}>Stats</th>
                          <th style={{ padding: "16px", textAlign: "right" }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {events.length === 0 ? (
                          <tr>
                            <td colSpan={4} style={{ padding: "32px", textAlign: "center", color: APP_SHELL.textMuted }}>
                              No events found.
                            </td>
                          </tr>
                        ) : (
                          events.map((e) => (
                            <tr key={e.id} style={{ borderBottom: `1px solid ${APP_SHELL.navBorder}` }}>
                              <td style={{ padding: "16px" }}>
                                <div style={{ fontWeight: 700, color: APP_SHELL.textPrimary }}>{e.title}</div>
                                <div style={{ fontSize: "12px", color: APP_SHELL.textSecondary, marginTop: "2px" }}>
                                  Date: {new Date(e.startAt).toLocaleString()} · status: {e.status}
                                </div>
                              </td>
                              <td style={{ padding: "16px" }}>
                                <div style={{ color: APP_SHELL.textPrimary }}>{e.hostName}</div>
                                <div style={{ fontSize: "12px", color: APP_SHELL.textSecondary }}>{e.hostEmail}</div>
                              </td>
                              <td style={{ padding: "16px" }}>
                                <div style={{ color: APP_SHELL.textPrimary }}>{e.rsvpCount} RSVPs</div>
                                <span style={{ fontSize: "10px", color: APP_SHELL.textSecondary, textTransform: "uppercase" }}>{e.visibility}</span>
                              </td>
                              <td style={{ padding: "16px", textAlign: "right" }}>
                                <a
                                  href={`/e/${e.slug}?admin=1`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  style={{
                                    color: APP_SHELL.accent,
                                    textDecoration: "none",
                                    fontWeight: 600,
                                    fontSize: "13px",
                                    marginRight: "16px",
                                  }}
                                >
                                  Moderate
                                </a>
                                <button
                                  onClick={() => handleEventDelete(e.id, e.title)}
                                  style={{
                                    backgroundColor: "transparent",
                                    border: "none",
                                    color: "#ef4444",
                                    cursor: "pointer",
                                    fontWeight: 600,
                                    fontSize: "13px",
                                  }}
                                >
                                  Delete
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* PANEL: INVITE CODES */}
            {activeTab === "invites" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "32px" }}>
                {/* Form */}
                <form
                  onSubmit={handleCreateCode}
                  className="grid grid-cols-1 sm:grid-cols-2 gap-5"
                  style={{
                    backgroundColor: APP_SHELL.cardBg,
                    border: `1px solid ${APP_SHELL.cardBorder}`,
                    borderRadius: APP_SHELL.cardRadius,
                    padding: "24px",
                  }}
                >
                  <div className="col-span-1 sm:col-span-2">
                    <h3 style={{ fontSize: "16px", fontWeight: 700, color: APP_SHELL.textPrimary, margin: 0 }}>
                      Generate Host Invite Code
                    </h3>
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: APP_SHELL.textSecondary, marginBottom: "6px" }}>
                      Invite Code String
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. VIPHOST2026"
                      value={newCode}
                      onChange={(e) => setNewCode(e.target.value)}
                      style={{
                        width: "100%",
                        backgroundColor: APP_SHELL.inputBg,
                        border: `1px solid ${APP_SHELL.inputBorder}`,
                        borderRadius: APP_SHELL.inputRadius,
                        padding: "10px 14px",
                        color: APP_SHELL.textPrimary,
                        fontSize: "13px",
                        outline: "none",
                        boxSizing: "border-box",
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: APP_SHELL.textSecondary, marginBottom: "6px" }}>
                      Max Uses (Optional)
                    </label>
                    <input
                      type="number"
                      placeholder="Unlimited if empty"
                      value={maxUses}
                      onChange={(e) => setMaxUses(e.target.value === "" ? "" : Number(e.target.value))}
                      style={{
                        width: "100%",
                        backgroundColor: APP_SHELL.inputBg,
                        border: `1px solid ${APP_SHELL.inputBorder}`,
                        borderRadius: APP_SHELL.inputRadius,
                        padding: "10px 14px",
                        color: APP_SHELL.textPrimary,
                        fontSize: "13px",
                        outline: "none",
                        boxSizing: "border-box",
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: APP_SHELL.textSecondary, marginBottom: "6px" }}>
                      Expires At (Optional)
                    </label>
                    <input
                      type="datetime-local"
                      value={expiresAt}
                      onChange={(e) => setExpiresAt(e.target.value)}
                      style={{
                        width: "100%",
                        backgroundColor: APP_SHELL.inputBg,
                        border: `1px solid ${APP_SHELL.inputBorder}`,
                        borderRadius: APP_SHELL.inputRadius,
                        padding: "10px 14px",
                        color: APP_SHELL.textPrimary,
                        fontSize: "13px",
                        outline: "none",
                        boxSizing: "border-box",
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: APP_SHELL.textSecondary, marginBottom: "6px" }}>
                      Note / Description
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Invite code for VIP sponsors"
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      style={{
                        width: "100%",
                        backgroundColor: APP_SHELL.inputBg,
                        border: `1px solid ${APP_SHELL.inputBorder}`,
                        borderRadius: APP_SHELL.inputRadius,
                        padding: "10px 14px",
                        color: APP_SHELL.textPrimary,
                        fontSize: "13px",
                        outline: "none",
                        boxSizing: "border-box",
                      }}
                    />
                  </div>

                  <div className="col-span-1 sm:col-span-2 flex justify-end mt-2">
                    <button
                      type="submit"
                      disabled={isPending}
                      style={{
                        backgroundColor: APP_SHELL.accent,
                        border: "none",
                        color: "#fff",
                        borderRadius: "10px",
                        padding: "10px 20px",
                        fontSize: "13px",
                        fontWeight: 700,
                        cursor: "pointer",
                        opacity: isPending ? 0.6 : 1,
                      }}
                    >
                      Generate Code
                    </button>
                  </div>
                </form>

                {/* List */}
                <div
                  style={{
                    backgroundColor: APP_SHELL.cardBg,
                    border: `1px solid ${APP_SHELL.cardBorder}`,
                    borderRadius: APP_SHELL.cardRadius,
                    overflowX: "auto",
                  }}
                >
                  <div style={{ minWidth: "700px" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
                      <thead>
                        <tr style={{ borderBottom: `1px solid ${APP_SHELL.navBorder}`, color: APP_SHELL.textSecondary, textAlign: "left" }}>
                          <th style={{ padding: "16px" }}>Code</th>
                          <th style={{ padding: "16px" }}>Usage</th>
                          <th style={{ padding: "16px" }}>Expirations / Notes</th>
                          <th style={{ padding: "16px", textAlign: "right" }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {inviteCodes.length === 0 ? (
                          <tr>
                            <td colSpan={4} style={{ padding: "32px", textAlign: "center", color: APP_SHELL.textMuted }}>
                              No active invite codes.
                            </td>
                          </tr>
                        ) : (
                          inviteCodes.map((c) => (
                            <tr key={c.id} style={{ borderBottom: `1px solid ${APP_SHELL.navBorder}` }}>
                              <td style={{ padding: "16px" }}>
                                <span style={{ fontFamily: "monospace", fontSize: "14px", fontWeight: 700, color: APP_SHELL.accent }}>
                                  {c.code}
                                </span>
                              </td>
                              <td style={{ padding: "16px", color: APP_SHELL.textPrimary }}>
                                {c.uses} / {c.maxUses ?? "∞"} uses
                              </td>
                              <td style={{ padding: "16px" }}>
                                {c.expiresAt ? (
                                  <div style={{ fontSize: "12px", color: "#f87171" }}>
                                    Expires: {new Date(c.expiresAt).toLocaleDateString()}
                                  </div>
                                ) : (
                                  <div style={{ fontSize: "12px", color: "#4ade80" }}>Never expires</div>
                                )}
                                {c.note && <div style={{ fontSize: "11px", color: APP_SHELL.textMuted, marginTop: "2px" }}>Note: {c.note}</div>}
                              </td>
                              <td style={{ padding: "16px", textAlign: "right" }}>
                                <button
                                  onClick={() => handleRevokeCode(c.id)}
                                  style={{
                                    backgroundColor: "transparent",
                                    border: "none",
                                    color: "#ef4444",
                                    cursor: "pointer",
                                    fontWeight: 600,
                                    fontSize: "13px",
                                  }}
                                >
                                  Revoke
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* PANEL: SETTINGS */}
            {activeTab === "settings" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
                {/* Section 1: Global System Configuration */}
                <div
                  style={{
                    backgroundColor: APP_SHELL.cardBg,
                    border: `1px solid ${APP_SHELL.cardBorder}`,
                    borderRadius: APP_SHELL.cardRadius,
                    padding: "24px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "24px",
                  }}
                >
                  <div>
                    <h3 style={{ fontSize: "18px", fontWeight: 700, color: APP_SHELL.textPrimary, margin: 0 }}>
                      Global System Configuration
                    </h3>
                    <p style={{ color: APP_SHELL.textSecondary, fontSize: "13px", marginTop: "4px" }}>
                      Toggles stored in database taking priority over environment variables.
                    </p>
                  </div>

                  <div style={{ height: "1px", backgroundColor: APP_SHELL.navBorder }} />

                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: "14px", color: APP_SHELL.textPrimary }}>Open Host Registration</div>
                      <div style={{ fontSize: "12px", color: APP_SHELL.textSecondary, marginTop: "2px" }}>
                        Allow anyone to sign up as a host without entering an invite code.
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleToggleOpenReg}
                      style={{
                        width: "50px",
                        height: "26px",
                        borderRadius: "13px",
                        border: "none",
                        backgroundColor: config.open_registration === "true" ? APP_SHELL.accent : "rgba(255,255,255,0.1)",
                        cursor: "pointer",
                        position: "relative",
                        transition: "background-color 0.2s",
                        padding: 0,
                      }}
                    >
                      <div
                        style={{
                          width: "20px",
                          height: "20px",
                          borderRadius: "50%",
                          backgroundColor: "#fff",
                          position: "absolute",
                          top: "3px",
                          left: config.open_registration === "true" ? "27px" : "3px",
                          transition: "left 0.2s",
                        }}
                      />
                    </button>
                  </div>
                </div>

                {/* Section 2: Server Configuration & Email Delivery */}
                <div
                  style={{
                    backgroundColor: APP_SHELL.cardBg,
                    border: `1px solid ${APP_SHELL.cardBorder}`,
                    borderRadius: APP_SHELL.cardRadius,
                    padding: "24px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "24px",
                  }}
                >
                  <div>
                    <h3 style={{ fontSize: "18px", fontWeight: 700, color: APP_SHELL.textPrimary, margin: 0 }}>
                      Server Configuration & Email Delivery
                    </h3>
                    <p style={{ color: APP_SHELL.textSecondary, fontSize: "13px", marginTop: "4px" }}>
                      Choose your email provider and configure settings (database config overrides env variables).
                    </p>
                  </div>

                  <div style={{ height: "1px", backgroundColor: APP_SHELL.navBorder }} />

                  <form onSubmit={handleSaveEmailConfig} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                    <div>
                      <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: APP_SHELL.textSecondary, marginBottom: "6px" }}>
                        Email Provider
                      </label>
                      <select
                        value={emailProvider}
                        onChange={(e) => setEmailProvider(e.target.value)}
                        style={{
                          width: "100%",
                          backgroundColor: APP_SHELL.inputBg,
                          border: `1px solid ${APP_SHELL.inputBorder}`,
                          borderRadius: APP_SHELL.inputRadius,
                          padding: "10px 14px",
                          color: APP_SHELL.textPrimary,
                          fontSize: "13px",
                          outline: "none",
                          boxSizing: "border-box",
                          colorScheme: "dark",
                        }}
                      >
                        <option value="console" style={{ backgroundColor: "#12091f", color: "#ffffff" }}>Console Fallback (Local Dev / Logging)</option>
                        <option value="smtp" style={{ backgroundColor: "#12091f", color: "#ffffff" }}>SMTP Server</option>
                        <option value="cloudflare" style={{ backgroundColor: "#12091f", color: "#ffffff" }}>Cloudflare Workers</option>
                        <option value="cloudflare_api" style={{ backgroundColor: "#12091f", color: "#ffffff" }}>Cloudflare Email REST API</option>
                      </select>
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: APP_SHELL.textSecondary, marginBottom: "6px" }}>
                        From Address
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. RSVP to Me <noreply@yourdomain.com>"
                        value={emailFrom}
                        onChange={(e) => setEmailFrom(e.target.value)}
                        style={{
                          width: "100%",
                          backgroundColor: APP_SHELL.inputBg,
                          border: `1px solid ${APP_SHELL.inputBorder}`,
                          borderRadius: APP_SHELL.inputRadius,
                          padding: "10px 14px",
                          color: APP_SHELL.textPrimary,
                          fontSize: "13px",
                          outline: "none",
                          boxSizing: "border-box",
                        }}
                      />
                    </div>

                    {emailProvider === "smtp" && (
                      <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 120px", gap: "16px" }}>
                          <div>
                            <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: APP_SHELL.textSecondary, marginBottom: "6px" }}>
                              SMTP Host
                            </label>
                            <input
                              type="text"
                              required
                              placeholder="e.g. smtp.gmail.com"
                              value={smtpHost}
                              onChange={(e) => setSmtpHost(e.target.value)}
                              style={{
                                width: "100%",
                                backgroundColor: APP_SHELL.inputBg,
                                border: `1px solid ${APP_SHELL.inputBorder}`,
                                borderRadius: APP_SHELL.inputRadius,
                                padding: "10px 14px",
                                color: APP_SHELL.textPrimary,
                                fontSize: "13px",
                                outline: "none",
                                boxSizing: "border-box",
                              }}
                            />
                          </div>
                          <div>
                            <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: APP_SHELL.textSecondary, marginBottom: "6px" }}>
                              SMTP Port
                            </label>
                            <input
                              type="text"
                              required
                              placeholder="587"
                              value={smtpPort}
                              onChange={(e) => setSmtpPort(e.target.value)}
                              style={{
                                width: "100%",
                                backgroundColor: APP_SHELL.inputBg,
                                border: `1px solid ${APP_SHELL.inputBorder}`,
                                borderRadius: APP_SHELL.inputRadius,
                                padding: "10px 14px",
                                color: APP_SHELL.textPrimary,
                                fontSize: "13px",
                                outline: "none",
                                boxSizing: "border-box",
                              }}
                            />
                          </div>
                        </div>

                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: "13px", color: APP_SHELL.textPrimary }}>Use Secure Connection (SSL/TLS)</div>
                            <div style={{ fontSize: "11px", color: APP_SHELL.textSecondary, marginTop: "2px" }}>
                              Set true for port 465, false for 587 (STARTTLS).
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setSmtpSecure((prev) => !prev)}
                            style={{
                              width: "50px",
                              height: "26px",
                              borderRadius: "13px",
                              border: "none",
                              backgroundColor: smtpSecure ? APP_SHELL.accent : "rgba(255,255,255,0.1)",
                              cursor: "pointer",
                              position: "relative",
                              transition: "background-color 0.2s",
                              padding: 0,
                            }}
                          >
                            <div
                              style={{
                                width: "20px",
                                height: "20px",
                                borderRadius: "50%",
                                backgroundColor: "#fff",
                                position: "absolute",
                                top: "3px",
                                left: smtpSecure ? "27px" : "3px",
                                transition: "left 0.2s",
                              }}
                            />
                          </button>
                        </div>

                        <div>
                          <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: APP_SHELL.textSecondary, marginBottom: "6px" }}>
                            SMTP Username (Optional)
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. user@gmail.com"
                            value={smtpUser}
                            onChange={(e) => setSmtpUser(e.target.value)}
                            style={{
                              width: "100%",
                              backgroundColor: APP_SHELL.inputBg,
                              border: `1px solid ${APP_SHELL.inputBorder}`,
                              borderRadius: APP_SHELL.inputRadius,
                              padding: "10px 14px",
                              color: APP_SHELL.textPrimary,
                              fontSize: "13px",
                              outline: "none",
                              boxSizing: "border-box",
                            }}
                          />
                        </div>

                        <div>
                          <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: APP_SHELL.textSecondary, marginBottom: "6px" }}>
                            SMTP Password (Optional)
                          </label>
                          <input
                            type="password"
                            placeholder="Password"
                            value={smtpPass}
                            onChange={(e) => setSmtpPass(e.target.value)}
                            style={{
                              width: "100%",
                              backgroundColor: APP_SHELL.inputBg,
                              border: `1px solid ${APP_SHELL.inputBorder}`,
                              borderRadius: APP_SHELL.inputRadius,
                              padding: "10px 14px",
                              color: APP_SHELL.textPrimary,
                              fontSize: "13px",
                              outline: "none",
                              boxSizing: "border-box",
                            }}
                          />
                        </div>
                      </div>
                    )}

                    {emailProvider === "cloudflare_api" && (
                      <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                        <div style={{
                          padding: "12px 16px",
                          backgroundColor: "rgba(245, 158, 11, 0.1)",
                          border: "1px solid rgba(245, 158, 11, 0.3)",
                          borderRadius: "8px",
                          color: "#fbbf24",
                          fontSize: "12px",
                          lineHeight: "1.5",
                          display: "flex",
                          gap: "8px",
                          alignItems: "flex-start"
                        }}>
                          <span style={{ fontSize: "16px" }}>⚠️</span>
                          <div>
                            <strong>One-Way Outbound Only:</strong> Direct API sending does not deploy any code to Cloudflare. 
                            As a result, guest replies to invite emails will not trigger automatic worker-based auto-responses. 
                            Any replies will only follow standard email forwarding/routing rules configured in your Cloudflare dashboard.
                          </div>
                        </div>

                        <div>
                          <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: APP_SHELL.textSecondary, marginBottom: "6px" }}>
                            Cloudflare Account ID
                          </label>
                          <input
                            type="text"
                            required
                            placeholder="e.g. 1a2b3c4d5e6f..."
                            value={cfAccountId}
                            onChange={(e) => setCfAccountId(e.target.value)}
                            style={{
                              width: "100%",
                              backgroundColor: APP_SHELL.inputBg,
                              border: `1px solid ${APP_SHELL.inputBorder}`,
                              borderRadius: APP_SHELL.inputRadius,
                              padding: "10px 14px",
                              color: APP_SHELL.textPrimary,
                              fontSize: "13px",
                              outline: "none",
                              boxSizing: "border-box",
                            }}
                          />
                          <span style={{ display: "block", fontSize: "11px", color: APP_SHELL.textSecondary, marginTop: "4px", lineHeight: "1.4" }}>
                            Your unique 32-character Cloudflare Account ID. You can find this on your Cloudflare Dashboard homepage (sidebar on the right under <strong>Account ID</strong>).
                          </span>
                        </div>

                        <div>
                          <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: APP_SHELL.textSecondary, marginBottom: "6px" }}>
                            Cloudflare API Token
                          </label>
                          <div style={{ position: "relative" }}>
                            <input
                              type={showCfApiToken ? "text" : "password"}
                              required
                              placeholder="Cloudflare API Token"
                              value={cfApiToken}
                              onChange={(e) => setCfApiToken(e.target.value)}
                              style={{
                                width: "100%",
                                backgroundColor: APP_SHELL.inputBg,
                                border: `1px solid ${APP_SHELL.inputBorder}`,
                                borderRadius: APP_SHELL.inputRadius,
                                padding: "10px 40px 10px 14px",
                                color: APP_SHELL.textPrimary,
                                fontSize: "13px",
                                outline: "none",
                                boxSizing: "border-box",
                              }}
                            />
                            <button
                              type="button"
                              onClick={() => setShowCfApiToken(!showCfApiToken)}
                              style={{
                                position: "absolute",
                                right: "10px",
                                top: "50%",
                                transform: "translateY(-50%)",
                                background: "none",
                                border: "none",
                                cursor: "pointer",
                                color: APP_SHELL.textSecondary,
                                padding: "4px",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                              }}
                              title={showCfApiToken ? "Hide token" : "Show token"}
                            >
                              {showCfApiToken ? (
                                <EyeOff size={16} />
                              ) : (
                                <Eye size={16} />
                              )}
                            </button>
                          </div>
                          <span style={{ display: "block", fontSize: "11px", color: APP_SHELL.textSecondary, marginTop: "4px", lineHeight: "1.4" }}>
                            An API Token with <strong>Account &gt; Email Sending: Edit</strong> permissions.
                          </span>
                        </div>

                        <div style={{ marginTop: "12px", padding: "16px", backgroundColor: "rgba(255,255,255,0.03)", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.1)" }}>
                          <h4 style={{ fontSize: "14px", fontWeight: 700, color: APP_SHELL.textPrimary, margin: "0 0 10px 0" }}>
                            ⚡ Quick Dashboard Setup (No CLI Required)
                          </h4>
                          <ol style={{ fontSize: "12px", color: APP_SHELL.textSecondary, paddingLeft: "16px", margin: "0", lineHeight: "1.6" }}>
                            <li style={{ marginBottom: "6px" }}>Log in to <a href="https://dash.cloudflare.com" target="_blank" rel="noopener noreferrer" style={{ color: APP_SHELL.accent, textDecoration: "underline" }}>dash.cloudflare.com</a>.</li>
                            <li style={{ marginBottom: "6px" }}>In the left sidebar, click on your domain (under <strong>Websites</strong>), then navigate to <strong>Email &gt; Email Routing &gt; Destination addresses</strong> to verify your email routing is configured.</li>
                            <li style={{ marginBottom: "6px" }}>Navigate to the <strong>Email Sending</strong> tab on the same page, click <strong>Configure</strong> or <strong>Get Started</strong>, and authorize the generated DNS records (DKIM/SPF) to allow sending. <strong>(CRITICAL: If you skip this, major providers like Gmail will reject your emails due to DMARC policies!)</strong></li>
                            <li style={{ marginBottom: "6px" }}>Go to <strong>My Profile &gt; API Tokens</strong> (top right user icon &gt; My Profile &gt; API Tokens).</li>
                            <li style={{ marginBottom: "6px" }}>Click <strong>Create Token</strong>. Scroll to the bottom and click <strong>Create Custom Token</strong>.</li>
                            <li style={{ marginBottom: "6px" }}>Give your token a name (e.g., <code>RSVP to Me API Token</code>).</li>
                            <li style={{ marginBottom: "6px" }}>
                              Under <strong>Permissions</strong>, select:
                              <ul style={{ paddingLeft: "16px", marginTop: "4px" }}>
                                <li style={{ marginBottom: "4px" }}><strong>Account</strong> | <strong>Email Sending</strong> | <strong>Edit</strong></li>
                              </ul>
                            </li>
                            <li style={{ marginBottom: "6px" }}>Under <strong>Account Resources</strong>, choose <strong>Include</strong> and select your account. Under <strong>Zone Resources</strong>, choose <strong>Include</strong> &gt; <strong>Specific zone</strong> &gt; select your domain.</li>
                            <li style={{ marginBottom: "6px" }}>Click <strong>Continue to summary</strong>, then click <strong>Create Token</strong>. Copy the token and paste it above!</li>
                          </ol>
                        </div>
                      </div>
                    )}

                    {emailProvider === "cloudflare" && (
                      <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                        <div>
                          <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: APP_SHELL.textSecondary, marginBottom: "6px" }}>
                            Cloudflare Worker URL
                          </label>
                          <input
                            type="url"
                            required
                            placeholder={`https://rsvp-email-worker.${suggestedSubdomain}.workers.dev`}
                            value={cfWorkerUrl}
                            onChange={(e) => setCfWorkerUrl(e.target.value)}
                            style={{
                              width: "100%",
                              backgroundColor: APP_SHELL.inputBg,
                              border: `1px solid ${APP_SHELL.inputBorder}`,
                              borderRadius: APP_SHELL.inputRadius,
                              padding: "10px 14px",
                              color: APP_SHELL.textPrimary,
                              fontSize: "13px",
                              outline: "none",
                              boxSizing: "border-box",
                            }}
                          />
                          <span style={{ display: "block", fontSize: "11px", color: APP_SHELL.textSecondary, marginTop: "4px", lineHeight: "1.4" }}>
                            The public HTTP endpoint of your worker. Usually formatted as <code>https://rsvp-email-worker.{suggestedSubdomain}.workers.dev</code>. You can find this in your Cloudflare Dashboard under your worker&apos;s <strong>Triggers</strong> or <strong>Routes</strong> tab.
                          </span>
                        </div>

                        <div>
                          <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: APP_SHELL.textSecondary, marginBottom: "6px" }}>
                            Worker API Secret
                          </label>
                          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                            <div style={{ position: "relative", flex: 1 }}>
                              <input
                                type={showSecret ? "text" : "password"}
                                required
                                placeholder="API Secret Token"
                                value={cfWorkerSecret}
                                onChange={(e) => setCfWorkerSecret(e.target.value)}
                                style={{
                                  width: "100%",
                                  backgroundColor: APP_SHELL.inputBg,
                                  border: `1px solid ${APP_SHELL.inputBorder}`,
                                  borderRadius: APP_SHELL.inputRadius,
                                  padding: "10px 40px 10px 14px",
                                  color: APP_SHELL.textPrimary,
                                  fontSize: "13px",
                                  outline: "none",
                                  boxSizing: "border-box",
                                }}
                              />
                              <button
                                type="button"
                                onClick={() => setShowSecret(!showSecret)}
                                style={{
                                  position: "absolute",
                                  right: "10px",
                                  top: "50%",
                                  transform: "translateY(-50%)",
                                  background: "none",
                                  border: "none",
                                  cursor: "pointer",
                                  color: APP_SHELL.textSecondary,
                                  padding: "4px",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                }}
                                title={showSecret ? "Hide secret" : "Show secret"}
                              >
                                {showSecret ? (
                                  <EyeOff size={16} />
                                ) : (
                                  <Eye size={16} />
                                )}
                              </button>
                            </div>
                            
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(cfWorkerSecret);
                                setSecretCopied(true);
                                setTimeout(() => setSecretCopied(false), 2000);
                              }}
                              disabled={!cfWorkerSecret}
                              style={{
                                backgroundColor: secretCopied ? "#22c55e" : "rgba(255, 255, 255, 0.08)",
                                border: `1px solid ${secretCopied ? "#22c55e" : APP_SHELL.inputBorder}`,
                                borderRadius: APP_SHELL.inputRadius,
                                color: "#fff",
                                padding: "0 14px",
                                height: "38px",
                                fontSize: "12px",
                                fontWeight: 600,
                                cursor: cfWorkerSecret ? "pointer" : "not-allowed",
                                opacity: cfWorkerSecret ? 1 : 0.5,
                                transition: "background-color 0.2s, border-color 0.2s",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: "4px",
                              }}
                              onMouseEnter={(e) => {
                                if (cfWorkerSecret && !secretCopied) e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.15)";
                              }}
                              onMouseLeave={(e) => {
                                if (cfWorkerSecret && !secretCopied) e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.08)";
                              }}
                              title="Copy secret to clipboard"
                            >
                              {secretCopied ? "✓" : "📋"}
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                const hasSavedSecret = !!config.cloudflare_worker_api_secret;
                                if (hasSavedSecret) {
                                  const confirmOverwrite = window.confirm(
                                    "Warning: A worker API secret is already saved in the database. Generating a new one will overwrite it. You must also update the WORKER_API_SECRET in your Cloudflare dashboard to match. Are you sure you want to continue?"
                                  );
                                  if (!confirmOverwrite) return;
                                }
                                const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
                                const array = new Uint8Array(32);
                                window.crypto.getRandomValues(array);
                                let secret = "";
                                for (let i = 0; i < array.length; i++) {
                                  secret += chars[array[i] % chars.length];
                                }
                                setCfWorkerSecret(secret);
                              }}
                              style={{
                                backgroundColor: "rgba(255, 255, 255, 0.08)",
                                border: `1px solid ${APP_SHELL.inputBorder}`,
                                borderRadius: APP_SHELL.inputRadius,
                                color: APP_SHELL.textPrimary,
                                padding: "0 14px",
                                height: "38px",
                                fontSize: "12px",
                                fontWeight: 600,
                                cursor: "pointer",
                                transition: "background-color 0.2s",
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.15)"}
                              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.08)"}
                            >
                              ⚡ Generate
                            </button>
                          </div>
                          <span style={{ display: "block", fontSize: "11px", color: APP_SHELL.textSecondary, marginTop: "4px", lineHeight: "1.4" }}>
                            A secure token used to authenticate Next.js requests to your worker. Click <strong>Generate</strong> to create one, then copy it.
                          </span>
                        </div>

                        <div>
                          <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: APP_SHELL.textSecondary, marginBottom: "6px" }}>
                            Guest Reply Forwarding Email
                          </label>
                          <input
                            type="email"
                            required
                            placeholder="e.g. host@domain.com"
                            value={cfInboundForwardTo}
                            onChange={(e) => setCfInboundForwardTo(e.target.value)}
                            style={{
                              width: "100%",
                              backgroundColor: APP_SHELL.inputBg,
                              border: `1px solid ${APP_SHELL.inputBorder}`,
                              borderRadius: APP_SHELL.inputRadius,
                              padding: "10px 14px",
                              color: APP_SHELL.textPrimary,
                              fontSize: "13px",
                              outline: "none",
                              boxSizing: "border-box",
                            }}
                          />
                          <span style={{ display: "block", fontSize: "11px", color: APP_SHELL.textSecondary, marginTop: "4px", lineHeight: "1.4" }}>
                            When guests reply to invite emails, where should their replies go? Because this app uses Cloudflare to send emails, you must enter this same address in your Cloudflare settings so Cloudflare knows where to send replies. Setting it here is just for your reference.
                          </span>
                        </div>

                        <div style={{ marginTop: "12px", padding: "16px", backgroundColor: "rgba(255,255,255,0.03)", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.1)" }}>
                          <h4 style={{ fontSize: "14px", fontWeight: 700, color: APP_SHELL.textPrimary, margin: "0 0 10px 0" }}>
                            ⚡ Quick Browser Setup (No CLI Required)
                          </h4>
                          <ol style={{ fontSize: "12px", color: APP_SHELL.textSecondary, paddingLeft: "16px", margin: "0 0 16px 0", lineHeight: "1.6" }}>
                            <li style={{ marginBottom: "6px" }}>Log in to <a href="https://dash.cloudflare.com" target="_blank" rel="noopener noreferrer" style={{ color: APP_SHELL.accent, textDecoration: "underline" }}>dash.cloudflare.com</a> (sign up for a free account if you haven&apos;t already).</li>
                            <li style={{ marginBottom: "6px" }}>Go to <strong>Websites &gt; [Your Domain] &gt; Email &gt; Email Routing &gt; Email Workers</strong>.</li>
                            <li style={{ marginBottom: "6px" }}>Click <strong>Create Email Worker</strong>, name it <code>rsvp-email-worker</code>, and select <strong>Create my own</strong> (which opens the online code editor).</li>
                            <li style={{ marginBottom: "8px" }}>Click the button below to copy or view the worker code:</li>
                          </ol>
                          
                          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "12px" }}>
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(generateWorkerCode());
                                setCopied(true);
                                setTimeout(() => setCopied(false), 2000);
                              }}
                              style={{
                                backgroundColor: copied ? "#22c55e" : APP_SHELL.accent,
                                border: "none",
                                color: "#fff",
                                borderRadius: "6px",
                                padding: "8px 16px",
                                fontSize: "12px",
                                fontWeight: 700,
                                cursor: "pointer",
                                transition: "background-color 0.2s",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "6px",
                              }}
                            >
                              {copied ? "✓ Copied!" : "📋 Copy Worker Code"}
                            </button>
                            
                            <button
                              type="button"
                              onClick={() => setShowCode(!showCode)}
                              style={{
                                backgroundColor: "rgba(255, 255, 255, 0.08)",
                                border: `1px solid ${APP_SHELL.inputBorder}`,
                                borderRadius: "6px",
                                color: APP_SHELL.textPrimary,
                                padding: "8px 16px",
                                fontSize: "12px",
                                fontWeight: 700,
                                cursor: "pointer",
                                transition: "background-color 0.2s",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "6px",
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.15)"}
                              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.08)"}
                            >
                              <span>&lt;/&gt;</span> {showCode ? "Hide Worker Code" : "View Worker Code"}
                            </button>
                          </div>

                          {showCode && (
                            <div style={{ marginBottom: "12px" }}>
                              <pre style={{
                                margin: 0,
                                padding: "12px",
                                backgroundColor: "rgba(0,0,0,0.3)",
                                border: "1px solid rgba(255,255,255,0.1)",
                                borderRadius: "6px",
                                fontSize: "11px",
                                color: "#e2e8f0",
                                overflowX: "auto",
                                whiteSpace: "pre-wrap",
                                wordBreak: "break-all",
                                fontFamily: "monospace",
                                maxHeight: "250px",
                                overflowY: "auto",
                              }}>
                                {generateWorkerCode()}
                              </pre>
                            </div>
                          )}
                          
                          <ol start={4} style={{ fontSize: "12px", color: APP_SHELL.textSecondary, paddingLeft: "16px", margin: "0", lineHeight: "1.6" }}>
                            <li style={{ marginBottom: "6px" }}>Delete everything in the Cloudflare editor, paste the copied code, and click <strong>Save and Deploy</strong>.</li>
                            <li style={{ marginBottom: "6px" }}>
                              Go to the Cloudflare main dashboard and click on <strong>Workers & Pages</strong> (left-hand sidebar) &gt; click your worker (<code>rsvp-email-worker</code>) &gt; select the <strong>Settings</strong> tab &gt; select <strong>Variables</strong> in the settings menu.
                            </li>
                            <li style={{ marginBottom: "6px" }}>
                              Under the <strong>Environment Variables</strong> table:
                              <ul style={{ paddingLeft: "16px", marginTop: "4px" }}>
                                <li style={{ marginBottom: "4px" }}>Click the <strong>Edit variables</strong> button first (required before you can add or change variables).</li>
                                <li style={{ marginBottom: "4px" }}>Click <strong>Add variable</strong>: set Name to <code>WORKER_API_SECRET</code>, select Type as <strong>Secret</strong> (using the dropdown or padlock icon), and paste your <strong>Worker API Secret</strong> from above.</li>
                                <li style={{ marginBottom: "4px" }}>Click <strong>Add variable</strong> again: set Name to <code>INBOUND_FORWARD_TO</code>, leave Type as <strong>Text</strong>, and paste your <strong>Guest Reply Forwarding Email</strong> (e.g. <code>{cfInboundForwardTo || "your-email@domain.com"}</code>).</li>
                              </ul>
                            </li>
                            <li style={{ marginBottom: "6px" }}>
                              Scroll down to the <strong>Bindings</strong> section on the same page:
                              <ul style={{ paddingLeft: "16px", marginTop: "4px" }}>
                                <li style={{ marginBottom: "4px" }}>Click <strong>Add binding</strong>.</li>
                                <li style={{ marginBottom: "4px" }}>Select <strong>Email Service</strong> from the Type dropdown.</li>
                                <li style={{ marginBottom: "4px" }}>Set the Name to <code>EMAIL</code> (must be all capital letters).</li>
                                <li style={{ marginBottom: "4px" }}><em>Note: Do not enter anything for Value. Once saved, it will display as a dash (<code>—</code>), which is correct and expected.</em></li>
                              </ul>
                            </li>
                            <li style={{ marginBottom: "6px" }}>
                              Click the <strong>Save and deploy</strong> button at the bottom of the page to apply all variables and bindings.
                            </li>
                            <li style={{ marginBottom: "6px" }}>
                              Go to your domain dashboard under <strong>Websites &gt; [Your Domain] &gt; Email &gt; Email Routing &gt; Routes</strong>, and click <strong>Add Route</strong>:
                              <ul style={{ paddingLeft: "16px", marginTop: "4px" }}>
                                <li style={{ marginBottom: "4px" }}><strong>Custom address</strong>: Enter your preferred custom sender address (e.g., <code>{emailFrom.match(/<([^>]+)>/)?.[1] || emailFrom || "rsvps@yourdomain.com"}</code>).</li>
                                <li style={{ marginBottom: "4px" }}><strong>Action</strong>: Select <strong>Send to Worker</strong>.</li>
                                <li style={{ marginBottom: "4px" }}><strong>Destination worker</strong>: Select <code>rsvp-email-worker</code>.</li>
                                <li style={{ marginBottom: "4px" }}>Click <strong>Save</strong>.</li>
                              </ul>
                            </li>
                          </ol>
                        </div>

                      </div>
                    )}

                    <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", marginTop: "10px" }}>
                      <button
                        type="button"
                        disabled={isPending || isTestingEmail}
                        onClick={handleTestEmailConfig}
                        style={{
                          backgroundColor: "rgba(255, 255, 255, 0.08)",
                          border: `1px solid ${APP_SHELL.inputBorder}`,
                          color: APP_SHELL.textPrimary,
                          borderRadius: "10px",
                          padding: "10px 20px",
                          fontSize: "13px",
                          fontWeight: 700,
                          cursor: (isPending || isTestingEmail) ? "not-allowed" : "pointer",
                          transition: "background-color 0.2s",
                          opacity: (isPending || isTestingEmail) ? 0.6 : 1,
                        }}
                      >
                        {isTestingEmail ? "Testing..." : "Test Connection"}
                      </button>

                      <button
                        type="submit"
                        disabled={isPending || isTestingEmail}
                        style={{
                          backgroundColor: APP_SHELL.accent,
                          border: "none",
                          color: "#fff",
                          borderRadius: "10px",
                          padding: "10px 20px",
                          fontSize: "13px",
                          fontWeight: 700,
                          cursor: (isPending || isTestingEmail) ? "not-allowed" : "pointer",
                          opacity: (isPending || isTestingEmail) ? 0.6 : 1,
                        }}
                      >
                        Save Settings
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* PANEL: BACKUPS */}
            {activeTab === "backups" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
                {/* Section 1: Backup settings */}
                <div
                  style={{
                    backgroundColor: APP_SHELL.cardBg,
                    border: `1px solid ${APP_SHELL.cardBorder}`,
                    borderRadius: APP_SHELL.cardRadius,
                    padding: "24px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "20px",
                  }}
                >
                  <div>
                    <h3 style={{ fontSize: "18px", fontWeight: 700, color: APP_SHELL.textPrimary, margin: 0 }}>
                      Backup Configuration
                    </h3>
                    <p style={{ color: APP_SHELL.textSecondary, fontSize: "13px", marginTop: "4px" }}>
                      Configure scheduled database backups. Backups are stored in the persistent application volume.
                    </p>
                  </div>

                  <div style={{ height: "1px", backgroundColor: APP_SHELL.navBorder }} />

                  <form onSubmit={handleSaveBackupConfig} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                        <label style={{ fontSize: "12px", fontWeight: 700, color: APP_SHELL.textSecondary }}>
                          BACKUP CRON SCHEDULE
                        </label>
                        <input
                          type="text"
                          value={backupSchedule}
                          onChange={(e) => setBackupSchedule(e.target.value)}
                          placeholder="e.g. 0 0 * * * (or 'disabled')"
                          required
                          style={{
                            backgroundColor: APP_SHELL.inputBg,
                            border: `1px solid ${APP_SHELL.inputBorder}`,
                            borderRadius: "10px",
                            padding: "10px 14px",
                            fontSize: "14px",
                            color: APP_SHELL.textPrimary,
                            outline: "none",
                          }}
                        />
                        <span style={{ fontSize: "11px", color: APP_SHELL.textMuted }}>
                          Standard 5-field cron syntax (Minute Hour Day-of-Month Month Day-of-Week). Set to <strong>disabled</strong> to turn off automated backups.
                        </span>
                      </div>

                      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                        <label style={{ fontSize: "12px", fontWeight: 700, color: APP_SHELL.textSecondary }}>
                          BACKUPS TO RETAIN (ROTATION LIMIT)
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="100"
                          value={backupKeepCount}
                          onChange={(e) => setBackupKeepCount(parseInt(e.target.value, 10) || 7)}
                          required
                          style={{
                            backgroundColor: APP_SHELL.inputBg,
                            border: `1px solid ${APP_SHELL.inputBorder}`,
                            borderRadius: "10px",
                            padding: "10px 14px",
                            fontSize: "14px",
                            color: APP_SHELL.textPrimary,
                            outline: "none",
                          }}
                        />
                        <span style={{ fontSize: "11px", color: APP_SHELL.textMuted }}>
                          Maximum number of backup files to keep. Older backups will be automatically deleted on new backup runs.
                        </span>
                      </div>
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "10px" }}>
                      <div style={{ fontSize: "12px", color: APP_SHELL.textSecondary }}>
                        <strong>Last Backup Completed:</strong>{" "}
                        {lastBackupTime ? new Date(lastBackupTime).toLocaleString() : "Never"}
                      </div>

                      <button
                        type="submit"
                        disabled={isSavingBackupConfig}
                        style={{
                          backgroundColor: APP_SHELL.accent,
                          border: "none",
                          color: "#fff",
                          borderRadius: "10px",
                          padding: "10px 20px",
                          fontSize: "13px",
                          fontWeight: 700,
                          cursor: isSavingBackupConfig ? "not-allowed" : "pointer",
                          opacity: isSavingBackupConfig ? 0.6 : 1,
                        }}
                      >
                        {isSavingBackupConfig ? "Saving..." : "Save Backup Settings"}
                      </button>
                    </div>
                  </form>
                </div>

                {/* Section 2: Manual Trigger */}
                <div
                  style={{
                    backgroundColor: APP_SHELL.cardBg,
                    border: `1px solid ${APP_SHELL.cardBorder}`,
                    borderRadius: APP_SHELL.cardRadius,
                    padding: "24px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div style={{ maxWidth: "70%" }}>
                    <h3 style={{ fontSize: "16px", fontWeight: 700, color: APP_SHELL.textPrimary, margin: 0 }}>
                      Manual Database Backup
                    </h3>
                    <p style={{ color: APP_SHELL.textSecondary, fontSize: "13px", marginTop: "4px", margin: 0 }}>
                      Instantly trigger a database snapshot. SQLite creates a file copy, while PostgreSQL executes a <code>pg_dump</code> database extract.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleCreateBackup}
                    disabled={isBackupRunning}
                    style={{
                      backgroundColor: "rgba(255, 255, 255, 0.08)",
                      border: `1px solid ${APP_SHELL.inputBorder}`,
                      color: APP_SHELL.textPrimary,
                      borderRadius: "10px",
                      padding: "12px 24px",
                      fontSize: "14px",
                      fontWeight: 700,
                      cursor: isBackupRunning ? "not-allowed" : "pointer",
                      opacity: isBackupRunning ? 0.6 : 1,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {isBackupRunning ? "Backing up..." : "Create Backup Now"}
                  </button>
                </div>

                {/* Section 3: Backup List */}
                <div
                  style={{
                    backgroundColor: APP_SHELL.cardBg,
                    border: `1px solid ${APP_SHELL.cardBorder}`,
                    borderRadius: APP_SHELL.cardRadius,
                    padding: "24px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "20px",
                  }}
                >
                  <div>
                    <h3 style={{ fontSize: "18px", fontWeight: 700, color: APP_SHELL.textPrimary, margin: 0 }}>
                      Backup Archives
                    </h3>
                    <p style={{ color: APP_SHELL.textSecondary, fontSize: "13px", marginTop: "4px" }}>
                      List of stored backups on this server.
                    </p>
                  </div>

                  <div style={{ height: "1px", backgroundColor: APP_SHELL.navBorder }} />

                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                      <thead>
                        <tr style={{ borderBottom: `1px solid ${APP_SHELL.navBorder}`, color: APP_SHELL.textSecondary, fontSize: "12px", fontWeight: 700 }}>
                          <th style={{ padding: "12px" }}>FILENAME</th>
                          <th style={{ padding: "12px" }}>CREATED AT</th>
                          <th style={{ padding: "12px" }}>FILE SIZE</th>
                          <th style={{ padding: "12px", textAlign: "right" }}>ACTIONS</th>
                        </tr>
                      </thead>
                      <tbody>
                        {backups.length === 0 ? (
                          <tr>
                            <td colSpan={4} style={{ padding: "32px", textAlign: "center", color: APP_SHELL.textMuted }}>
                              No backup archives found. Create one manually or configure a schedule.
                            </td>
                          </tr>
                        ) : (
                          backups.map((b) => (
                            <tr key={b.filename} style={{ borderBottom: `1px solid ${APP_SHELL.navBorder}`, fontSize: "14px" }}>
                              <td style={{ padding: "14px 12px", fontFamily: "monospace", color: APP_SHELL.textPrimary }}>
                                {b.filename}
                              </td>
                              <td style={{ padding: "14px 12px", color: APP_SHELL.textSecondary }}>
                                {new Date(b.createdAt).toLocaleString()}
                              </td>
                              <td style={{ padding: "14px 12px", color: APP_SHELL.textSecondary }}>
                                {b.sizeBytes >= 1024 * 1024
                                  ? `${(b.sizeBytes / (1024 * 1024)).toFixed(2)} MB`
                                  : `${(b.sizeBytes / 1024).toFixed(2)} KB`}
                              </td>
                              <td style={{ padding: "14px 12px", textAlign: "right" }}>
                                <div style={{ display: "inline-flex", gap: "16px" }}>
                                  <a
                                    href={`/api/admin/backups/${b.filename}`}
                                    download
                                    style={{
                                      color: APP_SHELL.accent,
                                      textDecoration: "none",
                                      fontWeight: 600,
                                      fontSize: "13px",
                                    }}
                                  >
                                    Download
                                  </a>
                                  <button
                                    onClick={() => handleDeleteBackup(b.filename)}
                                    style={{
                                      backgroundColor: "transparent",
                                      border: "none",
                                      color: "#ef4444",
                                      cursor: "pointer",
                                      fontWeight: 600,
                                      fontSize: "13px",
                                      padding: 0,
                                    }}
                                  >
                                    Delete
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
