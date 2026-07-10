// ── Types ──────────────────────────────────────────────────────────────────────

export type PendingRsvp = {
  id: string;
  guestName: string;
  guestEmail: string | null;
  status: "GOING" | "MAYBE" | "NO";
  plusOneCount: number;
  createdAt: Date;
};

export type EventData = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  startAt: Date;
  endAt: Date | null;
  timezone: string;
  locationType: "PHYSICAL" | "VIRTUAL" | "TBD";
  locationName: string | null;
  locationAddress: string | null;
  virtualUrl: string | null;
  commentsEnabled: boolean;
  plusOneAllowed: boolean;
  plusOneMax: number;
  plusOneNamesRequired: boolean;
  guestSharingEnabled: boolean;
  guestsCanInvite: boolean;
  approvalRequired: boolean;
  maybeEnabled: boolean;
  questionnaireEnabled: boolean;
  showTimestamps: boolean;
  guestListVis: "ALL" | "GUESTS_ONLY" | "HOST_ONLY";
  visibility: "PUBLIC" | "UNLISTED" | "PRIVATE";
  hostDisplayName: string | null;
  allowEditAfterDeadline: boolean;
  host: { id: string; name: string | null; email: string; avatarUrl?: string | null };
  coHosts: {
    id: string;
    userId: string;
    displayName: string | null;
    user: { name: string | null; email: string };
  }[];
  theme: {
    baseTheme: "DARK" | "SOFT" | "BOLD";
    gradientFrom: string;
    gradientTo: string;
    accentColor: string;
    coverImageUrl: string | null;
  } | null;
  infoSections: {
    id: string;
    type: string;
    title: string | null;
    content: string;
    url: string | null;
    order: number;
  }[];
  rsvps: {
    id: string;
    guestName: string;
    status: "GOING" | "MAYBE" | "NO";
    plusOneCount: number;
    note: string | null;
    createdAt: Date;
    user?: { avatarUrl: string | null } | null;
  }[];
  comments: {
    id: string;
    guestName: string;
    body: string;
    rsvpId?: string | null;
    createdAt: Date;
    replies: {
      id: string;
      guestName: string;
      body: string;
      rsvpId?: string | null;
      createdAt: Date;
    }[];
  }[];
  rsvpFields: {
    id: string;
    label: string;
    fieldType: string;
    required: boolean;
    options: string | null;
  }[];
  updates: { id: string; body: string; notifyGuests: boolean; createdAt: Date }[];
  potluckItems: {
    id: string;
    label: string;
    quantity: number;
    createdAt: Date;
    claims: {
      id: string;
      potluckItemId: string;
      guestName: string;
      quantity: number;
      createdAt: Date;
    }[];
  }[];
  rsvpDeadline: Date | null;
  pendingRsvps: PendingRsvp[];
  activityEvents: {
    id: string;
    type: string;
    actorName: string | null;
    detail: string;
    createdAt: Date;
  }[];
  polls: {
    id: string;
    question: string;
    multiChoice: boolean;
    allowGuestsToAdd: boolean;
    locked: boolean;
    hideVoters: boolean;
    createdAt: Date;
    options: {
      id: string;
      text: string;
      creatorName: string | null;
      createdAt: Date;
      votes: {
        id: string;
        voterName: string;
        createdAt: Date;
      }[];
    }[];
  }[];
};

export type LocationType = "PHYSICAL" | "VIRTUAL" | "TBD";

export type GuestRsvp = {
  id: string;
  guestName: string;
  editToken: string;
  status: "GOING" | "MAYBE" | "NO" | "INVITED";
  hasAnswers: boolean;
  responded: boolean;
  approved: boolean;
};
