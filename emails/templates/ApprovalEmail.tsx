import { Heading, Section, Text } from "@react-email/components";
import { EmailLayout } from "../components/EmailLayout";
import { Hero } from "../components/Hero";
import { EmailButton } from "../components/EmailButton";
import type { ApprovalEmailProps } from "../types";

export function ApprovalEmail({
  theme,
  toggles,
  eventTitle,
  approved,
  hostMessage,
  eventUrl,
}: ApprovalEmailProps) {
  return (
    <EmailLayout
      theme={theme}
      preview={
        approved ? `Your RSVP for ${eventTitle} is approved` : `About your RSVP for ${eventTitle}`
      }
    >
      <Hero
        theme={theme}
        kicker={approved ? "You're on the list" : "RSVP update"}
        title={eventTitle}
        showCoverImage={toggles.showCoverImage}
      />
      <Section className="email-content" style={{ padding: "24px 32px 30px" }}>
        <Heading
          as="h2"
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
          {approved ? "Your RSVP is approved! 🎉" : "Your RSVP was declined"}
        </Heading>
        <Text
          className="dm-text-secondary"
          style={{
            margin: "10px 0 0",
            fontSize: "15px",
            lineHeight: "24px",
            color: theme.textSecondary,
          }}
        >
          {approved
            ? `You are officially on the guest list for ${eventTitle}.`
            : `We're sorry, but the host has declined your RSVP for ${eventTitle}.`}
        </Text>

        {hostMessage ? (
          <Section
            className="dm-block"
            style={{
              backgroundColor: theme.cardBg,
              borderLeft: `3px solid ${theme.accent}`,
              borderRadius: "6px",
              padding: "12px 16px",
              margin: "18px 0 0",
            }}
          >
            <Text
              className="dm-text-secondary"
              style={{
                margin: 0,
                fontSize: "14px",
                lineHeight: "22px",
                fontStyle: "italic",
                color: theme.textSecondary,
              }}
            >
              Message from the host: “{hostMessage}”
            </Text>
          </Section>
        ) : null}

        {approved ? (
          <Section style={{ margin: "26px 0 0", textAlign: "center" as const }}>
            <EmailButton theme={theme} href={eventUrl} variant="primary">
              View event
            </EmailButton>
          </Section>
        ) : null}
      </Section>
    </EmailLayout>
  );
}
