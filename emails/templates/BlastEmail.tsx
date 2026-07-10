import { EmailLayout } from "../components/EmailLayout";
import { Hero } from "../components/Hero";
import { HostFlourish } from "../components/HostFlourish";
import { splitParagraphs } from "../render";
import type { BlastEmailProps } from "../types";

/** Host update blast — also used for event updates and all cron reminders. */
export function BlastEmail({
  theme,
  toggles,
  eventTitle,
  hostName,
  message,
  eventUrl,
}: BlastEmailProps) {
  return (
    <EmailLayout theme={theme} preview={`Update from ${hostName} about ${eventTitle}`}>
      <Hero
        theme={theme}
        kicker={`Update from ${hostName}`}
        title={eventTitle}
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
              {splitParagraphs(message).map((paragraph, i) => (
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

              {toggles.showHostFlourish ? <HostFlourish theme={theme} hostName={hostName} /> : null}

              <p style={{ margin: "24px 0 0" }}>
                <a
                  href={eventUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: theme.accent, fontSize: "14px" }}
                >
                  View event →
                </a>
              </p>
            </td>
          </tr>
        </tbody>
      </table>
    </EmailLayout>
  );
}
