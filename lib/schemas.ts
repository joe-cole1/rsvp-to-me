import { z } from "zod";

// SEC-36: host-supplied URLs (event virtual link, info-section links) are
// rendered into guest-facing <a href>, so a javascript:/data: URI would execute
// in the guest's browser on click. Only http(s) may be persisted. A bare
// "zoom.us/j/…" paste (no scheme at all) is auto-prefixed with https:// so the
// common host workflow keeps working; anything with an explicit non-http
// scheme is rejected.
export const HttpUrlSchema = z
  .string()
  .trim()
  .min(1)
  .max(1000)
  .transform((v) => (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(v) ? v : `https://${v}`))
  .refine((v) => /^https?:\/\//i.test(v), "URL must start with http:// or https://");

// SEC-37: mirrors the host invite-flow validation (app/actions/event/invites.ts)
// so RSVP contact info can't pollute the User table with junk identities.
export const GuestPhoneRegex = /^\+?[0-9\s\-().]{7,}$/;

export const SendMagicLinkSchema = z.object({
  identifier: z.string().trim().min(3).max(100),
});

export const RegisterHostSchema = z.object({
  email: z.string().trim().email().toLowerCase().max(100),
  name: z.string().trim().min(1).max(100),
  inviteCode: z.string().trim().max(100).optional().or(z.literal("")),
});

export const AddCommentSchema = z.object({
  eventId: z.string().trim().min(1),
  guestName: z.string().trim().min(1).max(100),
  body: z.string().trim().min(1).max(5000), // L-3 length limit
  // SEC-24: unauthenticated guests authorize with their secret per-RSVP
  // editToken (not the public rsvpId). guestName above is advisory only — for
  // token/authenticated authors the stored name is derived server-side.
  guestEditToken: z.string().trim().optional().nullable(),
  parentId: z.string().trim().optional().nullable(),
});

export const CreateEventSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(10000).optional().nullable(),
  startDate: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z
    .string()
    .trim()
    .regex(/^\d{2}:\d{2}$/),
  timezone: z.string().trim().max(100).default("America/New_York"),
  locationType: z.enum(["PHYSICAL", "VIRTUAL", "TBD"]).default("PHYSICAL"),
  locationName: z.string().trim().max(200).optional().nullable(),
  locationAddress: z.string().trim().max(500).optional().nullable(),
  virtualUrl: HttpUrlSchema.optional().nullable().or(z.literal("")),
  visibility: z.enum(["PUBLIC", "UNLISTED", "PRIVATE"]).default("UNLISTED"),
});

export const AddRsvpSchema = z.object({
  eventId: z.string().trim().min(1),
  guestName: z.string().trim().min(1).max(100),
  // SEC-37: format-validated — guestEmail becomes a User upsert key and a mail
  // recipient in addRSVP; guestPhone is normalized into a User lookup key.
  guestEmail: z.string().trim().toLowerCase().email().max(100).optional().or(z.literal("")),
  guestPhone: z.string().trim().regex(GuestPhoneRegex).max(30).optional().or(z.literal("")),
  status: z.enum(["GOING", "MAYBE", "NO"]),
  plusOneCount: z.number().int().min(0).max(10).default(0),
  plusOneGuestNames: z.array(z.string().trim().max(100)).optional(),
  note: z.string().trim().max(1000).optional(),
  // SEC-38: cap answer length (parity with note/comment caps); keys are further
  // validated against the event's own rsvpFields in addRSVP/updateRSVP.
  answers: z.record(z.string().max(100), z.string().max(2000)).optional(),
});

// SEC-20: explicit allow-list for `saveEventSettings`. Server actions do not
// enforce their TS parameter types at runtime, so without this schema a crafted
// call could spread arbitrary Event scalar columns (status, slug, hostId, …)
// into the update. Unknown keys are stripped (Zod's default) before the write.
export const SaveEventSettingsSchema = z.object({
  commentsEnabled: z.boolean().optional(),
  plusOneAllowed: z.boolean().optional(),
  plusOneMax: z.number().int().min(0).max(100).optional(),
  plusOneNamesRequired: z.boolean().optional(),
  approvalRequired: z.boolean().optional(),
  rsvpDeadline: z.string().trim().nullable().optional(),
  allowEditAfterDeadline: z.boolean().optional(),
  capacity: z.number().int().min(0).nullable().optional(),
  guestListVis: z.enum(["ALL", "GUESTS_ONLY", "HOST_ONLY"]).optional(),
  visibility: z.enum(["PUBLIC", "UNLISTED", "PRIVATE"]).optional(),
  maybeEnabled: z.boolean().optional(),
  questionnaireEnabled: z.boolean().optional(),
  showTimestamps: z.boolean().optional(),
  password: z.string().nullable().optional(),
  guestSharingEnabled: z.boolean().optional(),
  guestsCanInvite: z.boolean().optional(),
  hostDisplayName: z.string().trim().max(100).nullable().optional(),
  hostAlertEmail: z.boolean().optional(),
  hostAlertSms: z.boolean().optional(),
});

export const UpdateRsvpSchema = z.object({
  status: z.enum(["GOING", "MAYBE", "NO"]),
  plusOneCount: z.number().int().min(0).max(10).default(0),
  plusOneGuestNames: z.array(z.string().trim().max(100)).optional(),
  note: z.string().trim().max(1000).optional(),
  // SEC-38: same caps as AddRsvpSchema.
  answers: z.record(z.string().max(100), z.string().max(2000)).optional(),
});

export const AddWalkInSchema = z.object({
  eventId: z.string().trim().min(1),
  guestName: z.string().trim().min(1).max(100),
  totalPartySize: z.number().int().min(1).max(11).default(1),
  guestEmail: z.string().trim().toLowerCase().email().max(100).optional().or(z.literal("")),
  guestPhone: z.string().trim().regex(GuestPhoneRegex).max(30).optional().or(z.literal("")),
});
