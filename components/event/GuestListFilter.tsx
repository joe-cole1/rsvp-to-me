"use client";

import { useState, useTransition } from "react";
import type { ResolvedTheme } from "@/lib/theme";
import {
  addWalkIn,
  approveRsvp,
  checkInRsvp,
  deleteInvitationAsHost,
  declineRsvp,
  deleteRsvpAsHost,
  inviteGuest,
  undoCheckIn,
} from "@/app/actions/event";
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
  checkIn: { checkedInAt: string; checkedInBy: string | null } | null;
};

type InvitedGuest = {
  id: string;
  rsvpId?: string;
  sentTo: string;
  channel: "EMAIL" | "SMS";
  sentAt: string;
  guestName?: string;
  editToken?: string;
  plusOneCount?: number;
  checkIn?: { checkedInAt: string; checkedInBy: string | null } | null;
};

type Filter =
  "ALL" | "CHECKED_IN" | "NOT_CHECKED_IN" | "GOING" | "MAYBE" | "NO" | "INVITED" | "PENDING";

export function GuestListFilter({
  going: initialGoing,
  maybe: initialMaybe,
  no: initialNo,
  pending: initialPending = [],
  invited: initialInvited,
  isHost,
  eventId,
  slug,
  timezone,
  channelConfig,
  t,
}: {
  going: RSVP[];
  maybe: RSVP[];
  no: RSVP[];
  pending?: RSVP[];
  invited: InvitedGuest[];
  isHost: boolean;
  eventId: string;
  slug: string;
  timezone: string;
  channelConfig: { email: boolean; sms: boolean };
  t: ResolvedTheme;
}) {
  const [filter, setFilter] = useState<Filter>("ALL");
  const [going, setGoing] = useState(initialGoing);
  const [maybe, setMaybe] = useState(initialMaybe);
  const [no, setNo] = useState(initialNo);
  const [pending, setPending] = useState(initialPending);
  const [invited, setInvited] = useState(initialInvited);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deletingInvitationId, setDeletingInvitationId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [attendanceError, setAttendanceError] = useState<string | null>(null);
  const [invitationMessage, setInvitationMessage] = useState<string | null>(null);
  const [checkInPendingId, setCheckInPendingId] = useState<string | null>(null);
  const [resendPendingId, setResendPendingId] = useState<string | null>(null);
  const [undoConfirmId, setUndoConfirmId] = useState<string | null>(null);
  const [showWalkIn, setShowWalkIn] = useState(false);
  const [walkInName, setWalkInName] = useState("");
  const [walkInPartySize, setWalkInPartySize] = useState(1);
  const [walkInEmail, setWalkInEmail] = useState("");
  const [walkInPhone, setWalkInPhone] = useState("");
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
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
  const attendanceRsvps = [...allRsvps, ...pending];
  const checkableInvited = invited.filter((guest) => guest.rsvpId);
  const checkedInRsvps = attendanceRsvps.filter((r) => r.checkIn);
  const checkedInInvited = checkableInvited.filter((guest) => guest.checkIn);
  const checkedInParties = checkedInRsvps.length + checkedInInvited.length;
  const attendanceParties = attendanceRsvps.length + checkableInvited.length;
  const checkedInPeople =
    checkedInRsvps.reduce((sum, r) => sum + 1 + r.plusOneCount, 0) +
    checkedInInvited.reduce((sum, guest) => sum + 1 + (guest.plusOneCount ?? 0), 0);
  const expectedPeople =
    attendanceRsvps.reduce((sum, r) => sum + 1 + r.plusOneCount, 0) +
    checkableInvited.reduce((sum, guest) => sum + 1 + (guest.plusOneCount ?? 0), 0);
  const baseDisplayedRsvps =
    filter === "ALL"
      ? allRsvps
      : filter === "CHECKED_IN"
        ? checkedInRsvps
        : filter === "NOT_CHECKED_IN"
          ? attendanceRsvps.filter((r) => !r.checkIn)
          : filter === "GOING"
            ? going
            : filter === "MAYBE"
              ? maybe
              : filter === "NO"
                ? no
                : filter === "PENDING"
                  ? pending
                  : [];
  const normalizedSearch = search.trim().toLowerCase();
  const displayedRsvps = normalizedSearch
    ? baseDisplayedRsvps.filter((r) =>
        [r.guestName, r.guestEmail, r.guestPhone, ...r.plusOneGuests]
          .filter(Boolean)
          .some((value) => value!.toLowerCase().includes(normalizedSearch))
      )
    : baseDisplayedRsvps;
  const attendanceFilteredInvited =
    filter === "CHECKED_IN"
      ? checkedInInvited
      : filter === "NOT_CHECKED_IN"
        ? checkableInvited.filter((guest) => !guest.checkIn)
        : invited;
  const displayedInvited = normalizedSearch
    ? attendanceFilteredInvited.filter((guest) =>
        [guest.guestName, guest.sentTo]
          .filter(Boolean)
          .some((value) => value!.toLowerCase().includes(normalizedSearch))
      )
    : attendanceFilteredInvited;
  const showInvited =
    isHost &&
    (filter === "ALL" ||
      filter === "INVITED" ||
      filter === "CHECKED_IN" ||
      filter === "NOT_CHECKED_IN");

  const chips: { key: Filter; label: string; count: number }[] = [
    { key: "ALL", label: "All", count: allRsvps.length + (isHost ? invited.length : 0) },
    ...(isHost
      ? [
          { key: "CHECKED_IN" as Filter, label: "Arrived", count: checkedInParties },
          {
            key: "NOT_CHECKED_IN" as Filter,
            label: "Not arrived",
            count: attendanceParties - checkedInParties,
          },
        ]
      : []),
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

  const handleDeleteInvitation = (invitationId: string) => {
    if (!confirm("Remove this invitation? This cannot be undone.")) return;
    setDeletingInvitationId(invitationId);
    startTransition(async () => {
      const result = await deleteInvitationAsHost(invitationId);
      if (result.success) {
        setInvited((prev) => prev.filter((inv) => inv.id !== invitationId));
      }
      setDeletingInvitationId(null);
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

  const updateRsvp = (rsvpId: string, updater: (rsvp: RSVP) => RSVP) => {
    const update = (list: RSVP[]) =>
      list.map((rsvp) => (rsvp.id === rsvpId ? updater(rsvp) : rsvp));
    setGoing(update);
    setMaybe(update);
    setNo(update);
    setPending(update);
  };

  const updateInvitedRsvp = (rsvpId: string, updater: (guest: InvitedGuest) => InvitedGuest) => {
    setInvited((current) =>
      current.map((guest) => (guest.rsvpId === rsvpId ? updater(guest) : guest))
    );
  };

  const handleCheckIn = (rsvp: RSVP) => {
    const optimisticCheckIn = { checkedInAt: new Date().toISOString(), checkedInBy: null };
    setAttendanceError(null);
    setCheckInPendingId(rsvp.id);
    updateRsvp(rsvp.id, (item) => ({ ...item, checkIn: optimisticCheckIn }));
    startTransition(async () => {
      try {
        const result = await checkInRsvp(rsvp.id);
        updateRsvp(rsvp.id, (item) => ({
          ...item,
          checkIn: {
            checkedInAt: new Date(result.checkIn.checkedInAt).toISOString(),
            checkedInBy: result.checkIn.checkedInBy,
          },
        }));
      } catch (error) {
        updateRsvp(rsvp.id, (item) => ({ ...item, checkIn: rsvp.checkIn }));
        setAttendanceError(
          error instanceof Error ? error.message : "Unable to check in this party."
        );
      } finally {
        setCheckInPendingId(null);
      }
    });
  };

  const handleUndoCheckIn = (rsvp: RSVP) => {
    if (undoConfirmId !== rsvp.id) {
      setUndoConfirmId(rsvp.id);
      return;
    }
    setUndoConfirmId(null);
    setAttendanceError(null);
    setCheckInPendingId(rsvp.id);
    updateRsvp(rsvp.id, (item) => ({ ...item, checkIn: null }));
    startTransition(async () => {
      try {
        await undoCheckIn(rsvp.id);
      } catch (error) {
        updateRsvp(rsvp.id, (item) => ({ ...item, checkIn: rsvp.checkIn }));
        setAttendanceError(error instanceof Error ? error.message : "Unable to undo check-in.");
      } finally {
        setCheckInPendingId(null);
      }
    });
  };

  const handleInvitedCheckIn = (guest: InvitedGuest) => {
    if (!guest.rsvpId) return;
    const previousCheckIn = guest.checkIn ?? null;
    const optimisticCheckIn = { checkedInAt: new Date().toISOString(), checkedInBy: null };
    setAttendanceError(null);
    setCheckInPendingId(guest.rsvpId);
    updateInvitedRsvp(guest.rsvpId, (item) => ({ ...item, checkIn: optimisticCheckIn }));
    startTransition(async () => {
      try {
        const result = await checkInRsvp(guest.rsvpId!);
        updateInvitedRsvp(guest.rsvpId!, (item) => ({
          ...item,
          checkIn: {
            checkedInAt: new Date(result.checkIn.checkedInAt).toISOString(),
            checkedInBy: result.checkIn.checkedInBy,
          },
        }));
      } catch (error) {
        updateInvitedRsvp(guest.rsvpId!, (item) => ({ ...item, checkIn: previousCheckIn }));
        setAttendanceError(
          error instanceof Error ? error.message : "Unable to check in this party."
        );
      } finally {
        setCheckInPendingId(null);
      }
    });
  };

  const handleInvitedUndoCheckIn = (guest: InvitedGuest) => {
    if (!guest.rsvpId) return;
    if (undoConfirmId !== guest.rsvpId) {
      setUndoConfirmId(guest.rsvpId);
      return;
    }
    const previousCheckIn = guest.checkIn ?? null;
    setUndoConfirmId(null);
    setAttendanceError(null);
    setCheckInPendingId(guest.rsvpId);
    updateInvitedRsvp(guest.rsvpId, (item) => ({ ...item, checkIn: null }));
    startTransition(async () => {
      try {
        await undoCheckIn(guest.rsvpId!);
      } catch (error) {
        updateInvitedRsvp(guest.rsvpId!, (item) => ({ ...item, checkIn: previousCheckIn }));
        setAttendanceError(error instanceof Error ? error.message : "Unable to undo check-in.");
      } finally {
        setCheckInPendingId(null);
      }
    });
  };

  const handleResendInvite = (guest: InvitedGuest) => {
    setInvitationMessage(null);
    setResendPendingId(guest.id);
    startTransition(async () => {
      try {
        const result = await inviteGuest(eventId, guest.sentTo);
        setInvitationMessage(
          result.errors?.length
            ? `Invite resent with a warning: ${result.errors.join("; ")}`
            : `Invite resent to ${guest.sentTo}.`
        );
      } catch (error) {
        setInvitationMessage(error instanceof Error ? error.message : "Unable to resend invite.");
      } finally {
        setResendPendingId(null);
      }
    });
  };

  const handleAddWalkIn = () => {
    startTransition(async () => {
      setAttendanceError(null);
      try {
        const result = await addWalkIn({
          eventId,
          guestName: walkInName,
          totalPartySize: walkInPartySize,
          guestEmail: walkInEmail,
          guestPhone: walkInPhone,
        });
        if (!result.success) throw new Error(result.error);
        setShowWalkIn(false);
        setWalkInName("");
        setWalkInPartySize(1);
        setWalkInEmail("");
        setWalkInPhone("");
        if (result.kind === "existing") {
          const reconciledCheckIn = {
            checkedInAt: new Date(result.checkIn.checkedInAt).toISOString(),
            checkedInBy: result.checkIn.checkedInBy,
          };
          updateRsvp(result.rsvpId, (item) => ({ ...item, checkIn: reconciledCheckIn }));
          updateInvitedRsvp(result.rsvpId, (item) => ({
            ...item,
            checkIn: reconciledCheckIn,
          }));
          setFilter(!result.approved ? "PENDING" : result.status === "INVITED" ? "INVITED" : "ALL");
          setSearch(result.guestName);
          setHighlightedId(result.rsvpId);
          return;
        }
        setFilter("ALL");
        const newRsvp: RSVP = {
          ...result.rsvp,
          status: "GOING",
          createdAt: new Date(result.rsvp.createdAt).toISOString(),
          answers: [],
          plusOneGuests: [],
          user: null,
          checkIn: {
            checkedInAt: new Date(result.checkIn.checkedInAt).toISOString(),
            checkedInBy: result.checkIn.checkedInBy,
          },
        };
        setGoing((current) => [...current, newRsvp]);
        setSearch(newRsvp.guestName);
        setHighlightedId(newRsvp.id);
      } catch (error) {
        setAttendanceError(error instanceof Error ? error.message : "Unable to add this walk-in.");
      }
    });
  };

  return (
    <>
      {isHost && (
        <div
          style={{
            background: t.cardBg,
            border: `1px solid ${t.cardBorder}`,
            borderRadius: "14px",
            padding: "16px",
            marginBottom: "16px",
          }}
        >
          <div style={{ fontWeight: 800, fontSize: "15px" }}>Event attendance</div>
          <div style={{ color: t.textSecondary, fontSize: "13px", marginTop: "4px" }}>
            {checkedInParties} of {attendanceParties} parties · {checkedInPeople} of{" "}
            {expectedPeople} people arrived
          </div>
          <div style={{ display: "flex", gap: "8px", marginTop: "14px", flexWrap: "wrap" }}>
            <input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setHighlightedId(null);
              }}
              placeholder="Search name, email, phone…"
              aria-label="Search guest list"
              style={{
                flex: "1 1 220px",
                minWidth: 0,
                padding: "9px 11px",
                borderRadius: "8px",
                border: `1px solid ${t.inputBorder}`,
                background: t.inputBg,
                color: t.textPrimary,
                fontFamily: "inherit",
              }}
            />
            <a
              href={`/e/${slug}/guests.csv`}
              style={{
                padding: "9px 12px",
                borderRadius: "8px",
                border: `1px solid ${t.cardBorder}`,
                color: t.textSecondary,
                textDecoration: "none",
                fontSize: "13px",
                fontWeight: 700,
              }}
            >
              Download CSV
            </a>
            <button
              onClick={() => setShowWalkIn((value) => !value)}
              style={{
                padding: "9px 12px",
                borderRadius: "8px",
                border: "none",
                background: t.accent,
                color: t.accentFg,
                fontFamily: "inherit",
                fontSize: "13px",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              {showWalkIn ? "Cancel" : "+ Add walk-in"}
            </button>
          </div>
          {showWalkIn && (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                handleAddWalkIn();
              }}
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                gap: "8px",
                marginTop: "12px",
                paddingTop: "12px",
                borderTop: `1px solid ${t.cardBorder}`,
              }}
            >
              <input
                required
                maxLength={100}
                value={walkInName}
                onChange={(event) => setWalkInName(event.target.value)}
                placeholder="Guest name"
                aria-label="Walk-in guest name"
                style={{
                  padding: "9px",
                  borderRadius: "8px",
                  border: `1px solid ${t.inputBorder}`,
                }}
              />
              <input
                required
                type="number"
                min={1}
                max={11}
                value={walkInPartySize}
                onChange={(event) => setWalkInPartySize(Number(event.target.value))}
                aria-label="Total party size"
                title="Total party size"
                style={{
                  padding: "9px",
                  borderRadius: "8px",
                  border: `1px solid ${t.inputBorder}`,
                }}
              />
              {channelConfig.email && (
                <input
                  type="email"
                  maxLength={100}
                  value={walkInEmail}
                  onChange={(event) => setWalkInEmail(event.target.value)}
                  placeholder="Email (optional)"
                  aria-label="Walk-in email"
                  style={{
                    padding: "9px",
                    borderRadius: "8px",
                    border: `1px solid ${t.inputBorder}`,
                  }}
                />
              )}
              {channelConfig.sms && (
                <input
                  type="tel"
                  maxLength={30}
                  value={walkInPhone}
                  onChange={(event) => setWalkInPhone(event.target.value)}
                  placeholder="Phone (optional)"
                  aria-label="Walk-in phone"
                  style={{
                    padding: "9px",
                    borderRadius: "8px",
                    border: `1px solid ${t.inputBorder}`,
                  }}
                />
              )}
              <button
                type="submit"
                disabled={isPending || !walkInName.trim()}
                style={{
                  padding: "9px 12px",
                  borderRadius: "8px",
                  border: "none",
                  background: t.accent,
                  color: t.accentFg,
                  fontWeight: 700,
                  cursor: isPending ? "wait" : "pointer",
                }}
              >
                {isPending ? "Adding…" : "Add and check in"}
              </button>
            </form>
          )}
          {attendanceError && (
            <div
              role="status"
              aria-live="polite"
              style={{ color: "#f87171", fontSize: "12px", marginTop: "10px" }}
            >
              {attendanceError}
            </div>
          )}
          {invitationMessage && (
            <div
              role="status"
              aria-live="polite"
              style={{ color: t.textSecondary, fontSize: "12px", marginTop: "10px" }}
            >
              {invitationMessage}
            </div>
          )}
        </div>
      )}
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

      {displayedRsvps.length === 0 &&
      (!showInvited || displayedInvited.length === 0) &&
      filter !== "INVITED" ? (
        <div style={{ textAlign: "center", padding: "60px 20px", color: t.textMuted }}>
          No one here yet.
        </div>
      ) : (
        <>
          {displayedRsvps.map((r) => (
            <div
              key={r.id}
              style={{
                ...cardStyle,
                opacity: deletingId === r.id ? 0.5 : 1,
                border:
                  highlightedId === r.id ? `2px solid ${t.accent}` : `1px solid ${t.cardBorder}`,
              }}
            >
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
                    fill
                    sizes="38px"
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
                  {r.checkIn && (
                    <span
                      style={{
                        fontSize: "11px",
                        fontWeight: 700,
                        padding: "2px 8px",
                        borderRadius: "99px",
                        background: t.accentBg,
                        color: t.accent,
                      }}
                    >
                      ✓ Arrived
                    </span>
                  )}
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
                  {r.checkIn && (
                    <>
                      {" · Checked in "}
                      {new Intl.DateTimeFormat("en-US", {
                        hour: "numeric",
                        minute: "2-digit",
                        timeZone: timezone,
                      }).format(new Date(r.checkIn.checkedInAt))}
                    </>
                  )}
                </div>
              </div>

              {isHost && filter === "PENDING" ? (
                <div
                  style={{ display: "flex", flexDirection: "column", gap: "6px", flexShrink: 0 }}
                >
                  <button
                    onClick={() => (r.checkIn ? handleUndoCheckIn(r) : handleCheckIn(r))}
                    disabled={checkInPendingId === r.id}
                    style={{
                      fontSize: "11px",
                      fontWeight: 700,
                      padding: "5px 10px",
                      background: r.checkIn ? t.inputBg : t.accent,
                      border: r.checkIn ? `1px solid ${t.cardBorder}` : "none",
                      borderRadius: "8px",
                      color: r.checkIn ? t.textSecondary : t.accentFg,
                      cursor: checkInPendingId === r.id ? "wait" : "pointer",
                      fontFamily: "inherit",
                    }}
                  >
                    {checkInPendingId === r.id
                      ? "Saving…"
                      : r.checkIn
                        ? undoConfirmId === r.id
                          ? "Confirm undo"
                          : "Undo check-in"
                        : "Check in"}
                  </button>
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
                    <button
                      onClick={() => (r.checkIn ? handleUndoCheckIn(r) : handleCheckIn(r))}
                      disabled={checkInPendingId === r.id}
                      style={{
                        fontSize: "11px",
                        fontWeight: 700,
                        padding: "5px 10px",
                        background: r.checkIn ? t.inputBg : t.accent,
                        border: r.checkIn ? `1px solid ${t.cardBorder}` : "none",
                        borderRadius: "8px",
                        color: r.checkIn ? t.textSecondary : t.accentFg,
                        cursor: checkInPendingId === r.id ? "wait" : "pointer",
                        fontFamily: "inherit",
                      }}
                    >
                      {checkInPendingId === r.id
                        ? "Saving…"
                        : r.checkIn
                          ? undoConfirmId === r.id
                            ? "Confirm undo"
                            : "Undo check-in"
                          : "Check in"}
                    </button>
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

          {showInvited &&
            displayedInvited.map((inv) => (
              <div
                key={inv.id}
                style={{
                  ...cardStyle,
                  alignItems: "flex-start",
                  opacity: deletingInvitationId === inv.id ? 0.5 : 1,
                  border:
                    highlightedId === inv.id
                      ? `2px solid ${t.accent}`
                      : `1px solid ${t.cardBorder}`,
                }}
              >
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
                    {inv.checkIn && (
                      <span
                        style={{
                          fontSize: "11px",
                          fontWeight: 700,
                          padding: "2px 8px",
                          borderRadius: "99px",
                          background: t.accentBg,
                          color: t.accent,
                        }}
                      >
                        ✓ Arrived
                      </span>
                    )}
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
                    {inv.checkIn && (
                      <>
                        {" · Checked in "}
                        {new Intl.DateTimeFormat("en-US", {
                          hour: "numeric",
                          minute: "2-digit",
                          timeZone: timezone,
                        }).format(new Date(inv.checkIn.checkedInAt))}
                      </>
                    )}
                  </div>
                </div>
                {isHost && (
                  <div
                    style={{ display: "flex", flexDirection: "column", gap: "6px", flexShrink: 0 }}
                  >
                    {inv.rsvpId && (
                      <button
                        onClick={() =>
                          inv.checkIn ? handleInvitedUndoCheckIn(inv) : handleInvitedCheckIn(inv)
                        }
                        disabled={checkInPendingId === inv.rsvpId}
                        style={{
                          fontSize: "11px",
                          fontWeight: 700,
                          padding: "5px 10px",
                          background: inv.checkIn ? t.inputBg : t.accent,
                          border: inv.checkIn ? `1px solid ${t.cardBorder}` : "none",
                          borderRadius: "8px",
                          color: inv.checkIn ? t.textSecondary : t.accentFg,
                          cursor: checkInPendingId === inv.rsvpId ? "wait" : "pointer",
                          fontFamily: "inherit",
                        }}
                      >
                        {checkInPendingId === inv.rsvpId
                          ? "Saving…"
                          : inv.checkIn
                            ? undoConfirmId === inv.rsvpId
                              ? "Confirm undo"
                              : "Undo check-in"
                            : "Check in"}
                      </button>
                    )}
                    <button
                      onClick={() => handleResendInvite(inv)}
                      disabled={resendPendingId === inv.id}
                      style={{
                        fontSize: "11px",
                        fontWeight: 600,
                        padding: "4px 10px",
                        background: t.inputBg,
                        border: `1px solid ${t.cardBorder}`,
                        borderRadius: "8px",
                        color: t.textSecondary,
                        cursor: resendPendingId === inv.id ? "wait" : "pointer",
                        fontFamily: "inherit",
                      }}
                    >
                      {resendPendingId === inv.id ? "Sending…" : "Resend invite"}
                    </button>
                    {inv.editToken && (
                      <>
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
                      </>
                    )}
                    {!inv.rsvpId && (
                      <button
                        onClick={() => handleDeleteInvitation(inv.id)}
                        disabled={deletingInvitationId === inv.id}
                        style={{
                          fontSize: "11px",
                          fontWeight: 600,
                          padding: "4px 10px",
                          background: "rgba(239,68,68,0.1)",
                          border: "1px solid rgba(239,68,68,0.2)",
                          borderRadius: "8px",
                          color: "#f87171",
                          cursor: deletingInvitationId === inv.id ? "wait" : "pointer",
                          fontFamily: "inherit",
                        }}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}

          {filter === "INVITED" && displayedInvited.length === 0 && (
            <div style={{ textAlign: "center", padding: "60px 20px", color: t.textMuted }}>
              No pending invites.
            </div>
          )}
        </>
      )}
    </>
  );
}
