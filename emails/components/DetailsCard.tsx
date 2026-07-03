import { Column, Link, Row, Section, Text } from "@react-email/components";
import type { EmailTheme } from "@/lib/email-theme";
import {
  buildGoogleCalendarUrl,
  buildGoogleMapsUrl,
  formatEventDateTime,
  icsUrlForEvent,
  type CalendarEventInput,
} from "@/lib/calendar";

export type EventEmailDetails = CalendarEventInput & {
  timezone?: string;
  locationType?: "PHYSICAL" | "VIRTUAL" | "TBD";
};

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Row style={{ marginBottom: "2px" }}>
      <Column style={{ width: "32px", verticalAlign: "top" }}>
        <Text style={{ margin: "2px 0", fontSize: "16px", lineHeight: "22px" }}>{label}</Text>
      </Column>
      <Column style={{ verticalAlign: "top" }}>{children}</Column>
    </Row>
  );
}

/** Structured date/time + location card with optional map and calendar links. */
export function DetailsCard({
  theme,
  event,
  showMapLink = true,
  showCalendarLinks = true,
}: {
  theme: EmailTheme;
  event: EventEmailDetails;
  showMapLink?: boolean;
  showCalendarLinks?: boolean;
}) {
  const { date, time } = formatEventDateTime(event.startAt, event.endAt, event.timezone);
  const isVirtual = event.locationType === "VIRTUAL";
  const mapQuery = [event.locationName, event.locationAddress].filter(Boolean).join(", ");

  const textStyle = {
    margin: "2px 0",
    fontSize: "14px",
    lineHeight: "22px",
    color: theme.textPrimary,
  };
  const subStyle = { ...textStyle, color: theme.textSecondary };
  const linkStyle = { color: theme.accent, textDecoration: "underline" };

  return (
    <Section
      className="dm-block"
      style={{
        backgroundColor: theme.cardBg,
        border: `1px solid ${theme.cardBorder}`,
        borderRadius: theme.cardRadius,
        padding: "16px 18px",
        margin: "20px 0 0",
      }}
    >
      <DetailRow label="📅">
        <Text className="dm-text-primary" style={{ ...textStyle, fontWeight: "600" }}>
          {date}
        </Text>
        <Text className="dm-text-secondary" style={subStyle}>
          {time}
        </Text>
      </DetailRow>

      {isVirtual ? (
        <DetailRow label="💻">
          <Text className="dm-text-primary" style={textStyle}>
            {event.locationName || "Virtual event"}
          </Text>
          {event.virtualUrl ? (
            <Text style={subStyle}>
              <Link href={event.virtualUrl} style={linkStyle}>
                Join link
              </Link>
            </Text>
          ) : null}
        </DetailRow>
      ) : event.locationName || event.locationAddress ? (
        <DetailRow label="📍">
          <Text className="dm-text-primary" style={{ ...textStyle, fontWeight: "600" }}>
            {event.locationName || event.locationAddress}
          </Text>
          {event.locationName && event.locationAddress ? (
            <Text className="dm-text-secondary" style={subStyle}>
              {event.locationAddress}
            </Text>
          ) : null}
          {showMapLink && mapQuery ? (
            <Text style={subStyle}>
              <Link href={buildGoogleMapsUrl(mapQuery)} style={linkStyle}>
                Open in Google Maps
              </Link>
            </Text>
          ) : null}
        </DetailRow>
      ) : null}

      {showCalendarLinks ? (
        <DetailRow label="🗓️">
          <Text style={subStyle}>
            Add to calendar:{" "}
            <Link href={buildGoogleCalendarUrl(event)} style={linkStyle}>
              Google
            </Link>
            {" · "}
            <Link href={icsUrlForEvent(event.slug)} style={linkStyle}>
              Apple / Outlook (.ics)
            </Link>
          </Text>
        </DetailRow>
      ) : null}
    </Section>
  );
}
