import { APP_SHELL } from "@/lib/theme";

const navBase: React.CSSProperties = {
  borderBottom: `1px solid ${APP_SHELL.navBorder}`,
  padding: "16px 20px",
  display: "flex",
  alignItems: "center",
};

export function AppNavLogo({ trailing }: { trailing?: React.ReactNode }) {
  return (
    <nav style={{ ...navBase, justifyContent: "space-between" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <span style={{ fontSize: "22px" }}>🎉</span>
        <span style={{ fontSize: "17px", fontWeight: 800 }}>rsvp.to</span>
      </div>
      {trailing}
    </nav>
  );
}

export function AppNavBack({ href, title }: { href: string; title: string }) {
  return (
    <nav style={{ ...navBase, gap: "12px" }}>
      <a href={href} style={{ color: APP_SHELL.textSecondary, textDecoration: "none", fontSize: "22px" }}>
        ←
      </a>
      <h1 style={{ fontSize: "17px", fontWeight: 700 }}>{title}</h1>
    </nav>
  );
}
