import { Link, Section, Text } from "@react-email/components";
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
      <Section className="email-content" style={{ padding: "24px 32px 30px" }}>
        {splitParagraphs(message).map((paragraph, i) => (
          <Text
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
          </Text>
        ))}

        {toggles.showHostFlourish ? <HostFlourish theme={theme} hostName={hostName} /> : null}

        <Text style={{ margin: "24px 0 0" }}>
          <Link href={eventUrl} style={{ color: theme.accent, fontSize: "14px" }}>
            View event →
          </Link>
        </Text>
      </Section>
    </EmailLayout>
  );
}
