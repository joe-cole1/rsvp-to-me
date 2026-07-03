import { Section, Text } from "@react-email/components";
import { EmailLayout } from "../components/EmailLayout";
import { Hero } from "../components/Hero";
import { EmailButton } from "../components/EmailButton";
import { splitParagraphs } from "../render";
import type { WelcomeEmailProps } from "../types";

export function WelcomeEmail({ theme, body, magicLink }: WelcomeEmailProps) {
  return (
    <EmailLayout theme={theme} preview="Welcome to RSVP to Me">
      <Hero theme={theme} kicker="RSVP to Me" title="Welcome!" showCoverImage={false} />
      <Section className="email-content" style={{ padding: "24px 32px 30px" }}>
        {splitParagraphs(body).map((paragraph, i) => (
          <Text
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
          </Text>
        ))}
        <Section style={{ margin: "24px 0 0", textAlign: "center" as const }}>
          <EmailButton theme={theme} href={magicLink} variant="primary">
            Sign in
          </EmailButton>
        </Section>
        <Text
          className="dm-text-muted"
          style={{ margin: "24px 0 0", fontSize: "12px", color: theme.textMuted }}
        >
          If you weren't expecting this, you can safely ignore this email.
        </Text>
      </Section>
    </EmailLayout>
  );
}
