/* eslint-disable @next/next/no-img-element -- ImageResponse renders social artwork, not page content. */
import { ImageResponse } from "next/og";
import { db } from "@/lib/db";
import {
  SOCIAL_IMAGE_SIZE,
  absoluteAppUrl,
  formatSocialEventDate,
  isEventSociallyShareable,
  type SocialEvent,
} from "@/lib/event-social";

export async function renderEventSocialImage(slug: string) {
  const event = await db.event.findUnique({
    where: { slug },
    select: {
      slug: true,
      title: true,
      description: true,
      startAt: true,
      timezone: true,
      visibility: true,
      status: true,
      passwordHash: true,
      hostDisplayName: true,
      host: { select: { name: true } },
      theme: {
        select: {
          gradientFrom: true,
          gradientTo: true,
          accentColor: true,
          coverImageUrl: true,
        },
      },
    },
  });

  const shareable = isEventSociallyShareable(event);
  const { title, date, hostLine } = getEventSocialImageCopy(event);
  const gradientFrom = shareable ? (event.theme?.gradientFrom ?? "#7c3aed") : "#312e81";
  const gradientTo = shareable ? (event.theme?.gradientTo ?? "#1e40af") : "#7c3aed";
  const accent = shareable ? (event.theme?.accentColor ?? "#a855f7") : "#c084fc";
  const coverImage =
    shareable && event.theme?.coverImageUrl ? absoluteAppUrl(event.theme.coverImageUrl) : null;
  const titleSize = title.length > 60 ? 54 : title.length > 36 ? 64 : 76;

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        position: "relative",
        overflow: "hidden",
        background: `linear-gradient(135deg, ${gradientFrom}, ${gradientTo})`,
        color: "white",
        fontFamily: "Arial, Helvetica, sans-serif",
      }}
    >
      {coverImage && (
        <img
          src={coverImage}
          alt=""
          width={SOCIAL_IMAGE_SIZE.width}
          height={SOCIAL_IMAGE_SIZE.height}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
        />
      )}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          background: coverImage
            ? "linear-gradient(90deg, rgba(10,8,20,0.88) 0%, rgba(10,8,20,0.62) 58%, rgba(10,8,20,0.25) 100%)"
            : "linear-gradient(135deg, rgba(10,8,20,0.42), rgba(10,8,20,0.24))",
        }}
      />
      <div
        style={{
          position: "relative",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 84px 62px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "14px", fontSize: 25 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: accent,
              fontWeight: 900,
            }}
          >
            R
          </div>
          <div style={{ display: "flex", fontWeight: 700 }}>RSVP to Me</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", maxWidth: 920 }}>
          <div
            style={{
              display: "flex",
              fontSize: titleSize,
              fontWeight: 900,
              lineHeight: 1.05,
              letterSpacing: "-0.035em",
              textShadow: "0 3px 18px rgba(0,0,0,0.35)",
            }}
          >
            {title}
          </div>
          {date && (
            <div
              style={{
                display: "flex",
                marginTop: 20,
                fontSize: 25,
                fontWeight: 600,
                color: "rgba(255,255,255,0.94)",
                textShadow: "0 2px 10px rgba(0,0,0,0.4)",
              }}
            >
              {hostLine}
            </div>
          )}
          {date && (
            <div
              style={{
                display: "flex",
                marginTop: 12,
                fontSize: 27,
                color: "rgba(255,255,255,0.88)",
                textShadow: "0 2px 10px rgba(0,0,0,0.35)",
              }}
            >
              {date}
            </div>
          )}
        </div>

        <div style={{ display: "flex", fontSize: 19, color: "rgba(255,255,255,0.72)" }}>
          {shareable ? "You’re invited" : "Open your invitation to learn more"}
        </div>
      </div>
    </div>,
    SOCIAL_IMAGE_SIZE
  );
}

type EventSocialImageSource =
  | (SocialEvent & {
      hostDisplayName?: string | null;
      host?: { name: string | null } | null;
    })
  | null
  | undefined;

export function getEventSocialImageCopy(event: EventSocialImageSource) {
  if (!isEventSociallyShareable(event)) {
    return { title: "Event invitation", date: null, hostLine: null };
  }

  const hostName = event.hostDisplayName?.trim() || event.host?.name?.trim() || "Event host";
  return {
    title: event.title,
    date: formatSocialEventDate(event),
    hostLine: `Hosted by ${hostName}`,
  };
}
