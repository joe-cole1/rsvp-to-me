// Presentation only. Guest-list access and RSVP collection remain separate.
// Names and count are independent per row: a hidden list can still show its
// count, and every row may cap its count at "3+".
export type GuestListDisplay = "EXPANDED" | "COLLAPSED" | "HIDDEN";
export type GuestCountDisplay = "EXACT" | "CAPPED" | "HIDDEN";
/** Statuses a guest can reply with. */
export type GuestRsvpStatus = "GOING" | "MAYBE" | "NO";
/** Reply statuses plus Invited: host-added guests who have not replied yet. */
export type GuestDisplayStatus = GuestRsvpStatus | "INVITED";

export type GuestRsvpDisplayFields = {
  guestGoingList: GuestListDisplay;
  guestGoingCount: GuestCountDisplay;
  guestMaybeList: GuestListDisplay;
  guestMaybeCount: GuestCountDisplay;
  guestDeclinedList: GuestListDisplay;
  guestDeclinedCount: GuestCountDisplay;
  guestInvitedList: GuestListDisplay;
  guestInvitedCount: GuestCountDisplay;
};

export type GuestStatusDisplay = { list: GuestListDisplay; count: GuestCountDisplay };
export type GuestRsvpDisplay = Record<GuestDisplayStatus, GuestStatusDisplay>;

/** Counts above this read as "3+" when a row's count is capped. */
export const GUEST_COUNT_CAP = 3;

/** The three reply rows, in display order. */
export const GUEST_RSVP_GROUPS = [
  { status: "GOING", listField: "guestGoingList", countField: "guestGoingCount" },
  { status: "MAYBE", listField: "guestMaybeList", countField: "guestMaybeCount" },
  { status: "NO", listField: "guestDeclinedList", countField: "guestDeclinedCount" },
] as const;

/** Every row hosts configure: the reply rows, then Invited. */
export const GUEST_DISPLAY_ROWS = [
  ...GUEST_RSVP_GROUPS,
  { status: "INVITED", listField: "guestInvitedList", countField: "guestInvitedCount" },
] as const;

const HIDDEN_ROW: GuestStatusDisplay = { list: "HIDDEN", count: "HIDDEN" };
const FULL_ROW: GuestStatusDisplay = { list: "EXPANDED", count: "EXACT" };

// Missing reply fields represent older events/fixtures, which retain the
// original display. Invited predates no event, so it is hidden unless set.
export function guestRsvpDisplayFields(
  event: Partial<GuestRsvpDisplayFields> = {}
): GuestRsvpDisplayFields {
  return {
    guestGoingList: event.guestGoingList ?? "EXPANDED",
    guestGoingCount: event.guestGoingCount ?? "EXACT",
    guestMaybeList: event.guestMaybeList ?? "EXPANDED",
    guestMaybeCount: event.guestMaybeCount ?? "EXACT",
    guestDeclinedList: event.guestDeclinedList ?? "EXPANDED",
    guestDeclinedCount: event.guestDeclinedCount ?? "EXACT",
    guestInvitedList: event.guestInvitedList ?? "HIDDEN",
    guestInvitedCount: event.guestInvitedCount ?? "HIDDEN",
  };
}

export function isGuestRowShown(display: GuestStatusDisplay): boolean {
  return display.list !== "HIDDEN" || display.count !== "HIDDEN";
}

export function resolveGuestRsvpDisplay(
  event: Partial<GuestRsvpDisplayFields> = {},
  isHost = false
): GuestRsvpDisplay {
  const fields = guestRsvpDisplayFields(event);
  const invited: GuestStatusDisplay = {
    list: fields.guestInvitedList,
    count: fields.guestInvitedCount,
  };
  if (isHost) {
    // isHost includes co-hosts. They always see full reply lists and exact
    // counts. Invited stays on the host-only guest-list tab unless the host has
    // chosen to show it to guests, in which case hosts see it in full too.
    return {
      GOING: FULL_ROW,
      MAYBE: FULL_ROW,
      NO: FULL_ROW,
      INVITED: isGuestRowShown(invited) ? FULL_ROW : HIDDEN_ROW,
    };
  }
  return {
    GOING: { list: fields.guestGoingList, count: fields.guestGoingCount },
    MAYBE: { list: fields.guestMaybeList, count: fields.guestMaybeCount },
    NO: { list: fields.guestDeclinedList, count: fields.guestDeclinedCount },
    INVITED: invited,
  };
}

/** The count text for a row heading, or null when the count is hidden. */
export function guestCountLabel(count: number, display: GuestStatusDisplay): string | null {
  if (display.count === "HIDDEN") return null;
  return display.count === "CAPPED" && count >= GUEST_COUNT_CAP
    ? `${GUEST_COUNT_CAP}+`
    : String(count);
}

/** The total response line shows only when every reply count is exact. */
export function showGuestResponseTotal(display: GuestRsvpDisplay): boolean {
  return GUEST_RSVP_GROUPS.every(({ status }) => display[status].count === "EXACT");
}
