import type { EmailTheme } from "@/lib/email-theme";

/** "Hosted by" attribution with the themed avatar-gradient monogram. */
export function HostFlourish({ theme, hostName }: { theme: EmailTheme; hostName: string }) {
  const initial = (hostName.trim()[0] || "?").toUpperCase();
  return (
    <table
      align="center"
      width="100%"
      border={0}
      cellPadding="0"
      cellSpacing="0"
      role="presentation"
      style={{ margin: "18px 0 0" }}
    >
      <tbody>
        <tr>
          <td style={{ width: "48px", verticalAlign: "middle" }}>
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
              <p
                style={{
                  margin: 0,
                  fontSize: "17px",
                  fontWeight: "700",
                  lineHeight: "40px",
                  color: theme.avatarText,
                }}
              >
                {initial}
              </p>
            </div>
          </td>
          <td style={{ verticalAlign: "middle" }}>
            <p
              className="dm-text-muted"
              style={{ margin: 0, fontSize: "12px", color: theme.textMuted }}
            >
              Hosted by
            </p>
            <p
              className="dm-text-primary"
              style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: theme.textPrimary }}
            >
              {hostName}
            </p>
          </td>
        </tr>
      </tbody>
    </table>
  );
}
