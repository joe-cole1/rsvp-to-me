import { Column, Row, Text } from "@react-email/components";
import type { EmailTheme } from "@/lib/email-theme";

/** "Hosted by" attribution with the themed avatar-gradient monogram. */
export function HostFlourish({ theme, hostName }: { theme: EmailTheme; hostName: string }) {
  const initial = (hostName.trim()[0] || "?").toUpperCase();
  return (
    <Row style={{ margin: "18px 0 0" }}>
      <Column style={{ width: "48px", verticalAlign: "middle" }}>
        <div
          style={{
            width: "40px",
            height: "40px",
            borderRadius: "999px",
            backgroundColor: theme.avatarFallback,
            backgroundImage: theme.avatarGradient,
            textAlign: "center" as const,
          }}
        >
          <Text
            style={{
              margin: 0,
              fontSize: "17px",
              fontWeight: "700",
              lineHeight: "40px",
              color: theme.avatarText,
            }}
          >
            {initial}
          </Text>
        </div>
      </Column>
      <Column style={{ verticalAlign: "middle" }}>
        <Text
          className="dm-text-muted"
          style={{ margin: 0, fontSize: "12px", color: theme.textMuted }}
        >
          Hosted by
        </Text>
        <Text
          className="dm-text-primary"
          style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: theme.textPrimary }}
        >
          {hostName}
        </Text>
      </Column>
    </Row>
  );
}
