import type { ResolvedTheme } from "@/lib/theme";

export function ThemeBackground({ theme: t }: { theme: ResolvedTheme }) {
  return (
    <>
      {t.pageDecoration === "dark-orbs" && (
        <>
          <div
            aria-hidden="true"
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
            aria-hidden="true"
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
            aria-hidden="true"
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
            aria-hidden="true"
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
          aria-hidden="true"
          style={{
            position: "fixed",
            inset: 0,
            background: t.pageDecorationBg1,
            zIndex: 0,
          }}
        />
      )}
      {t.decorationVariant && (
        <div aria-hidden="true" data-decoration-variant={t.decorationVariant} hidden />
      )}
    </>
  );
}
