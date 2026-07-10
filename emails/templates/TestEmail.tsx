import { EmailLayout } from "../components/EmailLayout";
import { Hero } from "../components/Hero";
import { splitParagraphs } from "../render";
import type { TestEmailProps } from "../types";

export function TestEmail({ theme, body }: TestEmailProps) {
  return (
    <EmailLayout theme={theme} preview="Test email from RSVP to Me">
      <Hero theme={theme} kicker="RSVP to Me" title="It works! ✨" showCoverImage={false} />
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
            </td>
          </tr>
        </tbody>
      </table>
    </EmailLayout>
  );
}
