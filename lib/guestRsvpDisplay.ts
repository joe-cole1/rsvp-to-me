// Presentation only. Guest-list access and RSVP collection remain separate.
export type GuestListDisplay = "EXPANDED" | "COLLAPSED" | "HIDDEN";
export type GuestCountDisplay = "EXACT" | "CAPPED" | "HIDDEN";
export type GuestRsvpStatus = "GOING" | "MAYBE" | "NO";

export type GuestRsvpDisplayFields = {
  guestGoingList: GuestListDisplay;
  guestGoingCount: GuestCountDisplay;
  guestMaybeList: GuestListDisplay;
  guestMaybeCount: GuestCountDisplay;
  guestDeclinedList: GuestListDisplay;
  guestDeclinedCount: GuestCountDisplay;
};

export type GuestStatusDisplay = { list: GuestListDisplay; count: GuestCountDisplay };
export type GuestRsvpDisplay = Record<GuestRsvpStatus, GuestStatusDisplay>;

export const GUEST_RSVP_GROUPS = [
  { status: "GOING", label: "Going", listField: "guestGoingList", countField: "guestGoingCount" },
  { status: "MAYBE", label: "Maybe", listField: "guestMaybeList", countField: "guestMaybeCount" },
  {
    status: "NO",
    label: "Can't make it",
    listField: "guestDeclinedList",
    countField: "guestDeclinedCount",
  },
] as const;

// Missing fields represent older events/fixtures, which retain the original display.
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
  };
}

export function resolveGuestRsvpDisplay(
  event: Partial<GuestRsvpDisplayFields> = {},
  isHost = false
): GuestRsvpDisplay {
  // isHost includes co-hosts. Their lists and exact counts always take precedence.
  const fields = guestRsvpDisplayFields(isHost ? {} : event);
  return {
    GOING: { list: fields.guestGoingList, count: fields.guestGoingCount },
    MAYBE: { list: fields.guestMaybeList, count: fields.guestMaybeCount },
    NO: { list: fields.guestDeclinedList, count: fields.guestDeclinedCount },
  };
}

export function guestCountLabel(count: number, display: GuestStatusDisplay): string | null {
  if (display.list === "HIDDEN" || display.count === "HIDDEN") return null;
  return display.count === "CAPPED" && count >= 3 ? "3+" : String(count);
}

export function showGuestResponseTotal(display: GuestRsvpDisplay): boolean {
  return GUEST_RSVP_GROUPS.every(
    ({ status }) => display[status].list !== "HIDDEN" && display[status].count === "EXACT"
  );
}
