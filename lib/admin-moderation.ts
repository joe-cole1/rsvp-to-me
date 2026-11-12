/**
 * URLs for an ADMIN moderating an event they don't host.
 *
 * The event page shows its host view to an ADMIN only with `?admin=1` (see
 * `resolveEventAccess`), so an admin can still browse the guest view. The flag is never
 * an authorization on its own: it counts only for a session whose stored role is ADMIN,
 * and every mutation is authorized by `lib/auth-guards.ts`. The host-only sub-pages
 * (settings, guest list) admit admins by role, so only links back to the event page
 * need to carry the flag.
 */
export const ADMIN_MODERATION_PARAM = "admin";

/** The event page, in its host view when an admin is moderating it. */
export function eventPagePath(slug: string, adminModerating = false): string {
  return adminModerating ? `/e/${slug}?${ADMIN_MODERATION_PARAM}=1` : `/e/${slug}`;
}

/** The guest preview of the current event page URL, without the moderation flag. */
export function guestPreviewUrl(href: string): string {
  const url = new URL(href);
  url.searchParams.delete(ADMIN_MODERATION_PARAM);
  url.searchParams.set("preview", "1");
  return url.toString();
}
