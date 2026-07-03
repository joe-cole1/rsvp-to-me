import { Body, Container, Head, Html, Preview, Section, Text } from "@react-email/components";
import type { EmailTheme } from "@/lib/email-theme";
import type * as React from "react";

// Progressive dark-mode enhancement: honored by Apple Mail / Outlook / Samsung,
// ignored by Gmail (which applies its own inversion to the light canvas — an
// acceptable degradation per the design decision "light canvas + themed accents").
// The mobile query stacks padding down for ≤480px viewports.
const responsiveStyles = `
  @media only screen and (max-width: 480px) {
    .email-content { padding-left: 20px !important; padding-right: 20px !important; }
    .email-hero { padding-left: 20px !important; padding-right: 20px !important; }
  }
  @media (prefers-color-scheme: dark) {
    .email-canvas { background-color: #17171a !important; }
    .email-card { background-color: #222226 !important; }
    .dm-text-primary { color: #f4f4f5 !important; }
    .dm-text-secondary { color: #b3b3bc !important; }
    .dm-text-muted { color: #8b8b94 !important; }
    .dm-block { background-color: #2a2a30 !important; border-color: #3d3d46 !important; }
  }
`;

export function EmailLayout({
  theme,
  preview,
  footer,
  children,
}: {
  theme: EmailTheme;
  preview: string;
  footer?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Html lang="en">
      <Head>
        <meta name="color-scheme" content="light dark" />
        <meta name="supported-color-schemes" content="light dark" />
        <style>{responsiveStyles}</style>
      </Head>
      <Preview>{preview}</Preview>
      <Body
        className="email-canvas"
        style={{
          margin: 0,
          padding: 0,
          backgroundColor: theme.canvasBg,
          fontFamily: theme.bodyFont,
        }}
      >
        <Container style={{ maxWidth: "600px", margin: "0 auto", padding: "24px 12px" }}>
          <Section
            className="email-card"
            style={{
              backgroundColor: theme.bodyBg,
              borderRadius: "16px",
              overflow: "hidden",
              border: `1px solid ${theme.cardBorder}`,
            }}
          >
            {children}
          </Section>
          <Section style={{ padding: "16px 24px 0", textAlign: "center" as const }}>
            {footer}
            <Text
              className="dm-text-muted"
              style={{ margin: "8px 0 0", fontSize: "12px", color: theme.textMuted }}
            >
              Sent with RSVP to Me
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
