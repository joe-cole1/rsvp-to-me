"use client";

import { useMemo, useSyncExternalStore } from "react";
import {
  EFFECT_DENSITIES,
  EFFECT_SPEEDS,
  EFFECT_SIZE_MIN,
  EFFECT_SIZE_MAX,
  DEFAULT_EFFECT_SIZE,
  getEffectById,
  type EffectConfig,
} from "@/lib/effects";
import { useEffectsHidden } from "@/lib/effect-visibility";

// Partiful-style ambient motif layer: each particle is its own DOM node driven
// by GPU-composited CSS keyframes (see globals.css). No canvas, no rAF loop —
// the browser handles 10-30 animated nodes far more efficiently than a redraw
// loop, and prefers-reduced-motion hides the whole layer in CSS.

interface Particle {
  sprite: string;
  leftPct: number;
  sizePx: number;
  travelS: number;
  delayS: number;
  swayPx: number;
  swayS: number;
  spinDeg: number;
  opacity: number;
}

function buildParticles(config: EffectConfig): Particle[] {
  const set = getEffectById(config.effectId);
  if (!set) return [];
  const count = EFFECT_DENSITIES[config.density].count;
  const { minS, maxS } = EFFECT_SPEEDS[config.speed];
  const sizeMultiplier = Math.min(
    EFFECT_SIZE_MAX,
    Math.max(EFFECT_SIZE_MIN, config.size ?? DEFAULT_EFFECT_SIZE)
  );
  const rand = (min: number, max: number) => min + Math.random() * (max - min);

  return Array.from({ length: count }, (_, i) => {
    const travelS = rand(minS, maxS);
    return {
      sprite: set.sprites[i % set.sprites.length],
      leftPct: rand(-2, 100),
      sizePx: set.baseSizePx * sizeMultiplier * rand(0.6, 1.4),
      travelS,
      // Negative delay pre-populates the sky mid-animation on load
      delayS: -rand(0, travelS),
      swayPx: rand(14, 46),
      swayS: rand(2.4, 4.8),
      spinDeg: set.mode === "fall" ? rand(20, 70) : rand(4, 12),
      opacity: rand(0.7, 1),
    };
  });
}

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
  const set = getEffectById(effectId);

  // Tint colors are deliberately NOT a dependency: particles resolve their
  // color by index at render time, so a theme-color change recolors the
  // existing motifs in place instead of teleporting them to new random spots.
  const particles = useMemo<Particle[] | null>(() => {
    if (!isClient || !effectId || !density || !speed) return null;
    if (!getEffectById(effectId)) return null;
    return buildParticles({ effectId, density, speed, size } as EffectConfig);
  }, [isClient, effectId, density, speed, size]);

  const hidden = useEffectsHidden();

  if (!set || !particles || particles.length === 0) return null;

  const travelAnimation = set.mode === "fall" ? "rsvp-effect-fall" : "rsvp-effect-float";

  if (hidden) return null;

  return (
    <div
      className="rsvp-effect-layer"
      data-effect-id={set.id}
      data-effect-mode={set.mode}
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
          style={{
            position: "absolute",
            top: 0,
            left: `${p.leftPct}%`,
            animation: `${travelAnimation} ${p.travelS}s linear ${p.delayS}s infinite`,
            willChange: "transform",
          }}
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
            {set.tinted ? (
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
                  animation:
                    set.mode === "float"
                      ? `rsvp-effect-twinkle ${p.swayS * 0.8}s ease-in-out ${p.delayS}s infinite alternate`
                      : undefined,
                }}
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={p.sprite}
                alt=""
                width={p.sizePx}
                height={p.sizePx}
                style={{
                  display: "block",
                  opacity: p.opacity,
                  animation:
                    set.mode === "float"
                      ? `rsvp-effect-twinkle ${p.swayS * 0.8}s ease-in-out ${p.delayS}s infinite alternate`
                      : undefined,
                }}
              />
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
