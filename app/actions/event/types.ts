// Dashboard query result types. Exported types cannot live in a "use server"
// file (only async functions may be exported there), so they sit in this plain
// module and are re-exported from the ./index barrel.

export type DashboardEvent = {
  id: string;
  slug: string;
  title: string;
  startAt: Date;
  status: string;
  theme: {
    gradientFrom: string;
    gradientTo: string;
    accentColor: string;
    coverImageUrl: string | null;
  } | null;
  going: number;
  maybe: number;
  pending: number;
  isCohost: boolean;
  host?: { name: string | null; email: string | null; avatarUrl: string | null } | null;
  coHosts?: { id: string; name: string | null; email: string | null; avatarUrl: string | null }[];
  commentCount: number;
  rsvpDeadline: Date | null;
  hostDisplayName: string | null;
};

export type DashboardInvite = {
  id: string;
  slug: string;
  title: string;
  startAt: Date;
  status: string;
  theme: {
    gradientFrom: string;
    gradientTo: string;
    accentColor: string;
    coverImageUrl: string | null;
  } | null;
  going: number;
  maybe: number;
  pending: number;
  isCohost: boolean;
  host: { name: string | null; email: string | null; avatarUrl: string | null } | null;
  coHosts?: { id: string; name: string | null; email: string | null; avatarUrl: string | null }[];
  commentCount: number;
  userRsvpStatus: string;
  userRsvpEditToken: string;
  rsvpDeadline: Date | null;
  hostDisplayName: string | null;
};

export type DashboardActivity = {
  id: string;
  eventId: string;
  type: string;
  actorName: string | null;
  detail: string;
  createdAt: Date;
  event: {
    title: string;
    slug: string;
  };
};
