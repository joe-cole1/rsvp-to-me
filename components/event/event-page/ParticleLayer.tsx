"use client";

import { useMemo, useSyncExternalStore } from "react";
import {
  DEFAULT_EFFECT_SIZE,
  getEffectPresentation,
  inheritedEffectMovement,
  type EffectConfig,
} from "@/lib/effects";
import { buildParticles, type Particle } from "@/lib/effect-particles";
import { useEffectsHidden } from "@/lib/effect-visibility";

// Partiful-style ambient motif layer: each particle is its own DOM node driven
// by GPU-composited CSS keyframes (see globals.css). No canvas, no rAF loop —
// the browser handles 10-30 animated nodes far more efficiently than a redraw
// loop, and prefers-reduced-motion hides the whole layer in CSS.
//
// The layer draws either a built-in set or a custom mixture of library icons
// (#825). Library sprites arrive as already-trusted same-origin paths from
// the server-only catalog; this component never looks icons up itself.

const emptySubscribe = () => () => {};

export function ParticleLayer({
  config,
  tintColors,
}: {
  config: EffectConfig | null;
  /** Theme-derived palette for tinted sets (accent + gradient stops) */
  tintColors: string[];
}) {
  // Particles are randomized, so build them only on the client — the server
  // (and the hydration pass) renders nothing, so markup never mismatches.
  const isClient = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
  const effectId = config?.effectId ?? null;
  const density = config?.density ?? null;
  const speed = config?.speed ?? null;
  const size = config?.size ?? DEFAULT_EFFECT_SIZE;
  const movement = config?.movement ?? inheritedEffectMovement(effectId);
  const iconKey = (config?.libraryIcons ?? []).map((icon) => `${icon.id}=${icon.src}`).join("|");

  // Rebuild only when what the particles ARE changes. Tint colors are
  // deliberately NOT a dependency: particles resolve their color by index at
  // render time, so a theme-color change recolors the existing motifs in place
  // instead of teleporting them to new random spots.
  const built = useMemo(() => {
    if (!isClient || !effectId || !density || !speed) return null;
    const libraryIcons = iconKey
      ? iconKey.split("|").map((pair) => {
          const [id, src] = pair.split("=");
          return { id, src };
        })
      : undefined;
    const resolved: EffectConfig = { effectId, density, speed, size, movement, libraryIcons };
    const presentation = getEffectPresentation(resolved);
    if (!presentation) return null;
    return { presentation, particles: buildParticles(resolved, presentation) };
  }, [isClient, effectId, density, speed, size, movement, iconKey]);

  const hidden = useEffectsHidden();

  if (!built || built.particles.length === 0 || hidden) return null;
  const { presentation, particles } = built;
  const twinkle = (p: Particle) =>
    presentation.twinkle
      ? `rsvp-effect-twinkle ${p.swayS * 0.8}s ease-in-out ${p.delayS}s infinite alternate`
      : undefined;

  return (
    <div
      className="rsvp-effect-layer"
      data-effect-id={presentation.id}
      data-effect-mode={presentation.character}
      data-effect-movement={movement}
      aria-hidden="true"
      style={{
        position: "fixed",
        inset: 0,
        overflow: "hidden",
        pointerEvents: "none",
        zIndex: 0,
      }}
    >
      {particles.map((p, i) => (
        <div
          key={i}
          data-effect-edge={p.edge}
          style={
            {
              position: "absolute",
              top: 0,
              left: 0,
              "--from-x": p.fromX,
              "--from-y": p.fromY,
              "--to-x": p.toX,
              "--to-y": p.toY,
              animation: `rsvp-effect-path ${p.travelS}s linear ${p.delayS}s infinite`,
              willChange: "transform",
            } as React.CSSProperties
          }
        >
          <div
            style={
              {
                "--sway": `${p.swayPx}px`,
                "--spin": `${p.spinDeg}deg`,
                animation: `rsvp-effect-sway ${p.swayS}s ease-in-out ${p.delayS}s infinite alternate`,
              } as React.CSSProperties
            }
          >
            {presentation.tinted ? (
              <span
                style={{
                  display: "block",
                  width: `${p.sizePx}px`,
                  height: `${p.sizePx}px`,
                  backgroundColor: tintColors[i % tintColors.length],
                  WebkitMaskImage: `url(${p.sprite})`,
                  maskImage: `url(${p.sprite})`,
                  WebkitMaskRepeat: "no-repeat",
                  maskRepeat: "no-repeat",
                  WebkitMaskSize: "contain",
                  maskSize: "contain",
                  opacity: p.opacity,
                  animation: twinkle(p),
                }}
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={p.sprite}
                alt=""
                width={p.sizePx}
                height={p.sizePx}
                decoding="async"
                style={{
                  display: "block",
                  width: `${p.sizePx}px`,
                  height: `${p.sizePx}px`,
                  // Library art uses two source view boxes; contain keeps
                  // each icon's own aspect ratio inside the square box.
                  objectFit: "contain",
                  opacity: p.opacity,
                  animation: twinkle(p),
                }}
              />
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
