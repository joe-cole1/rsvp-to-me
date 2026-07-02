"use client";

import type { ResolvedTheme } from "@/lib/theme";

export function BackgroundDecorations({ t }: { t: ResolvedTheme }) {
  return (
    <>
      {/* Background decorations */}
      {t.pageDecoration === "dark-orbs" && (
        <>
          <div
            style={{
              position: "fixed",
              top: "-20%",
              left: "30%",
              width: "600px",
              height: "600px",
              borderRadius: "50%",
              background: t.pageDecorationBg1,
              filter: "blur(40px)",
              pointerEvents: "none",
              zIndex: 0,
            }}
          />
          <div
            style={{
              position: "fixed",
              bottom: "10%",
              right: "-10%",
              width: "400px",
              height: "400px",
              borderRadius: "50%",
              background: t.pageDecorationBg2,
              filter: "blur(40px)",
              pointerEvents: "none",
              zIndex: 0,
            }}
          />
        </>
      )}
      {t.pageDecoration === "soft-blobs" && (
        <>
          <div
            style={{
              position: "fixed",
              top: "-10%",
              right: "-10%",
              width: "500px",
              height: "500px",
              borderRadius: "50%",
              background: t.pageDecorationBg1,
              filter: "blur(60px)",
              pointerEvents: "none",
              zIndex: 0,
            }}
          />
          <div
            style={{
              position: "fixed",
              bottom: "20%",
              left: "-5%",
              width: "400px",
              height: "400px",
              borderRadius: "50%",
              background: t.pageDecorationBg2,
              filter: "blur(60px)",
              pointerEvents: "none",
              zIndex: 0,
            }}
          />
        </>
      )}
      {t.pageDecoration === "bold-hero" && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: t.pageDecorationBg1,
            zIndex: 0,
          }}
        />
      )}
      {t.decorationVariant && (
        <div data-decoration-variant={t.decorationVariant} style={{ display: "none" }} />
      )}
    </>
  );
}
