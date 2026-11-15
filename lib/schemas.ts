import { safeUploadPath } from "@/lib/upload-path";
import { MIN_CARD_OPACITY } from "@/lib/theme";
import { z } from "zod";
import { maxCodeUnits, minCodeUnits } from "@/lib/string-length";

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
  .check(maxCodeUnits(1000))
  .transform((v) => (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(v) ? v : `https://${v}`))
  .refine((v) => /^https?:\/\//i.test(v), "URL must start with http:// or https://");

// SEC-37: mirrors the host invite-flow validation (app/actions/event/invites.ts)
// so RSVP contact info can't pollute the User table with junk identities.
export const GuestPhoneRegex = /^\+?[0-9\s\-().]{7,}$/;

export const SendMagicLinkSchema = z.object({
  identifier: z.string().trim().check(minCodeUnits(3)).check(maxCodeUnits(100)),
});

export const VerifySignInCodeSchema = z.object({
  identifier: SendMagicLinkSchema.shape.identifier,
  code: z.string().regex(/^\d{6}$/),
});

export const RegisterHostSchema = z.object({
  email: z.string().trim().email().toLowerCase().check(maxCodeUnits(100)),
  name: z.string().trim().min(1).check(maxCodeUnits(100)),
  inviteCode: z.string().trim().check(maxCodeUnits(100)).optional().or(z.literal("")),
});

export const AddCommentSchema = z.object({
  eventId: z.string().trim().min(1),
  guestName: z.string().trim().min(1).check(maxCodeUnits(100)),
  body: z.string().trim().min(1).check(maxCodeUnits(5000)), // L-3 length limit
  // SEC-24: unauthenticated guests authorize with their secret per-RSVP
  // editToken (not the public rsvpId). guestName above is advisory only — for
  // token/authenticated authors the stored name is derived server-side.
  guestEditToken: z.string().trim().optional().nullable(),
  parentId: z.string().trim().optional().nullable(),
});

export const CreateEventSchema = z.object({
  title: z.string().trim().min(1).check(maxCodeUnits(200)),
  description: z.string().trim().check(maxCodeUnits(10000)).optional().nullable(),
  startDate: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z
    .string()
    .trim()
    .regex(/^\d{2}:\d{2}$/),
  timezone: z.string().trim().check(maxCodeUnits(100)).default("America/New_York"),
  locationType: z.enum(["PHYSICAL", "VIRTUAL", "TBD"]).default("PHYSICAL"),
  locationName: z.string().trim().check(maxCodeUnits(200)).optional().nullable(),
  locationAddress: z.string().trim().check(maxCodeUnits(500)).optional().nullable(),
  virtualUrl: HttpUrlSchema.optional().nullable().or(z.literal("")),
  visibility: z.enum(["PUBLIC", "UNLISTED", "PRIVATE"]).default("UNLISTED"),
});

export const AddRsvpSchema = z.object({
  eventId: z.string().trim().min(1),
  guestName: z.string().trim().min(1).check(maxCodeUnits(100)),
  // SEC-37: format-validated — guestEmail becomes a User upsert key and a mail
  // recipient in addRSVP; guestPhone is normalized into a User lookup key.
  guestEmail: z
    .string()
    .trim()
    .toLowerCase()
    .email()
    .check(maxCodeUnits(100))
    .optional()
    .or(z.literal("")),
  guestPhone: z
    .string()
    .trim()
    .regex(GuestPhoneRegex)
    .check(maxCodeUnits(30))
    .optional()
    .or(z.literal("")),
  status: z.enum(["GOING", "MAYBE", "NO"]),
  plusOneCount: z.number().int().min(0).max(100).default(0),
  plusOneGuestNames: z
    .array(z.string().trim().check(maxCodeUnits(100)))
    .max(100)
    .optional(),
  note: z.string().trim().check(maxCodeUnits(1000)).optional(),
  // SEC-38: cap answer length (parity with note/comment caps); keys are further
  // validated against the event's own rsvpFields in addRSVP/updateRSVP.
  answers: z
    .record(z.string().check(maxCodeUnits(100)), z.string().check(maxCodeUnits(2000)))
    .optional(),
});

const GuestListDisplaySchema = z.enum(["EXPANDED", "COLLAPSED", "HIDDEN"]);
// Every response row may show an exact count, a "3+" cap, or no count.
const GuestCountDisplaySchema = z.enum(["EXACT", "CAPPED", "HIDDEN"]);

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
  guestGoingList: GuestListDisplaySchema.optional(),
  guestGoingCount: GuestCountDisplaySchema.optional(),
  guestMaybeList: GuestListDisplaySchema.optional(),
  guestMaybeCount: GuestCountDisplaySchema.optional(),
  guestDeclinedList: GuestListDisplaySchema.optional(),
  guestDeclinedCount: GuestCountDisplaySchema.optional(),
  guestInvitedList: GuestListDisplaySchema.optional(),
  guestInvitedCount: GuestCountDisplaySchema.optional(),
  visibility: z.enum(["PUBLIC", "UNLISTED", "PRIVATE"]).optional(),
  maybeEnabled: z.boolean().optional(),
  questionnaireEnabled: z.boolean().optional(),
  showTimestamps: z.boolean().optional(),
  password: z.string().check(maxCodeUnits(200)).nullable().optional(),
  guestSharingEnabled: z.boolean().optional(),
  guestsCanInvite: z.boolean().optional(),
  hostDisplayName: z.string().trim().check(maxCodeUnits(100)).nullable().optional(),
  hostAlertEmail: z.boolean().optional(),
  hostAlertSms: z.boolean().optional(),
});

export const UpdateRsvpSchema = z.object({
  guestName: z.string().trim().min(1).check(maxCodeUnits(100)).optional(),
  status: z.enum(["GOING", "MAYBE", "NO"]),
  plusOneCount: z.number().int().min(0).max(100).default(0),
  plusOneGuestNames: z
    .array(z.string().trim().check(maxCodeUnits(100)))
    .max(100)
    .optional(),
  note: z.string().trim().check(maxCodeUnits(1000)).optional(),
  // SEC-38: same caps as AddRsvpSchema.
  answers: z
    .record(z.string().check(maxCodeUnits(100)), z.string().check(maxCodeUnits(2000)))
    .optional(),
});

export const AddWalkInSchema = z.object({
  eventId: z.string().trim().min(1),
  guestName: z.string().trim().min(1).check(maxCodeUnits(100)),
  totalPartySize: z.number().int().min(1).max(11).default(1),
  guestEmail: z
    .string()
    .trim()
    .toLowerCase()
    .email()
    .check(maxCodeUnits(100))
    .optional()
    .or(z.literal("")),
  guestPhone: z
    .string()
    .trim()
    .regex(GuestPhoneRegex)
    .check(maxCodeUnits(30))
    .optional()
    .or(z.literal("")),
});

// Runtime boundaries: TypeScript signatures do not validate Server Action input.
const ShortText = z.string().trim().min(1).check(maxCodeUnits(200));
const Name = z.string().trim().min(1).check(maxCodeUnits(100));
const Color = z.string().regex(/^#[0-9a-f]{6}$/i);
export const UploadPathSchema = z
  .string()
  .refine((value) => safeUploadPath(value) !== null, "Choose an uploaded image.");
export const ProfileSettingsSchema = z.object({
  name: Name,
  avatarUrl: UploadPathSchema.nullable().optional(),
  email: RegisterHostSchema.shape.email.optional().or(z.literal("")),
  phone: z
    .string()
    .trim()
    .regex(GuestPhoneRegex)
    .check(maxCodeUnits(30))
    .optional()
    .or(z.literal("")),
});
export const CoHostEmailSchema = RegisterHostSchema.shape.email;
export const CreatePollSchema = z.object({
  question: ShortText,
  options: z.array(ShortText).max(50),
  multiChoice: z.boolean(),
  allowGuestsToAdd: z.boolean(),
  hideVoters: z.boolean(),
});
export const PollOptionSchema = ShortText;
export const PollSettingsSchema = z.object({
  question: ShortText.optional(),
  multiChoice: z.boolean().optional(),
  allowGuestsToAdd: z.boolean().optional(),
  hideVoters: z.boolean().optional(),
  locked: z.boolean().optional(),
});
export const PotluckItemSchema = z.object({
  label: ShortText,
  quantity: z.number().int().min(1).max(10000),
});
export const PotluckClaimSchema = z.object({
  guestName: Name,
  claimedQty: z.number().int().min(1).max(10000),
});
export const RsvpFieldSchema = z.object({
  label: ShortText,
  fieldType: z.enum(["TEXT", "TEXTAREA", "SELECT", "CHECKBOX"]),
  required: z.boolean(),
  options: z.string().check(maxCodeUnits(10000)).optional(),
  order: z.number().int().min(0).max(10000),
});
export const UpdateRsvpFieldSchema = RsvpFieldSchema.omit({ order: true }).partial();
export const InfoSectionSchema = z.object({
  eventId: z.string().min(1),
  type: z.enum([
    "shirt",
    "utensils",
    "parking",
    "link",
    "info",
    "music",
    "gift",
    "bed",
    "mappin",
    "calendar",
    "sparkles",
    "filetext",
    "camera",
    "phone",
    "zelle",
    "venmo",
    "DRESS_CODE",
    "FOOD",
    "PARKING",
    "LINK",
    "CUSTOM",
  ]),
  title: z.string().trim().check(maxCodeUnits(200)).nullable(),
  content: z.string().trim().check(maxCodeUnits(10000)),
  url: HttpUrlSchema.nullable().or(z.literal("")),
  order: z.number().int().min(0).max(10000),
});
export const UpdateInfoSectionSchema = InfoSectionSchema.omit({
  eventId: true,
  order: true,
}).extend({
  type: InfoSectionSchema.shape.type.optional(),
  title: InfoSectionSchema.shape.title.optional(),
});
export const EventThemeSchema = z.object({
  baseTheme: z.enum(["DARK", "SOFT", "BOLD"]),
  gradientFrom: Color,
  gradientTo: Color,
  accentColor: Color,
  cardOpacity: z.number().min(MIN_CARD_OPACITY).max(1).nullable().optional(),
});
export const EventFieldSchema = z.discriminatedUnion("field", [
  z.object({ field: z.literal("title"), value: ShortText }),
  z.object({
    field: z.literal("description"),
    value: z.string().trim().check(maxCodeUnits(10000)),
  }),
  z.object({ field: z.literal("locationName"), value: z.string().trim().check(maxCodeUnits(200)) }),
  z.object({
    field: z.literal("locationAddress"),
    value: z.string().trim().check(maxCodeUnits(500)),
  }),
  z.object({ field: z.literal("virtualUrl"), value: HttpUrlSchema.or(z.literal("")) }),
]);
const LocalDateTime = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)
  .refine((value) => {
    const date = new Date(`${value}:00Z`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 16) === value;
  }, "Enter a valid date and time.");
export const EventDatesSchema = z
  .object({ startAt: LocalDateTime, endAt: LocalDateTime.nullable() })
  .refine(({ startAt, endAt }) => !endAt || endAt > startAt, "End must follow start.");

export const EventLocationSchema = z.object({
  locationType: CreateEventSchema.shape.locationType,
  locationName: CreateEventSchema.shape.locationName.default(null),
  locationAddress: CreateEventSchema.shape.locationAddress.default(null),
  virtualUrl: CreateEventSchema.shape.virtualUrl.default(null),
});
