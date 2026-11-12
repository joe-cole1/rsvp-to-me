import type { Locale } from "@/i18n/config";
import LanguageSelector from "./LanguageSelector";
import { APP_SHELL } from "@/lib/theme";
import ProfileDropdown, { type DropdownUser } from "@/components/ui/ProfileDropdown";

const navBase: React.CSSProperties = {
  borderBottom: `1px solid ${APP_SHELL.navBorder}`,
  padding: "16px 20px",
  display: "flex",
  alignItems: "center",
};

// App chrome over event pages: one solid dark bar on every theme, so it never reads as a
// gray or tinted wash over a light page (#812).
const chromeNavStyle: React.CSSProperties = {
  position: "fixed",
  top: 0,
  left: 0,
  right: 0,
  zIndex: 200,
  height: "53px",
  padding: "0 16px",
  background: APP_SHELL.chromeSurface,
  backdropFilter: "blur(14px)",
  WebkitBackdropFilter: "blur(14px)",
  borderBottom: `1px solid ${APP_SHELL.navBorder}`,
  color: APP_SHELL.textPrimary,
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
    <nav
      style={{
        ...navBase,
        direction: "ltr",
        justifyContent: "space-between",
        gap: "12px",
        ...style,
      }}
    >
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
  onLocaleChange,
  href,
  variant = "default",
}: {
  user: DropdownUser | null;
  onLocaleChange?: (locale: Locale) => Promise<void>;
  href?: string;
  variant?: "default" | "chrome";
}) {
  const variantStyle =
    variant === "chrome"
      ? chromeNavStyle
      : { background: APP_SHELL.pageBg, color: APP_SHELL.textPrimary };

  return (
    <AppNavLogo
      href={href ?? (user ? "/dashboard" : "/")}
      trailing={
        <div style={{ display: "flex", alignItems: "center", gap: 4, height: 36 }}>
          <LanguageSelector onLocaleChange={onLocaleChange} />
          <ProfileDropdown user={user} />
        </div>
      }
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
