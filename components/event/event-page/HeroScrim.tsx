import type { CSSProperties, ReactNode } from "react";

/**
 * Wraps the event hero (title, byline, cover and date), the text that sits
 * straight on the page ground. When the theme sets `heroScrim`, one soft dark
 * wash is drawn behind the whole band so white text keeps its contrast on a
 * mid-tone gradient. The wash reaches past the text and feathers out at its
 * edges, so the text itself always sits on the full wash.
 *
 * No stacking context is created: the wash and the content are positioned
 * siblings painted in order, so popovers inside keep their page-level z-index.
 */
export function HeroScrim({
  scrim,
  children,
  style,
}: {
  scrim?: string;
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <div style={{ position: "relative", ...style }}>
      {scrim && (
        <div
          aria-hidden="true"
          data-hero-scrim
          style={{
            position: "absolute",
            inset: "-24px -16px 0",
            background: scrim,
            borderRadius: "24px",
            filter: "blur(8px)",
            pointerEvents: "none",
          }}
        />
      )}
      <div style={{ position: "relative" }}>{children}</div>
    </div>
  );
}
