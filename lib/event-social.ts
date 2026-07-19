import type { Metadata } from "next";

export const SOCIAL_IMAGE_SIZE = { width: 1200, height: 630 } as const;

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

const GENERIC_TITLE = "Event invitation";
const GENERIC_DESCRIPTION = "View this event invitation on RSVP to Me.";

export function getAppOrigin(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/+$/, "");
}

export function absoluteAppUrl(path: string): string {
  return new URL(path, `${getAppOrigin()}/`).toString();
}

export function isEventSociallyShareable(
  event: SocialEvent | null | undefined
): event is SocialEvent {
  return !!(
    event &&
    event.status === "PUBLISHED" &&
    event.visibility !== "PRIVATE" &&
    !event.passwordHash
  );
}

export function formatSocialEventDate(event: Pick<SocialEvent, "startAt" | "timezone">): string {
  return new Intl.DateTimeFormat("en-US", {
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
  requestedSlug: string
): Metadata {
  const slug = event?.slug ?? requestedSlug;
  const encodedSlug = encodeURIComponent(slug);
  const canonicalPath = `/e/${encodedSlug}`;
  const openGraphImage = `${canonicalPath}/opengraph-image`;
  const twitterImage = `${canonicalPath}/twitter-image`;
  const shareable = isEventSociallyShareable(event);
  const title = shareable ? event.title : GENERIC_TITLE;
  const description = shareable
    ? compactDescription(
        event.description?.trim() ||
          `You’re invited to ${event.title} on ${formatSocialEventDate(event)}.`
      )
    : GENERIC_DESCRIPTION;
  const imageAlt = shareable ? `${event.title} event invitation` : GENERIC_TITLE;

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
      locale: "en_US",
      siteName: "RSVP to Me",
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
