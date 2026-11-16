import { z } from "zod";

export const EventSlugSchema = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(/^[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*$/);

export const EventVisibilitySchema = z.enum(["PUBLIC", "UNLISTED", "PRIVATE"]);
export type EventVisibility = z.infer<typeof EventVisibilitySchema>;

export function retainsRandomCode(slug: string, code: string | null | undefined): boolean {
  return Boolean(code && (slug === code || slug.endsWith(`-${code}`)));
}

export const SaveEventUrlSchema = z.object({
  expectedSlug: EventSlugSchema,
  expectedVisibility: EventVisibilitySchema,
  slug: EventSlugSchema,
  visibility: EventVisibilitySchema,
  generatedProof: z.string().max(200).optional(),
  allowGuessable: z.boolean().default(false),
  confirmLinkChange: z.boolean().default(false),
});
export type SaveEventUrlInput = z.input<typeof SaveEventUrlSchema>;
export type EventUrlFailure = "invalid" | "taken" | "stale" | "confirmChange" | "confirmGuessable";

export type SaveEventUrlResult =
  | { success: true; slug: string; visibility: EventVisibility; randomCode: string | null }
  | { success: false; error: EventUrlFailure };
