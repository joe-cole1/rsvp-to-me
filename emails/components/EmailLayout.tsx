import { locales } from "@/i18n/config";
import { requireEmailI18n, type EmailI18n } from "../i18n";
import { EMAIL_DARK_MODE as DM, type EmailTheme } from "@/lib/email-theme";
import type * as React from "react";

// Progressive dark-mode enhancement: honored by Apple Mail / Outlook / Samsung,
// ignored by Gmail (which applies its own inversion to the light canvas — an
// acceptable degradation per the design decision "light canvas + themed accents").
// Colors come from EMAIL_DARK_MODE and the theme's linkColorDark, which
// resolveEmailTheme() keeps readable on these surfaces.
// The mobile query stacks padding down for ≤480px viewports.
function responsiveStyles(theme: EmailTheme): string {
  return `
  @media only screen and (max-width: 480px) {
    .email-content { padding-left: 20px !important; padding-right: 20px !important; }
    .email-hero { padding-left: 20px !important; padding-right: 20px !important; }
  }
  @media (prefers-color-scheme: dark) {
    .email-canvas { background-color: ${DM.canvas} !important; }
    .email-card { background-color: ${DM.body} !important; }
    .dm-text-primary { color: ${DM.textPrimary} !important; }
    .dm-text-secondary { color: ${DM.textSecondary} !important; }
    .dm-text-muted { color: ${DM.textMuted} !important; }
    .dm-link { color: ${theme.linkColorDark} !important; text-decoration-color: ${theme.linkColorDark} !important; }
    .dm-block { background-color: ${DM.card} !important; border-color: ${DM.border} !important; }
  }
`;
}

export function EmailLayout({
  i18n,
  theme,
  preview,
  footer,
  children,
}: {
  i18n?: EmailI18n;
  theme: EmailTheme;
  preview: string;
  footer?: React.ReactNode;
  children: React.ReactNode;
}) {
  const { t, locale } = requireEmailI18n(i18n);
  return (
    <html lang={locale} dir={locales[locale].dir}>
      <head>
        <meta name="color-scheme" content="light dark" />
        <meta name="supported-color-schemes" content="light dark" />
        <style>{responsiveStyles(theme)}</style>
      </head>
      <body
        className="email-canvas"
        style={{
          margin: 0,
          padding: 0,
          backgroundColor: theme.canvasBg,
          fontFamily: theme.bodyFont,
        }}
      >
        <div
          style={{
            display: "none",
            overflow: "hidden",
            lineHeight: "1px",
            opacity: 0,
            maxHeight: 0,
            maxWidth: 0,
          }}
        >
          {preview}
        </div>
        <div style={{ maxWidth: "600px", margin: "0 auto", padding: "24px 12px" }}>
          <table
            align="center"
            width="100%"
            border={0}
            cellPadding="0"
            cellSpacing="0"
            role="presentation"
          >
            <tbody>
              <tr>
                <td>
                  <table
                    align="center"
                    width="100%"
                    border={0}
                    cellPadding="0"
                    cellSpacing="0"
                    role="presentation"
                    className="email-card"
                    style={{
                      backgroundColor: theme.bodyBg,
                      borderRadius: "16px",
                      overflow: "hidden",
                      border: `1px solid ${theme.cardBorder}`,
                    }}
                  >
                    <tbody>
                      <tr>
                        <td>{children}</td>
                      </tr>
                    </tbody>
                  </table>
                  <table
                    align="center"
                    width="100%"
                    border={0}
                    cellPadding="0"
                    cellSpacing="0"
                    role="presentation"
                    style={{ padding: "16px 24px 0", textAlign: "center" as const }}
                  >
                    <tbody>
                      <tr>
                        <td>
                          {footer}
                          <p
                            className="dm-text-muted"
                            style={{ margin: "8px 0 0", fontSize: "12px", color: theme.textMuted }}
                          >
                            {t("Email.sentWith")}
                          </p>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </body>
    </html>
  );
}
