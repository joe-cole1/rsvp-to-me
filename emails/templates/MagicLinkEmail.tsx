import { requireEmailI18n } from "../i18n";
import { EmailLayout } from "../components/EmailLayout";
import { Hero } from "../components/Hero";
import { EmailButton } from "../components/EmailButton";
import { splitParagraphs } from "../render";
import type { MagicLinkEmailProps } from "../types";

export function MagicLinkEmail({ i18n, theme, body, magicLink, code }: MagicLinkEmailProps) {
  const { t } = requireEmailI18n(i18n);
  return (
    <EmailLayout
      i18n={i18n}
      theme={theme}
      preview={t(code ? "Email.magicLink.preview" : "Email.magicLink.linkOnlyPreview")}
    >
      <Hero
        theme={theme}
        kicker="RSVP to Me"
        title={t("Email.magicLink.title")}
        showCoverImage={false}
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
                  className="dm-text-secondary"
                  style={{
                    margin: i === 0 ? "0" : "12px 0 0",
                    fontSize: "15px",
                    lineHeight: "24px",
                    color: theme.textSecondary,
                  }}
                >
                  {paragraph}
                </p>
              ))}
              <table
                align="center"
                width="100%"
                border={0}
                cellPadding="0"
                cellSpacing="0"
                role="presentation"
                style={{ margin: "24px 0 0", textAlign: "center" as const }}
              >
                <tbody>
                  <tr>
                    <td>
                      <EmailButton theme={theme} href={magicLink} variant="primary">
                        {t("Email.magicLink.title")}
                      </EmailButton>
                    </td>
                  </tr>
                </tbody>
              </table>
              {code && (
                <div style={{ marginTop: "24px", textAlign: "center" }}>
                  <p
                    className="dm-text-secondary"
                    style={{ color: theme.textSecondary, fontSize: "14px" }}
                  >
                    {t("Email.magicLink.codeLabel")}
                  </p>
                  <div
                    className="dm-block"
                    style={{
                      backgroundColor: theme.cardBg,
                      border: `1px solid ${theme.cardBorder}`,
                      borderRadius: theme.cardRadius,
                      padding: "20px",
                    }}
                  >
                    <span
                      className="dm-text-primary"
                      style={{
                        color: theme.textPrimary,
                        fontSize: "32px",
                        fontWeight: 700,
                        letterSpacing: "6px",
                        fontFamily: theme.bodyFont,
                      }}
                    >
                      {code}
                    </span>
                  </div>
                  <p
                    className="dm-text-secondary"
                    style={{ color: theme.textSecondary, fontSize: "13px" }}
                  >
                    {t("Email.magicLink.expiry")}
                  </p>
                </div>
              )}
              <p
                className="dm-text-muted"
                style={{ margin: "24px 0 0", fontSize: "12px", color: theme.textMuted }}
              >
                {t("Email.magicLink.ignore")}
              </p>
            </td>
          </tr>
        </tbody>
      </table>
    </EmailLayout>
  );
}
