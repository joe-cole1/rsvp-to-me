import { requireEmailI18n } from "../i18n";
import { EmailLayout } from "../components/EmailLayout";
import { Hero } from "../components/Hero";
import { EmailButton } from "../components/EmailButton";
import { DetailsCard } from "../components/DetailsCard";
import { splitParagraphs } from "../render";
import type { RsvpConfirmationEmailProps } from "../types";

export function RsvpConfirmationEmail({
  i18n,
  theme,
  body,
  toggles,
  event,
  status,
  eventUrl,
  editUrl,
  manageUrl,
}: RsvpConfirmationEmailProps) {
  const { t } = requireEmailI18n(i18n);
  const emoji = status === "GOING" ? " 🎉" : status === "MAYBE" ? " 🤞" : "";
  const footer = (
    <p className="dm-text-muted" style={{ margin: 0, fontSize: "13px", color: theme.textMuted }}>
      {t("Email.confirmation.changed")}{" "}
      <a href={editUrl} target="_blank" rel="noopener noreferrer" style={{ color: theme.accent }}>
        {t("Email.confirmation.update")}
      </a>
      {manageUrl && (
        <>
          <br />
          <a
            href={manageUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: theme.accent }}
          >
            {t("Ui.Notifications.manageEvent")}
          </a>
        </>
      )}
    </p>
  );
  const statusLabel = t(`Email.status.${status}`);
  return (
    <EmailLayout
      i18n={i18n}
      theme={theme}
      preview={t("Email.confirmation.preview", { status: statusLabel, eventTitle: event.title })}
      footer={footer}
    >
      <Hero
        theme={theme}
        kicker={t("Email.confirmation.kicker")}
        title={event.title}
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
              <h2
                className="dm-text-primary"
                style={{
                  margin: 0,
                  fontFamily: theme.headingFont,
                  fontWeight: theme.headingWeight,
                  textTransform: theme.headingTransform as "uppercase" | "none",
                  fontSize: "20px",
                  color: theme.textPrimary,
                }}
              >
                {t("Email.confirmation.heading", { status: statusLabel, emoji })}
              </h2>
              {splitParagraphs(body).map((paragraph, i) => (
                <p
                  key={i}
                  className="dm-text-secondary"
                  style={{
                    margin: "10px 0 0",
                    fontSize: "15px",
                    lineHeight: "24px",
                    color: theme.textSecondary,
                  }}
                >
                  {paragraph}
                </p>
              ))}

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
                      <EmailButton theme={theme} href={eventUrl} variant="primary">
                        {t("Email.viewEvent")}
                      </EmailButton>
                    </td>
                  </tr>
                </tbody>
              </table>
            </td>
          </tr>
        </tbody>
      </table>
    </EmailLayout>
  );
}
