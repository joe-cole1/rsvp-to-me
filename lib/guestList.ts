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
};

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
  };
}
