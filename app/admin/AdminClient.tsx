"use client";

import { useState, useTransition } from "react";
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
  sessionUser,
}: AdminClientProps) {
  const [activeTab, setActiveTab] = useState<"overview" | "users" | "events" | "invites" | "settings">("overview");

  const [users, setUsers] = useState(initialUsers);
  const [events, setEvents] = useState(initialEvents);
  const [inviteCodes, setInviteCodes] = useState(initialInviteCodes);
  const [config, setConfig] = useState(initialConfig);

  const [userSearch, setUserSearch] = useState("");
  const [eventSearch, setEventSearch] = useState("");

  const [newCode, setNewCode] = useState("");
  const [maxUses, setMaxUses] = useState<number | "">("");
  const [expiresAt, setExpiresAt] = useState("");
  const [note, setNote] = useState("");

  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

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
            style={{
              padding: "16px",
              borderRadius: APP_SHELL.inputRadius,
              backgroundColor: feedback.type === "success" ? "rgba(34, 197, 94, 0.1)" : "rgba(239, 68, 68, 0.1)",
              border: `1px solid ${feedback.type === "success" ? "rgba(34, 197, 94, 0.3)" : "rgba(239, 68, 68, 0.3)"}`,
              color: feedback.type === "success" ? "#4ade80" : "#f87171",
              fontSize: "14px",
              fontWeight: 600,
              marginBottom: "24px",
            }}
          >
            {feedback.message}
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
                                  }}
                                >
                                  <option value="GUEST">GUEST</option>
                                  <option value="HOST">HOST</option>
                                  <option value="ADMIN">ADMIN</option>
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
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
