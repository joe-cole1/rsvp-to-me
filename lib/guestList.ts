// Serialization for the guest-list page. The stripping here is security
// critical: the client component visually hides host-only fields, but anything
// serialized into the RSC payload is readable by every visitor who inspects the
// page. So for non-hosts we omit editToken (guest impersonation), guestEmail /
// guestPhone (contact-info leak), and questionnaire answers (private responses).

export type RsvpStatus = "GOING" | "MAYBE" | "NO" | "INVITED";

export type GuestListRsvpInput = {
  id: string;
  guestName: string;
  guestEmail: string | null;
  guestPhone: string | null;
  status: RsvpStatus;
  plusOneCount: number;
  note: string | null;
  createdAt: Date;
  answers: { value: string; rsvpField: { label: string } }[];
  plusOneGuests: { name: string }[];
  editToken: string;
  user: { avatarUrl: string | null } | null;
  checkIn?: { checkedInAt: Date; checkedInBy: string | null } | null;
};

export type SerializedGuestRsvp = {
  id: string;
  guestName: string;
  guestEmail: string | null;
  guestPhone: string | null;
  status: RsvpStatus;
  plusOneCount: number;
  note: string | null;
  createdAt: string;
  answers: { label: string; value: string }[];
  plusOneGuests: string[];
  editToken: string;
  user: { avatarUrl: string | null } | null;
  checkIn: { checkedInAt: string; checkedInBy: string | null } | null;
};

/** The event's guest-list visibility setting. */
export type GuestListVisibility = "ALL" | "GUESTS_ONLY" | "HOST_ONLY";

/** How the current viewer relates to the event, for guest-list gating. */
export type GuestListViewer = {
  isHost: boolean;
  /** Logged-in user who already has an RSVP on this event. */
  isLoggedInGuest: boolean;
  /** Presented a valid per-RSVP editToken for this event. */
  hasValidToken: boolean;
};

/**
 * SEC-33: authorize access to the dedicated `/e/[slug]/guests` full guest-list
 * page. Hosts/co-hosts/admins always see it. `GUESTS_ONLY` additionally admits
 * the event's own guests — a logged-in guest with an RSVP or a valid token —
 * but never an anonymous visitor. `HOST_ONLY` is hosts only. `ALL` is anyone
 * who already cleared the visibility/password gate.
 *
 * Callers must run the `resolveEventAccess` gate first; this only layers the
 * guest-list-visibility rule on top of an already-granted viewer.
 */
export function canViewGuestListPage(
  guestListVis: GuestListVisibility | string,
  { isHost, isLoggedInGuest, hasValidToken }: GuestListViewer
): boolean {
  if (isHost) return true;
  if (guestListVis === "HOST_ONLY") return false;
  if (guestListVis === "GUESTS_ONLY") return isLoggedInGuest || hasValidToken;
  return true; // "ALL"
}

/**
 * SEC-32: minimal structural shape of the fields `stripHostOnlyEventData`
 * touches. Kept generic so the huge Prisma event payload passed to the event
 * page's Client Component satisfies it structurally.
 */
type StrippableEvent = {
  guestListVis: GuestListVisibility | string;
  host: { email: string | null };
  coHosts: { user: { email: string | null } }[];
  rsvps: unknown[];
  activityEvents?: { type: string }[];
};

const RSVP_IDENTITY_ACTIVITY_TYPES = new Set([
  "rsvp_new",
  "rsvp_update",
  "rsvp_delete",
  "guest_invite",
]);

const ATTENDANCE_ACTIVITY_TYPES = new Set(["check_in", "check_in_undo", "walk_in"]);

/**
 * SEC-32 / SEC-39: remove restricted data before an event object is serialized into the
 * RSC payload of the public event page (a Client Component boundary — every
 * field ships to anyone who can load the page, not just what the UI renders).
 * For non-hosts:
 *   - null out host/co-host email (contact-info PII, only ever a display
 *     fallback behind name/displayName — never meant to reach guests);
 *   - empty the approved guest list whenever the guest-list visibility gate
 *     would hide it in the UI (`guestListVis !== "ALL"`), so hidden rows aren't
 *     shipped behind a render-only guard.
 *   - remove RSVP identity activity whenever the same viewer cannot see the
 *     guest list, and always remove host-only attendance activity.
 * Hosts get the object unchanged.
 */
export function stripHostOnlyEventData<E extends StrippableEvent>(
  event: E,
  viewer: GuestListViewer
): E {
  if (viewer.isHost) return event;

  const canViewRsvpIdentity = canViewGuestListPage(event.guestListVis, viewer);
  return {
    ...event,
    host: { ...event.host, email: null },
    coHosts: event.coHosts.map((ch) => ({ ...ch, user: { ...ch.user, email: null } })),
    rsvps: event.guestListVis === "ALL" ? event.rsvps : [],
    ...(event.activityEvents
      ? {
          activityEvents: event.activityEvents.filter(
            (activity) =>
              !ATTENDANCE_ACTIVITY_TYPES.has(activity.type) &&
              (canViewRsvpIdentity || !RSVP_IDENTITY_ACTIVITY_TYPES.has(activity.type))
          ),
        }
      : {}),
  } as E;
}

/**
 * Serialize an RSVP row for the guest-list client component, stripping
 * host-only fields when `isHost` is false. `note` stays visible to everyone
 * (it is shown publicly on the event page too).
 */
export function serializeGuestRsvp(r: GuestListRsvpInput, isHost: boolean): SerializedGuestRsvp {
  return {
    id: r.id,
    guestName: r.guestName,
    guestEmail: isHost ? r.guestEmail : null,
    guestPhone: isHost ? r.guestPhone : null,
    status: r.status,
    plusOneCount: r.plusOneCount,
    note: r.note,
    createdAt: r.createdAt.toISOString(),
    answers: isHost ? r.answers.map((a) => ({ label: a.rsvpField.label, value: a.value })) : [],
    plusOneGuests: r.plusOneGuests.map((g) => g.name),
    editToken: isHost ? r.editToken : "",
    user: r.user,
    checkIn:
      isHost && r.checkIn
        ? { checkedInAt: r.checkIn.checkedInAt.toISOString(), checkedInBy: r.checkIn.checkedInBy }
        : null,
  };
}
