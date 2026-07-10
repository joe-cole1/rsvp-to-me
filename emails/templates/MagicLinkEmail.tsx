import { EmailLayout } from "../components/EmailLayout";
import { Hero } from "../components/Hero";
import { EmailButton } from "../components/EmailButton";
import { splitParagraphs } from "../render";
import type { MagicLinkEmailProps } from "../types";

export function MagicLinkEmail({ theme, body, magicLink }: MagicLinkEmailProps) {
  return (
    <EmailLayout theme={theme} preview="Your sign-in link for RSVP to Me">
      <Hero theme={theme} kicker="RSVP to Me" title="Sign in" showCoverImage={false} />
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
                        Sign in
                      </EmailButton>
                    </td>
                  </tr>
                </tbody>
              </table>
              <p
                className="dm-text-muted"
                style={{ margin: "24px 0 0", fontSize: "12px", color: theme.textMuted }}
              >
                {"If you didn't request this, you can safely ignore this email."}
              </p>
            </td>
          </tr>
        </tbody>
      </table>
    </EmailLayout>
  );
}
