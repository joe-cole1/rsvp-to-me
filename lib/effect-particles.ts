// Pure particle builder for the shared effect layer (ParticleLayer).
//
// Every particle travels from one CSS translate point to another through the
// single `rsvp-effect-path` keyframe in app/globals.css, driven by per-particle
// custom properties. Up/Down keep a fixed column; Random (#825) gives each
// particle its own path from a random edge to a random point on the opposite
// edge, so the layer drifts sideways and diagonally as well as vertically.
//
// Kept separate from the component so tests can inject a seeded random source.

import {
  DEFAULT_EFFECT_SIZE,
  EFFECT_DENSITIES,
  EFFECT_SIZE_MAX,
  EFFECT_SIZE_MIN,
  EFFECT_SPEEDS,
  inheritedEffectMovement,
  type EffectConfig,
  type EffectMovement,
  type EffectPresentation,
} from "./effects";

export type ParticleEdge = "top" | "right" | "bottom" | "left";

export interface Particle {
  sprite: string;
  sizePx: number;
  travelS: number;
  delayS: number;
  swayPx: number;
  swayS: number;
  spinDeg: number;
  opacity: number;
  /** Where the path starts (and so which way the particle travels) */
  edge: ParticleEdge;
  fromX: string;
  fromY: string;
  toX: string;
  toY: string;
}

const OPPOSITE: Record<ParticleEdge, ParticleEdge> = {
  top: "bottom",
  bottom: "top",
  left: "right",
  right: "left",
};
const EDGES: ParticleEdge[] = ["top", "right", "bottom", "left"];

/**
 * A point on an edge, `along` percent of the way across it, pushed far enough
 * off-screen that a particle (plus its sway and rotation) is fully hidden when
 * its loop restarts — even a 10× sprite.
 */
function edgePoint(edge: ParticleEdge, along: number, overscan: string): [string, string] {
  switch (edge) {
    case "top":
      return [`${along}vw`, `calc(-1 * ${overscan})`];
    case "bottom":
      return [`${along}vw`, `calc(100vh + ${overscan})`];
    case "left":
      return [`calc(-1 * ${overscan})`, `${along}vh`];
    case "right":
      return [`calc(100vw + ${overscan})`, `${along}vh`];
  }
}

export function buildParticles(
  config: EffectConfig,
  presentation: EffectPresentation,
  random: () => number = Math.random
): Particle[] {
  if (presentation.sprites.length === 0) return [];
  const count = EFFECT_DENSITIES[config.density].count;
  const { minS, maxS } = EFFECT_SPEEDS[config.speed];
  const sizeMultiplier = Math.min(
    EFFECT_SIZE_MAX,
    Math.max(EFFECT_SIZE_MIN, config.size ?? DEFAULT_EFFECT_SIZE)
  );
  const movement: EffectMovement = config.movement ?? inheritedEffectMovement(config.effectId);
  const rand = (min: number, max: number) => min + random() * (max - min);

  return Array.from({ length: count }, (_, i) => {
    const travelS = rand(minS, maxS);
    const sizePx = presentation.baseSizePx * sizeMultiplier * rand(0.6, 1.4);
    const swayPx = rand(14, 46);
    // The original layer used ±12vh; large sprites need more than that.
    const overscan = `max(12vh, ${Math.ceil(sizePx * 1.5 + swayPx + 8)}px)`;

    let edge: ParticleEdge;
    let from: [string, string];
    let to: [string, string];
    if (movement === "random") {
      edge = EDGES[Math.min(EDGES.length - 1, Math.floor(random() * EDGES.length))];
      from = edgePoint(edge, rand(0, 100), overscan);
      to = edgePoint(OPPOSITE[edge], rand(0, 100), overscan);
    } else {
      edge = movement === "down" ? "top" : "bottom";
      const column = rand(-2, 100);
      from = edgePoint(edge, column, overscan);
      to = edgePoint(OPPOSITE[edge], column, overscan);
    }

    return {
      sprite: presentation.sprites[i % presentation.sprites.length],
      sizePx,
      travelS,
      // Negative delay pre-populates the sky mid-animation on load
      delayS: -rand(0, travelS),
      swayPx,
      swayS: rand(2.4, 4.8),
      spinDeg: presentation.character === "fall" ? rand(20, 70) : rand(4, 12),
      opacity: rand(0.7, 1),
      edge,
      fromX: from[0],
      fromY: from[1],
      toX: to[0],
      toY: to[1],
    };
  });
}
