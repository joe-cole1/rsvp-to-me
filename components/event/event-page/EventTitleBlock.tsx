import type { CSSProperties, ReactNode } from "react";
import type { ResolvedTheme } from "@/lib/theme";
import { HeroScrim } from "./HeroScrim";

/**
 * The event title as it sits on the page ground: the theme's heading font in `heroText`
 * with `heroTextShadow`. The event hero and the routes that repeat the title (the guest
 * list) share it, so the event reads the same on every route (design language, Event hero).
 */
export function heroTitleStyle(t: ResolvedTheme): CSSProperties {
  return {
    fontSize: "36px",
    fontWeight: 900,
    letterSpacing: "-0.02em",
    fontFamily: t.headingFont,
    color: t.heroText,
    textShadow: t.heroTextShadow,
    margin: 0,
    textAlign: "center",
    overflowWrap: "anywhere",
  };
}

/** The title and one line under it (`heroTextSecondary`), inside the hero's scrim. */
export function EventTitleBlock({
  theme: t,
  title,
  subtitle,
}: {
  theme: ResolvedTheme;
  title: string;
  subtitle?: ReactNode;
}) {
  return (
    <HeroScrim scrim={t.heroScrim}>
      <h1 style={heroTitleStyle(t)}>{title}</h1>
      {subtitle && (
        <p
          style={{
            margin: "8px 0 0",
            textAlign: "center",
            color: t.heroTextSecondary,
            textShadow: t.heroTextShadow,
            fontSize: "14px",
          }}
        >
          {subtitle}
        </p>
      )}
    </HeroScrim>
  );
}
