import { Heading, Img, Section, Text } from "@react-email/components";
import type { EmailTheme } from "@/lib/email-theme";

/**
 * Themed banner: the event's gradient (with a solid background-color fallback
 * for clients that drop background-image, per the degradation contract) and
 * optionally the event cover image above the title.
 */
export function Hero({
  theme,
  title,
  subtitle,
  kicker,
  showCoverImage = true,
}: {
  theme: EmailTheme;
  title: string;
  subtitle?: string;
  kicker?: string;
  showCoverImage?: boolean;
}) {
  const coverUrl = showCoverImage ? theme.coverImageUrl : undefined;
  return (
    <Section
      style={{
        backgroundColor: theme.heroFallback,
        backgroundImage: theme.heroGradient,
        backgroundSize: "cover",
      }}
    >
      {coverUrl ? (
        <Img
          src={coverUrl}
          alt=""
          width="600"
          style={{ width: "100%", maxHeight: "260px", objectFit: "cover", display: "block" }}
        />
      ) : null}
      <Section className="email-hero" style={{ padding: "28px 32px 26px" }}>
        {kicker ? (
          <Text
            style={{
              margin: "0 0 6px",
              fontSize: "13px",
              fontWeight: "600",
              letterSpacing: "1px",
              textTransform: "uppercase" as const,
              color: theme.heroText,
              opacity: 0.85,
            }}
          >
            {kicker}
          </Text>
        ) : null}
        <Heading
          as="h1"
          style={{
            margin: 0,
            fontFamily: theme.headingFont,
            fontWeight: theme.headingWeight,
            textTransform: theme.headingTransform as "uppercase" | "none",
            fontSize: "28px",
            lineHeight: "34px",
            color: theme.heroText,
            textShadow: theme.heroTextShadow,
          }}
        >
          {title}
        </Heading>
        {subtitle ? (
          <Text
            style={{
              margin: "8px 0 0",
              fontSize: "15px",
              color: theme.heroText,
              opacity: 0.9,
            }}
          >
            {subtitle}
          </Text>
        ) : null}
      </Section>
    </Section>
  );
}
