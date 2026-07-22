import type { EffectConfig } from "@/lib/effects";
import type { ResolvedTheme } from "@/lib/theme";
import { ParticleLayer } from "./event-page/ParticleLayer";
import { ThemeBackground } from "./ThemeBackground";

export function EventAtmosphere({
  theme,
  effect = null,
}: {
  theme: ResolvedTheme;
  effect?: EffectConfig | null;
}) {
  return (
    <>
      <ThemeBackground theme={theme} />
      <ParticleLayer
        config={effect}
        tintColors={[theme.accent, theme.gradientFrom, theme.gradientTo, "#ffffff"]}
      />
    </>
  );
}
