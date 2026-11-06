import { requireEmailI18n } from "../i18n";
import { EmailLayout } from "../components/EmailLayout";
import { Hero } from "../components/Hero";
import { EmailButton } from "../components/EmailButton";
import { DetailsCard } from "../components/DetailsCard";
import { HostFlourish } from "../components/HostFlourish";
import { linkStyle } from "../components/linkStyle";
import { splitParagraphs } from "../render";
import { formatEventDateTime } from "@/lib/calendar";
import type { InviteEmailProps } from "../types";

export function InviteEmail({
  i18n,
  theme,
  body,
  toggles,
  event,
  hostName,
  rsvpBaseUrl,
  maybeEnabled,
  eventUrl,
}: InviteEmailProps) {
  const { t, locale } = requireEmailI18n(i18n);
  const { date } = formatEventDateTime(event.startAt, event.endAt, event.timezone, locale);
  const subtitle = event.locationName ? `${date} · ${event.locationName}` : date;
  return (
    <EmailLayout
      i18n={i18n}
      theme={theme}
      preview={t("Email.invite.preview", { hostName, eventTitle: event.title })}
    >
      <Hero
        theme={theme}
        kicker={t("Email.invite.kicker")}
        title={event.title}
        subtitle={subtitle}
        showCoverImage={toggles.showCoverImage}
      />
      <table
        align="center"
        width="100%"
        border={0}
        cellPadding="0"
        cellSpacing="0"
        role="presentation"
        className="email-content"
        style={{ padding: "24px 32px 30px" }}
      >
        <tbody>
          <tr>
            <td>
              {splitParagraphs(body).map((paragraph, i) => (
                <p
                  key={i}
                  className="dm-text-primary"
                  style={{
                    margin: i === 0 ? "0" : "12px 0 0",
                    fontSize: "15px",
                    lineHeight: "24px",
                    color: theme.textPrimary,
                  }}
                >
                  {paragraph}
                </p>
              ))}

              {toggles.showHostFlourish ? (
                <HostFlourish i18n={i18n} theme={theme} hostName={hostName} />
              ) : null}

              <DetailsCard
                i18n={i18n}
                theme={theme}
                event={event}
                showMapLink={toggles.showMapLink}
                showCalendarLinks={toggles.showCalendarLinks}
              />

              <table
                align="center"
                width="100%"
                border={0}
                cellPadding="0"
                cellSpacing="0"
                role="presentation"
                style={{ margin: "26px 0 0", textAlign: "center" as const }}
              >
                <tbody>
                  <tr>
                    <td>
                      <EmailButton
                        theme={theme}
                        href={`${rsvpBaseUrl}&status=GOING`}
                        variant="primary"
                      >
                        {t("Email.invite.going")}
                      </EmailButton>
                      <p style={{ margin: "14px 0 0" }}>
                        {maybeEnabled ? (
                          <>
                            <a
                              href={`${rsvpBaseUrl}&status=MAYBE`}
                              className="dm-text-secondary"
                              style={{
                                color: theme.textSecondary,
                                fontSize: "14px",
                                textDecoration: "underline",
                              }}
                            >
                              {t("Email.invite.maybe")}
                            </a>
                            <span className="dm-text-muted" style={{ color: theme.textMuted }}>
                              {"   ·   "}
                            </span>
                          </>
                        ) : null}
                        <a
                          href={`${rsvpBaseUrl}&status=NO`}
                          className="dm-text-secondary"
                          style={{
                            color: theme.textSecondary,
                            fontSize: "14px",
                            textDecoration: "underline",
                          }}
                        >
                          {t("Email.invite.no")}
                        </a>
                      </p>
                    </td>
                  </tr>
                </tbody>
              </table>

              <p style={{ margin: "22px 0 0", textAlign: "center" as const }}>
                <a
                  href={eventUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="dm-link"
                  style={linkStyle(theme, { fontSize: "14px" })}
                >
                  {t("Email.invite.details")}
                </a>
              </p>
            </td>
          </tr>
        </tbody>
      </table>
    </EmailLayout>
  );
}
