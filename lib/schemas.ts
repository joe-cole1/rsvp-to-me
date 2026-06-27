import { z } from "zod";

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
  rsvpId: z.string().trim().optional().nullable(),
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
  virtualUrl: z.string().trim().max(1000).optional().nullable(),
  visibility: z.enum(["PUBLIC", "UNLISTED", "PRIVATE"]).default("UNLISTED"),
});

export const AddRsvpSchema = z.object({
  eventId: z.string().trim().min(1),
  guestName: z.string().trim().min(1).max(100),
  guestEmail: z.string().trim().toLowerCase().max(100).optional().or(z.literal("")),
  guestPhone: z.string().trim().max(30).optional().or(z.literal("")),
  status: z.enum(["GOING", "MAYBE", "NO"]),
  plusOneCount: z.number().int().min(0).max(10).default(0),
  plusOneGuestNames: z.array(z.string().trim().max(100)).optional(),
  note: z.string().trim().max(1000).optional(),
  answers: z.record(z.string(), z.string()).optional(),
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
  capacity: z.number().int().min(0).nullable().optional(),
  guestListVis: z.enum(["ALL", "GUESTS_ONLY", "HOST_ONLY"]).optional(),
  visibility: z.enum(["PUBLIC", "UNLISTED", "PRIVATE"]).optional(),
  maybeEnabled: z.boolean().optional(),
  questionnaireEnabled: z.boolean().optional(),
  showTimestamps: z.boolean().optional(),
  password: z.string().nullable().optional(),
  guestSharingEnabled: z.boolean().optional(),
  guestsCanInvite: z.boolean().optional(),
});

export const UpdateRsvpSchema = z.object({
  status: z.enum(["GOING", "MAYBE", "NO"]),
  plusOneCount: z.number().int().min(0).max(10).default(0),
  plusOneGuestNames: z.array(z.string().trim().max(100)).optional(),
  note: z.string().trim().max(1000).optional(),
  answers: z.record(z.string(), z.string()).optional(),
});
