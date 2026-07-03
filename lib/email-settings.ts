import { cache } from "react";
import { z } from "zod";
import { db } from "@/lib/db";
import { EMAIL_TEMPLATE_META, type TemplateId, type TemplateOverrides } from "@/emails/registry";

// Admin-editable template copy + structural toggles, stored as one
// SystemConfig row per template (key email_template_<id>) holding a JSON
// object of overrides only. Reset-to-default = delete the row.

export const templateOverridesSchema = z
  .object({
    // Strip CR/LF so edited copy can never inject additional mail headers.
    subject: z
      .string()
      .max(200)
      .transform((s) => s.replace(/[\r\n]+/g, " ").trim())
      .optional(),
    body: z.string().max(5000).optional(),
    showCalendarLinks: z.boolean().optional(),
    showMapLink: z.boolean().optional(),
    showHostFlourish: z.boolean().optional(),
    showCoverImage: z.boolean().optional(),
  })
  .strict();

export function templateConfigKey(id: TemplateId): string {
  return `email_template_${id}`;
}

/**
 * Read a template's saved overrides. `cache()` deduplicates within a request /
 * cron tick (same precedent as getChannelConfig); a malformed row falls back
 * to no overrides rather than breaking sends.
 */
export const getEmailTemplateSettings = cache(
  async (id: TemplateId): Promise<TemplateOverrides> => {
    const row = await db.systemConfig.findUnique({ where: { key: templateConfigKey(id) } });
    if (!row?.value) return {};
    try {
      const parsed = templateOverridesSchema.safeParse(JSON.parse(row.value));
      return parsed.success ? parsed.data : {};
    } catch {
      return {};
    }
  }
);

/** Overrides merged over registry defaults — what the editor UI displays. */
export function mergeWithDefaults(id: TemplateId, overrides: TemplateOverrides) {
  const meta = EMAIL_TEMPLATE_META[id];
  return {
    subject: overrides.subject || meta.defaultSubject,
    body: (meta.bodyEditable && overrides.body) || meta.defaultBody,
  };
}
