import { Heading, Section, Text } from "@react-email/components";
import { EmailLayout } from "../components/EmailLayout";
import { Hero } from "../components/Hero";
import { EmailButton } from "../components/EmailButton";
import type { HostRsvpAlertEmailProps } from "../types";

/** Compact host-facing alert for a new guest RSVP with the live headcount. */
export function HostRsvpAlertEmail({
  theme,
  guestName,
  statusLabel,
  plusOneCount,
  note,
  eventTitle,
  goingCount,
  maybeCount,
  noCount,
  guestListUrl,
}: HostRsvpAlertEmailProps) {
  const plusStr = plusOneCount > 0 ? ` +${plusOneCount}` : "";
  return (
    <EmailLayout theme={theme} preview={`${guestName} is ${statusLabel} — ${eventTitle}`}>
      <Hero theme={theme} kicker="New RSVP" title={eventTitle} showCoverImage={false} />
      <Section className="email-content" style={{ padding: "24px 32px 30px" }}>
        <Heading
          as="h2"
          className="dm-text-primary"
          style={{ margin: 0, fontSize: "18px", fontWeight: "700", color: theme.textPrimary }}
        >
          {guestName}
          {plusStr} — {statusLabel}
        </Heading>

        {note?.trim() ? (
          <Section
            className="dm-block"
            style={{
              backgroundColor: theme.cardBg,
              borderLeft: `3px solid ${theme.accent}`,
              borderRadius: "6px",
              padding: "10px 14px",
              margin: "14px 0 0",
            }}
          >
            <Text
              className="dm-text-secondary"
              style={{
                margin: 0,
                fontSize: "14px",
                lineHeight: "22px",
                color: theme.textSecondary,
              }}
            >
              “{note.trim()}”
            </Text>
          </Section>
        ) : null}

        <Text
          className="dm-text-muted"
          style={{ margin: "16px 0 0", fontSize: "13px", color: theme.textMuted }}
        >
          Current headcount: {goingCount} going · {maybeCount} maybe · {noCount}
          {" can't go"}
        </Text>

        <Section style={{ margin: "22px 0 0" }}>
          <EmailButton theme={theme} href={guestListUrl} variant="primary">
            View guest list
          </EmailButton>
        </Section>
      </Section>
    </EmailLayout>
  );
}
