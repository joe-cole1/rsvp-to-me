import { APP_SHELL } from "@/lib/theme";
import ProfileDropdown, { type DropdownUser } from "@/components/ui/ProfileDropdown";

const navBase: React.CSSProperties = {
  borderBottom: `1px solid ${APP_SHELL.navBorder}`,
  padding: "16px 20px",
  display: "flex",
  alignItems: "center",
};

const fixedNavStyle: React.CSSProperties = {
  position: "fixed",
  top: 0,
  left: 0,
  right: 0,
  zIndex: 200,
  height: "53px",
  padding: "0 16px",
  background: "rgba(15,15,20,0.9)",
  backdropFilter: "blur(14px)",
  WebkitBackdropFilter: "blur(14px)",
  borderBottom: "1px solid rgba(255,255,255,0.08)",
  color: "#ffffff",
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

export function AppTopNav({
  user,
  href,
  variant = "default",
}: {
  user: DropdownUser | null;
  href?: string;
  variant?: "default" | "fixed" | "event-overlay";
}) {
  const variantStyle =
    variant === "default"
      ? undefined
      : {
          ...fixedNavStyle,
          ...(variant === "event-overlay"
            ? {
                height: "52px",
                background: "rgba(0,0,0,0.45)",
                borderBottom: "1px solid rgba(255,255,255,0.07)",
              }
            : undefined),
        };

  return (
    <AppNavLogo
      href={href ?? (user ? "/dashboard" : "/")}
      trailing={<ProfileDropdown user={user} />}
      style={variantStyle}
    />
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
