"use client";

import { useState, useTransition } from "react";
import type { ResolvedTheme } from "@/lib/theme";
import { deleteRsvpAsHost, approveRsvp, declineRsvp } from "@/app/actions/event";
import Image from "next/image";

type RSVPAnswer = { label: string; value: string };

type RSVP = {
  id: string;
  guestName: string;
  guestEmail: string | null;
  guestPhone: string | null;
  status: "GOING" | "MAYBE" | "NO" | "INVITED";
  plusOneCount: number;
  note: string | null;
  createdAt: string;
  answers: RSVPAnswer[];
  plusOneGuests: string[];
  editToken: string;
  user?: { avatarUrl: string | null } | null;
};

type InvitedGuest = {
  id: string;
  sentTo: string;
  channel: "EMAIL" | "SMS";
  sentAt: string;
  guestName?: string;
  editToken?: string;
};

type Filter = "ALL" | "GOING" | "MAYBE" | "NO" | "INVITED" | "PENDING";

export function GuestListFilter({
  going: initialGoing,
  maybe: initialMaybe,
  no: initialNo,
  pending: initialPending = [],
  invited: initialInvited,
  isHost,
  slug,
  t,
}: {
  going: RSVP[];
  maybe: RSVP[];
  no: RSVP[];
  pending?: RSVP[];
  invited: InvitedGuest[];
  isHost: boolean;
  slug: string;
  t: ResolvedTheme;
}) {
  const [filter, setFilter] = useState<Filter>("ALL");
  const [going, setGoing] = useState(initialGoing);
  const [maybe, setMaybe] = useState(initialMaybe);
  const [no, setNo] = useState(initialNo);
  const [pending, setPending] = useState(initialPending);
  const [invited, setInvited] = useState(initialInvited);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const statusLabel = (s: string) =>
    s === "GOING"
      ? "Going"
      : s === "MAYBE"
        ? "Maybe"
        : s === "INVITED"
          ? "Invited"
          : "Can't make it";
  const statusColor = (s: string) =>
    s === "GOING" ? t.badgeText : s === "MAYBE" ? t.textSecondary : t.textMuted;

  const allRsvps = [...going, ...maybe, ...no];
  const displayedRsvps =
    filter === "ALL"
      ? allRsvps
      : filter === "GOING"
        ? going
        : filter === "MAYBE"
          ? maybe
          : filter === "NO"
            ? no
            : filter === "PENDING"
              ? pending
              : [];

  const chips: { key: Filter; label: string; count: number }[] = [
    { key: "ALL", label: "All", count: allRsvps.length + (isHost ? invited.length : 0) },
    ...(isHost
      ? [{ key: "PENDING" as Filter, label: "Pending Approval", count: pending.length }]
      : []),
    { key: "GOING", label: "Going", count: going.length },
    { key: "MAYBE", label: "Maybe", count: maybe.length },
    { key: "NO", label: "Can't make it", count: no.length },
    ...(isHost ? [{ key: "INVITED" as Filter, label: "Invited", count: invited.length }] : []),
  ];

  const chipStyle = (active: boolean): React.CSSProperties => ({
    padding: "7px 16px",
    borderRadius: "99px",
    fontSize: "13px",
    fontWeight: 600,
    cursor: "pointer",
    border: active ? "none" : `1px solid ${t.cardBorder}`,
    background: active ? t.accent : t.cardBg,
    color: active ? t.accentFg : t.textSecondary,
    whiteSpace: "nowrap",
    fontFamily: "inherit",
    flexShrink: 0,
  });

  const cardStyle: React.CSSProperties = {
    background: t.cardBg,
    border: `1px solid ${t.cardBorder}`,
    borderRadius: "14px",
    padding: "14px 18px",
    marginBottom: "8px",
    display: "flex",
    alignItems: "flex-start",
    gap: "14px",
  };

  const handleDelete = (rsvpId: string) => {
    if (!confirm("Remove this RSVP? This cannot be undone.")) return;
    setDeletingId(rsvpId);
    startTransition(async () => {
      const result = await deleteRsvpAsHost(rsvpId);
      if (result.success) {
        const remove = (list: RSVP[]) => list.filter((r) => r.id !== rsvpId);
        setGoing(remove);
        setMaybe(remove);
        setNo(remove);
        setPending((prev) => prev.filter((r) => r.id !== rsvpId));
      }
      setDeletingId(null);
    });
  };

  const handleApprove = (rsvpId: string) => {
    startTransition(async () => {
      const res = await approveRsvp(rsvpId);
      if (res.success) {
        const approvedItem = pending.find((r) => r.id === rsvpId);
        if (approvedItem) {
          setPending((prev) => prev.filter((r) => r.id !== rsvpId));
          if (approvedItem.status === "GOING") {
            setGoing((prev) => [...prev, approvedItem]);
          } else if (approvedItem.status === "MAYBE") {
            setMaybe((prev) => [...prev, approvedItem]);
          } else if (approvedItem.status === "NO") {
            setNo((prev) => [...prev, approvedItem]);
          }
          // INVITED: remove from pending only; page revalidates to show in Invited tab
        }
      }
    });
  };

  const handleDeleteInvited = (id: string) => {
    if (!confirm("Remove this guest? This cannot be undone.")) return;
    startTransition(async () => {
      const result = await deleteRsvpAsHost(id);
      if (result.success) {
        setInvited((prev) => prev.filter((inv) => inv.id !== id));
      }
    });
  };

  const handleDecline = (rsvpId: string) => {
    if (!confirm("Decline and remove this RSVP request?")) return;
    startTransition(async () => {
      const res = await declineRsvp(rsvpId);
      if (res.success) {
        setPending((prev) => prev.filter((r) => r.id !== rsvpId));
      }
    });
  };

  return (
    <>
      <div
        style={{
          display: "flex",
          gap: "8px",
          overflowX: "auto",
          paddingBottom: "4px",
          marginBottom: "20px",
        }}
      >
        {chips.map(({ key, label, count }) => (
          <button key={key} onClick={() => setFilter(key)} style={chipStyle(filter === key)}>
            {label}
            {count > 0 && <span style={{ marginLeft: "5px", opacity: 0.75 }}>{count}</span>}
          </button>
        ))}
      </div>

      {displayedRsvps.length === 0 && filter !== "INVITED" ? (
        <div style={{ textAlign: "center", padding: "60px 20px", color: t.textMuted }}>
          No one here yet.
        </div>
      ) : (
        <>
          {displayedRsvps.map((r) => (
            <div key={r.id} style={{ ...cardStyle, opacity: deletingId === r.id ? 0.5 : 1 }}>
              <div
                style={{
                  width: "38px",
                  height: "38px",
                  borderRadius: "50%",
                  background: t.avatarGradient,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 800,
                  fontSize: "15px",
                  flexShrink: 0,
                  color: t.accentFg,
                  opacity: r.status === "NO" ? 0.4 : r.status === "MAYBE" ? 0.7 : 1,
                  overflow: "hidden",
                  position: "relative",
                }}
              >
                {r.user?.avatarUrl ? (
                  <Image
                    src={r.user.avatarUrl}
                    alt={r.guestName}
                    unoptimized
                    fill
                    style={{
                      objectFit: "cover",
                    }}
                  />
                ) : (
                  r.guestName[0].toUpperCase()
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}
                >
                  <span style={{ fontWeight: 700, fontSize: "15px" }}>{r.guestName}</span>
                  {r.plusOneCount > 0 && (
                    <span style={{ fontSize: "12px", color: t.textMuted }}>+{r.plusOneCount}</span>
                  )}
                  <span
                    style={{
                      fontSize: "11px",
                      fontWeight: 700,
                      padding: "2px 8px",
                      borderRadius: "99px",
                      background: t.pillBg,
                      color: statusColor(r.status),
                    }}
                  >
                    {statusLabel(r.status)}
                  </span>
                </div>
                {r.note && (
                  <p
                    style={{
                      color: t.textMuted,
                      fontSize: "13px",
                      margin: "4px 0 0",
                      lineHeight: 1.5,
                    }}
                  >
                    {r.note}
                  </p>
                )}
                {isHost && (r.guestEmail || r.guestPhone) && (
                  <div style={{ marginTop: "4px", display: "flex", gap: "12px", flexWrap: "wrap" }}>
                    {r.guestEmail && (
                      <span style={{ color: t.textMuted, fontSize: "12px" }}>{r.guestEmail}</span>
                    )}
                    {r.guestPhone && (
                      <span style={{ color: t.textMuted, fontSize: "12px" }}>{r.guestPhone}</span>
                    )}
                  </div>
                )}
                {isHost && r.plusOneGuests.length > 0 && (
                  <div style={{ marginTop: "6px", display: "flex", flexWrap: "wrap", gap: "4px" }}>
                    {r.plusOneGuests.map((name) => (
                      <span
                        key={name}
                        style={{
                          fontSize: "11px",
                          background: t.pillBg,
                          border: `1px solid ${t.cardBorder}`,
                          borderRadius: "99px",
                          padding: "2px 8px",
                          color: t.textSecondary,
                        }}
                      >
                        {name}
                      </span>
                    ))}
                  </div>
                )}
                {isHost && r.answers.length > 0 && (
                  <div
                    style={{
                      marginTop: "8px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "4px",
                    }}
                  >
                    {r.answers.map((a) => (
                      <div key={a.label} style={{ fontSize: "12px" }}>
                        <span style={{ color: t.textMuted }}>{a.label}: </span>
                        <span style={{ color: t.textSecondary }}>{a.value}</span>
                      </div>
                    ))}
                  </div>
                )}
                <div style={{ color: t.textMuted, fontSize: "11px", marginTop: "4px" }}>
                  {new Date(r.createdAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </div>
              </div>

              {isHost && filter === "PENDING" ? (
                <div
                  style={{ display: "flex", flexDirection: "column", gap: "6px", flexShrink: 0 }}
                >
                  <button
                    onClick={() => handleApprove(r.id)}
                    disabled={isPending}
                    style={{
                      fontSize: "11px",
                      fontWeight: 600,
                      padding: "6px 12px",
                      background: t.accent,
                      color: t.accentFg,
                      border: "none",
                      borderRadius: "8px",
                      cursor: isPending ? "not-allowed" : "pointer",
                      fontFamily: "inherit",
                    }}
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => handleDecline(r.id)}
                    disabled={isPending}
                    style={{
                      fontSize: "11px",
                      fontWeight: 600,
                      padding: "6px 12px",
                      background: "rgba(239,68,68,0.1)",
                      border: "1px solid rgba(239,68,68,0.2)",
                      borderRadius: "8px",
                      color: "#f87171",
                      cursor: isPending ? "not-allowed" : "pointer",
                      fontFamily: "inherit",
                    }}
                  >
                    Decline
                  </button>
                </div>
              ) : (
                isHost && (
                  <div
                    style={{ display: "flex", flexDirection: "column", gap: "6px", flexShrink: 0 }}
                  >
                    <a
                      href={`/e/${slug}/rsvp?token=${r.editToken}&return=guests`}
                      style={{
                        fontSize: "11px",
                        fontWeight: 600,
                        padding: "4px 10px",
                        background: t.inputBg,
                        border: `1px solid ${t.cardBorder}`,
                        borderRadius: "8px",
                        color: t.textSecondary,
                        textDecoration: "none",
                        display: "block",
                        textAlign: "center",
                      }}
                    >
                      Edit
                    </a>
                    <button
                      onClick={() => handleDelete(r.id)}
                      disabled={deletingId === r.id}
                      style={{
                        fontSize: "11px",
                        fontWeight: 600,
                        padding: "4px 10px",
                        background: "rgba(239,68,68,0.1)",
                        border: "1px solid rgba(239,68,68,0.2)",
                        borderRadius: "8px",
                        color: "#f87171",
                        cursor: "pointer",
                        fontFamily: "inherit",
                      }}
                    >
                      Remove
                    </button>
                  </div>
                )
              )}
            </div>
          ))}

          {filter === "INVITED" &&
            invited.map((inv) => (
              <div key={inv.id} style={{ ...cardStyle, alignItems: "flex-start" }}>
                <div
                  style={{
                    width: "38px",
                    height: "38px",
                    borderRadius: "50%",
                    background: t.pillBg,
                    border: `1px solid ${t.cardBorder}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    color: t.textMuted,
                    fontSize: "16px",
                  }}
                >
                  ✉
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}
                  >
                    {inv.guestName && (
                      <span style={{ fontWeight: 700, fontSize: "15px" }}>{inv.guestName}</span>
                    )}
                    <span
                      style={{
                        fontSize: "11px",
                        fontWeight: 700,
                        padding: "2px 8px",
                        borderRadius: "99px",
                        background: t.pillBg,
                        color: t.textMuted,
                        whiteSpace: "nowrap",
                        flexShrink: 0,
                      }}
                    >
                      No reply
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: "14px",
                      marginTop: "2px",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      color: t.textMuted,
                    }}
                  >
                    {inv.sentTo}
                  </div>
                  <div style={{ color: t.textMuted, fontSize: "12px", marginTop: "2px" }}>
                    Invited via {inv.channel === "EMAIL" ? "email" : "SMS"} ·{" "}
                    {new Date(inv.sentAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </div>
                </div>
                {isHost && inv.editToken && (
                  <div
                    style={{ display: "flex", flexDirection: "column", gap: "6px", flexShrink: 0 }}
                  >
                    <a
                      href={`/e/${slug}/rsvp?token=${inv.editToken}&return=guests`}
                      style={{
                        fontSize: "11px",
                        fontWeight: 600,
                        padding: "4px 10px",
                        background: t.inputBg,
                        border: `1px solid ${t.cardBorder}`,
                        borderRadius: "8px",
                        color: t.textSecondary,
                        textDecoration: "none",
                        display: "block",
                        textAlign: "center",
                      }}
                    >
                      Edit
                    </a>
                    <button
                      onClick={() => handleDeleteInvited(inv.id)}
                      style={{
                        fontSize: "11px",
                        fontWeight: 600,
                        padding: "4px 10px",
                        background: "rgba(239,68,68,0.1)",
                        border: "1px solid rgba(239,68,68,0.2)",
                        borderRadius: "8px",
                        color: "#f87171",
                        cursor: "pointer",
                        fontFamily: "inherit",
                      }}
                    >
                      Remove
                    </button>
                  </div>
                )}
              </div>
            ))}

          {filter === "INVITED" && invited.length === 0 && (
            <div style={{ textAlign: "center", padding: "60px 20px", color: t.textMuted }}>
              No pending invites.
            </div>
          )}
        </>
      )}
    </>
  );
}
