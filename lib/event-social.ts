import type { Metadata } from "next";
import { createTranslator } from "next-intl";
import english from "@/messages/en-US.json";

export const SOCIAL_IMAGE_SIZE = { width: 1200, height: 630 } as const;

/** The site's name, as link previews and document titles show it. */
export const SITE_NAME = "RSVP to Me";

export type SocialEvent = {
  slug: string;
  title: string;
  description: string | null;
  startAt: Date;
  timezone: string;
  visibility: "PUBLIC" | "UNLISTED" | "PRIVATE";
  status: "DRAFT" | "PUBLISHED" | "CANCELLED" | "DELETED";
  passwordHash: string | null;
  theme?: {
    gradientFrom: string;
    gradientTo: string;
    accentColor: string;
    coverImageUrl: string | null;
  } | null;
};

export type SocialPresentation = {
  locale?: string;
  translate?: (
    key: keyof typeof english.Ui.Event.Social,
    values?: Record<string, string | number>
  ) => string;
};

// Pure English fallback keeps existing synchronous callers request-independent.
export function resolveSocialPresentation(presentation: SocialPresentation = {}) {
  return {
    locale: presentation.locale ?? "en-US",
    translate:
      presentation.translate ??
      createTranslator({ locale: "en-US", messages: english.Ui.Event.Social }),
  };
}

export function getAppOrigin(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/+$/, "");
}

export function absoluteAppUrl(path: string): string {
  return new URL(path, `${getAppOrigin()}/`).toString();
}

/**
 * Whether an event's title may appear where anyone can read it (link previews, document
 * titles): published, not private, and not password-protected.
 */
export function isEventTitlePublic(
  event: Pick<SocialEvent, "status" | "visibility" | "passwordHash"> | null | undefined
): boolean {
  return !!(
    event &&
    event.status === "PUBLISHED" &&
    event.visibility !== "PRIVATE" &&
    !event.passwordHash
  );
}

export function isEventSociallyShareable(
  event: SocialEvent | null | undefined
): event is SocialEvent {
  return isEventTitlePublic(event);
}

export function formatSocialEventDate(
  event: Pick<SocialEvent, "startAt" | "timezone">,
  locale: string = "en-US"
): string {
  return new Intl.DateTimeFormat(locale, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: event.timezone,
  }).format(event.startAt);
}

function compactDescription(value: string): string {
  const collapsed = value.replace(/\s+/g, " ").trim();
  if (collapsed.length <= 200) return collapsed;
  return `${collapsed.slice(0, 197).trimEnd()}…`;
}

export function buildEventSocialMetadata(
  event: SocialEvent | null | undefined,
  requestedSlug: string,
  presentation?: SocialPresentation
): Metadata {
  const { locale, translate } = resolveSocialPresentation(presentation);
  const slug = event?.slug ?? requestedSlug;
  const encodedSlug = encodeURIComponent(slug);
  const canonicalPath = `/e/${encodedSlug}`;
  const openGraphImage = `${canonicalPath}/opengraph-image`;
  const twitterImage = `${canonicalPath}/twitter-image`;
  const shareable = isEventSociallyShareable(event);
  const title = shareable ? event.title : translate("genericTitle");
  const description = shareable
    ? compactDescription(
        event.description?.trim() ||
          translate("invitation", {
            title: event.title,
            date: formatSocialEventDate(event, locale),
          })
      )
    : translate("genericDescription");
  const imageAlt = shareable
    ? translate("imageAlt", { title: event.title })
    : translate("genericTitle");

  return {
    title,
    description,
    alternates: { canonical: canonicalPath },
    robots:
      shareable && event.visibility === "PUBLIC"
        ? { index: true, follow: true }
        : {
            index: false,
            follow: false,
          },
    openGraph: {
      type: "website",
      locale: locale.replaceAll("-", "_"),
      siteName: SITE_NAME,
      title,
      description,
      url: canonicalPath,
      images: [
        {
          url: openGraphImage,
          width: SOCIAL_IMAGE_SIZE.width,
          height: SOCIAL_IMAGE_SIZE.height,
          alt: imageAlt,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [{ url: twitterImage, alt: imageAlt }],
    },
  };
}
