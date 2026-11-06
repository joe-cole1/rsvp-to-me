import { requireEmailI18n, type EmailI18n } from "../i18n";
import type { EmailTheme } from "@/lib/email-theme";
import { linkStyle } from "./linkStyle";
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
    <tr style={{ marginBottom: "2px" }}>
      <td style={{ width: "32px", verticalAlign: "top" }}>
        <p style={{ margin: "2px 0", fontSize: "16px", lineHeight: "22px" }}>{label}</p>
      </td>
      <td style={{ verticalAlign: "top" }}>{children}</td>
    </tr>
  );
}

/** Structured date/time + location card with optional map and calendar links. */
export function DetailsCard({
  i18n,
  theme,
  event,
  showMapLink = true,
  showCalendarLinks = true,
}: {
  i18n?: EmailI18n;
  theme: EmailTheme;
  event: EventEmailDetails;
  showMapLink?: boolean;
  showCalendarLinks?: boolean;
}) {
  const { t, locale } = requireEmailI18n(i18n);
  const { date, time } = formatEventDateTime(event.startAt, event.endAt, event.timezone, locale);
  const isVirtual = event.locationType === "VIRTUAL";
  const mapQuery = [event.locationName, event.locationAddress].filter(Boolean).join(", ");

  const textStyle = {
    margin: "2px 0",
    fontSize: "14px",
    lineHeight: "22px",
    color: theme.textPrimary,
  };
  const subStyle = { ...textStyle, color: theme.textSecondary };
  const link = linkStyle(theme);

  return (
    <table
      align="center"
      width="100%"
      border={0}
      cellPadding="0"
      cellSpacing="0"
      role="presentation"
      className="dm-block"
      style={{
        backgroundColor: theme.cardBg,
        border: `1px solid ${theme.cardBorder}`,
        borderRadius: theme.cardRadius,
        padding: "16px 18px",
        margin: "20px 0 0",
      }}
    >
      <tbody>
        <DetailRow label="📅">
          <p className="dm-text-primary" style={{ ...textStyle, fontWeight: "600" }}>
            {date}
          </p>
          <p className="dm-text-secondary" style={subStyle}>
            {time}
          </p>
        </DetailRow>

        {isVirtual ? (
          <DetailRow label="💻">
            <p className="dm-text-primary" style={textStyle}>
              {event.locationName || t("Email.virtualEvent")}
            </p>
            {event.virtualUrl ? (
              <p className="dm-text-secondary" style={subStyle}>
                <a
                  href={event.virtualUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="dm-link"
                  style={link}
                >
                  {t("Email.joinLink")}
                </a>
              </p>
            ) : null}
          </DetailRow>
        ) : event.locationName || event.locationAddress ? (
          <DetailRow label="📍">
            <p className="dm-text-primary" style={{ ...textStyle, fontWeight: "600" }}>
              {event.locationName || event.locationAddress}
            </p>
            {event.locationName && event.locationAddress ? (
              <p className="dm-text-secondary" style={subStyle}>
                {event.locationAddress}
              </p>
            ) : null}
            {showMapLink && mapQuery ? (
              <p className="dm-text-secondary" style={subStyle}>
                <a
                  href={buildGoogleMapsUrl(mapQuery)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="dm-link"
                  style={link}
                >
                  {t("Email.openMap")}
                </a>
              </p>
            ) : null}
          </DetailRow>
        ) : null}

        {showCalendarLinks ? (
          <DetailRow label="🗓️">
            <p className="dm-text-secondary" style={subStyle}>
              {t("Email.addCalendar")}{" "}
              <a
                href={buildGoogleCalendarUrl(event)}
                target="_blank"
                rel="noopener noreferrer"
                className="dm-link"
                style={link}
              >
                Google
              </a>
              {" · "}
              <a
                href={icsUrlForEvent(event.slug)}
                target="_blank"
                rel="noopener noreferrer"
                className="dm-link"
                style={link}
              >
                Apple / Outlook (.ics)
              </a>
            </p>
          </DetailRow>
        ) : null}
      </tbody>
    </table>
  );
}
