import { APP_SHELL } from "@/lib/theme";

const navBase: React.CSSProperties = {
  borderBottom: `1px solid ${APP_SHELL.navBorder}`,
  padding: "16px 20px",
  display: "flex",
  alignItems: "center",
};

export function AppNavLogo({
  href = "/",
  leading,
  trailing,
  style,
}: {
  href?: string;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <nav style={{ ...navBase, justifyContent: "space-between", gap: "12px", ...style }}>
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        {leading}
        <a
          href={href}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            textDecoration: "none",
            color: "inherit",
          }}
        >
          <span style={{ fontSize: "22px" }}>🎉</span>
          <span style={{ fontSize: "17px", fontWeight: 800 }}>RSVP</span>
        </a>
      </div>
      {trailing}
    </nav>
  );
}

export function AppNavBack({ href, title }: { href: string; title: string }) {
  return (
    <nav style={{ ...navBase, gap: "12px" }}>
      <a
        href={href}
        style={{ color: APP_SHELL.textSecondary, textDecoration: "none", fontSize: "22px" }}
      >
        ←
      </a>
      <h1 style={{ fontSize: "17px", fontWeight: 700 }}>{title}</h1>
    </nav>
  );
}
