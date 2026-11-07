import { describe, it, expect } from "vitest";
import {
  CUSTOM_EFFECT_ID,
  DEFAULT_EFFECT_SIZE,
  EFFECT_AMOUNTS,
  EFFECT_DENSITIES,
  EFFECT_SIZE_PRESETS,
  LIBRARY_ICON_BASE_SIZE_PX,
  NEW_EFFECT_SIZE,
  effectSizePresetFor,
  getEffectById,
  getEffectPresentation,
  inheritedEffectMovement,
  initialEffectSize,
  isLibraryIconIdShape,
  isTrustedLibrarySrc,
  isValidEffectMovement,
  isValidEffectSource,
  isValidLibraryIconIdList,
  resolveEffectConfig,
  type EffectConfig,
} from "@/lib/effects";
import { buildParticles } from "@/lib/effect-particles";

// #825: custom library mixtures, independent Size, and Up/Down/Random movement.

const CAT = {
  id: "fluent-emoji-flat:cat",
  src: "/effects/library/fluent-emoji-flat/1.2.6/cat.svg",
};
const HEART = { id: "noto:red-heart", src: "/effects/library/noto/1.2.10/red-heart.svg" };
const PIZZA = {
  id: "fluent-emoji-flat:pizza",
  src: "/effects/library/fluent-emoji-flat/1.2.6/pizza.svg",
};

function seeded(seed: number) {
  let x = seed >>> 0;
  return () => {
    x = (x * 1664525 + 1013904223) >>> 0;
    return x / 2 ** 32;
  };
}

describe("library icon shape checks", () => {
  it("accepts only the two prepared collections' id format", () => {
    expect(isLibraryIconIdShape(CAT.id)).toBe(true);
    expect(isLibraryIconIdShape("noto:waving-hand-dark-skin-tone")).toBe(true);
    for (const bad of [
      "mdi:cat",
      "noto:",
      "noto:../../etc/passwd",
      "noto:Cat",
      "noto:cat.svg",
      "https://example.com/cat.svg",
      "<svg onload=alert(1)>",
      `noto:${"a".repeat(200)}`,
      42,
      null,
    ]) {
      expect(isLibraryIconIdShape(bad), String(bad)).toBe(false);
    }
  });

  it("allows one to three unique ids", () => {
    expect(isValidLibraryIconIdList([CAT.id])).toBe(true);
    expect(isValidLibraryIconIdList([CAT.id, HEART.id, PIZZA.id])).toBe(true);
    expect(isValidLibraryIconIdList([])).toBe(false);
    expect(isValidLibraryIconIdList([CAT.id, CAT.id])).toBe(false);
    expect(isValidLibraryIconIdList([CAT.id, HEART.id, PIZZA.id, "noto:cat"])).toBe(false);
    expect(isValidLibraryIconIdList("noto:cat")).toBe(false);
    // The same subject in the other style is a distinct choice
    expect(isValidLibraryIconIdList(["fluent-emoji-flat:cat", "noto:cat"])).toBe(true);
  });

  it("trusts only versioned same-origin library paths", () => {
    expect(isTrustedLibrarySrc(CAT.src)).toBe(true);
    for (const bad of [
      "https://cdn.example.com/cat.svg",
      "//evil.test/cat.svg",
      "/effects/library/noto/1.2.10/../../secret.svg",
      "/effects/library/mdi/1.0/cat.svg",
      "/api/uploads/x.svg",
      "javascript:alert(1)",
      "/effects/library/noto/1.2.10/cat.png",
    ]) {
      expect(isTrustedLibrarySrc(bad), bad).toBe(false);
    }
  });

  it("knows the reserved custom source and the three movements", () => {
    expect(isValidEffectSource(CUSTOM_EFFECT_ID)).toBe(true);
    expect(isValidEffectSource("confetti")).toBe(true);
    expect(isValidEffectSource(null)).toBe(true);
    expect(isValidEffectSource("lasers")).toBe(false);
    expect(getEffectById(CUSTOM_EFFECT_ID)).toBeNull(); // never a fake built-in set
    for (const m of ["up", "down", "random", null, undefined]) {
      expect(isValidEffectMovement(m)).toBe(true);
    }
    expect(isValidEffectMovement("sideways")).toBe(false);
  });
});

describe("Size", () => {
  it("offers Small 3×, Medium 5× and Large 7×, and a new effect starts Small", () => {
    expect(EFFECT_SIZE_PRESETS).toEqual({ small: 3, medium: 5, large: 7 });
    expect(NEW_EFFECT_SIZE).toBe(3);
  });

  it("matches a quick choice only on its exact value", () => {
    expect(effectSizePresetFor(3)).toBe("small");
    expect(effectSizePresetFor(5)).toBe("medium");
    expect(effectSizePresetFor(7)).toBe("large");
    for (const other of [1, 2, 2.5, 6, 7.5, 10, null]) {
      expect(effectSizePresetFor(other)).toBeNull();
    }
  });

  it("starts the editor from the stored size, never snapping it", () => {
    // Any stored number stays as stored, including off-step legacy values
    expect(initialEffectSize({ effectId: "snow", effectSize: 6 })).toBe(6);
    expect(initialEffectSize({ effectId: "snow", effectSize: 2.3 })).toBe(2.3);
    expect(initialEffectSize({ effectId: null, effectSize: 4 })).toBe(4);
    // An already active legacy effect with no size keeps its designed 1×
    expect(initialEffectSize({ effectId: "snow", effectSize: null })).toBe(DEFAULT_EFFECT_SIZE);
    expect(DEFAULT_EFFECT_SIZE).toBe(1);
    // An event that never had an effect starts at Small
    expect(initialEffectSize({ effectId: null, effectSize: null })).toBe(3);
    expect(initialEffectSize(null)).toBe(3);
  });

  it("resolves stored sizes exactly and null as 1×", () => {
    expect(resolveEffectConfig({ effectId: "snow", effectSize: 6 })?.size).toBe(6);
    expect(resolveEffectConfig({ effectId: "snow", effectSize: null })?.size).toBe(1);
  });
});

describe("Movement", () => {
  it("built-in sets keep their own fall/float until the host picks one", () => {
    expect(inheritedEffectMovement("snow")).toBe("down");
    expect(inheritedEffectMovement("balloons")).toBe("up");
    expect(resolveEffectConfig({ effectId: "snow" })?.movement).toBe("down");
    expect(resolveEffectConfig({ effectId: "balloons" })?.movement).toBe("up");
  });

  it("an explicit movement applies to any effect", () => {
    expect(resolveEffectConfig({ effectId: "snow", effectMovement: "up" })?.movement).toBe("up");
    expect(resolveEffectConfig({ effectId: "balloons", effectMovement: "down" })?.movement).toBe(
      "down"
    );
    expect(resolveEffectConfig({ effectId: "stars", effectMovement: "random" })?.movement).toBe(
      "random"
    );
  });

  it("a custom mixture drifts randomly by default", () => {
    const config = resolveEffectConfig({ effectId: CUSTOM_EFFECT_ID, effectIconIds: [CAT.id] }, [
      CAT,
    ]);
    expect(config?.movement).toBe("random");
  });
});

describe("custom mixture resolution", () => {
  it("resolves one, two and three icons in the host's order", () => {
    for (const icons of [[CAT], [HEART, CAT], [PIZZA, CAT, HEART]]) {
      const config = resolveEffectConfig(
        {
          effectId: CUSTOM_EFFECT_ID,
          effectIconIds: icons.map((i) => i.id),
          effectDensity: "dense",
          effectSpeed: "lively",
          effectSize: 7,
          effectMovement: "up",
        },
        [CAT, HEART, PIZZA]
      );
      expect(config).toEqual({
        effectId: CUSTOM_EFFECT_ID,
        density: "dense",
        speed: "lively",
        size: 7,
        movement: "up",
        libraryIcons: icons,
      });
    }
  });

  it("fails safe to no effect for malformed or unknown selections", () => {
    const cases = [
      { effectId: CUSTOM_EFFECT_ID, effectIconIds: [] },
      { effectId: CUSTOM_EFFECT_ID, effectIconIds: null },
      { effectId: CUSTOM_EFFECT_ID, effectIconIds: [CAT.id, CAT.id] },
      { effectId: CUSTOM_EFFECT_ID, effectIconIds: [CAT.id, HEART.id, PIZZA.id, "noto:cat"] },
      { effectId: CUSTOM_EFFECT_ID, effectIconIds: ["noto:not-a-real-icon"] },
      { effectId: CUSTOM_EFFECT_ID, effectIconIds: [CAT.id, "noto:not-a-real-icon"] },
    ];
    for (const stored of cases) {
      expect(resolveEffectConfig(stored, [CAT, HEART, PIZZA]), JSON.stringify(stored)).toBeNull();
    }
    // Without trusted descriptors there is nothing to draw
    expect(resolveEffectConfig({ effectId: CUSTOM_EFFECT_ID, effectIconIds: [CAT.id] })).toBeNull();
    // A descriptor with an untrusted URL never renders
    expect(
      resolveEffectConfig({ effectId: CUSTOM_EFFECT_ID, effectIconIds: [CAT.id] }, [
        { id: CAT.id, src: "https://cdn.example.com/cat.svg" },
      ])
    ).toBeNull();
  });

  it("ignores stored icon ids on a built-in set", () => {
    const config = resolveEffectConfig({ effectId: "snow", effectIconIds: [CAT.id] }, [CAT]);
    expect(config?.libraryIcons).toBeUndefined();
    expect(getEffectPresentation(config)?.sprites).toEqual(getEffectById("snow")!.sprites);
  });
});

describe("presentation and particles", () => {
  const custom: EffectConfig = {
    effectId: CUSTOM_EFFECT_ID,
    density: "medium",
    speed: "medium",
    size: 3,
    movement: "random",
    libraryIcons: [CAT, HEART, PIZZA],
  };

  it("library art is untinted at one common base size; built-ins keep their own look", () => {
    expect(getEffectPresentation(custom)).toEqual({
      id: CUSTOM_EFFECT_ID,
      sprites: [CAT.src, HEART.src, PIZZA.src],
      baseSizePx: LIBRARY_ICON_BASE_SIZE_PX,
      tinted: false,
      character: "float",
      twinkle: false,
    });
    expect(LIBRARY_ICON_BASE_SIZE_PX).toBe(22);
    const confetti = getEffectPresentation({
      effectId: "confetti",
      density: "medium",
      speed: "medium",
    })!;
    expect(confetti.tinted).toBe(true);
    expect(confetti.baseSizePx).toBe(getEffectById("confetti")!.baseSizePx);
  });

  it("Amount changes the particle count only", () => {
    const presentation = getEffectPresentation(custom)!;
    for (const [amount, density] of Object.entries(EFFECT_AMOUNTS)) {
      const particles = buildParticles({ ...custom, density }, presentation, seeded(7));
      expect(particles.length, amount).toBe(EFFECT_DENSITIES[density].count);
      for (const p of particles) {
        expect(p.sizePx).toBeGreaterThanOrEqual(22 * 3 * 0.6);
        expect(p.sizePx).toBeLessThanOrEqual(22 * 3 * 1.4);
      }
    }
  });

  it("Size scales sprites around the nominal size", () => {
    const presentation = getEffectPresentation(custom)!;
    for (const size of [1, 3, 5, 7, 10]) {
      for (const p of buildParticles({ ...custom, size }, presentation, seeded(3))) {
        expect(p.sizePx).toBeGreaterThanOrEqual(22 * size * 0.6);
        expect(p.sizePx).toBeLessThanOrEqual(22 * size * 1.4);
      }
    }
  });

  it("cycles the selected icons evenly in the host's order", () => {
    const presentation = getEffectPresentation(custom)!;
    const particles = buildParticles({ ...custom, density: "medium" }, presentation, seeded(1));
    const counts = new Map<string, number>();
    for (const p of particles) counts.set(p.sprite, (counts.get(p.sprite) ?? 0) + 1);
    expect([...counts.values()]).toEqual([6, 6, 6]);
    expect(particles.slice(0, 3).map((p) => p.sprite)).toEqual([CAT.src, HEART.src, PIZZA.src]);
  });

  it("Down falls from the top and Up rises from the bottom in fixed columns", () => {
    const presentation = getEffectPresentation(custom)!;
    for (const p of buildParticles({ ...custom, movement: "down" }, presentation, seeded(2))) {
      expect(p.edge).toBe("top");
      expect(p.fromX).toBe(p.toX);
      expect(p.fromY).toMatch(/^calc\(-1 \* /);
      expect(p.toY).toMatch(/^calc\(100vh \+ /);
    }
    for (const p of buildParticles({ ...custom, movement: "up" }, presentation, seeded(2))) {
      expect(p.edge).toBe("bottom");
      expect(p.fromY).toMatch(/^calc\(100vh \+ /);
      expect(p.toY).toMatch(/^calc\(-1 \* /);
    }
  });

  it("Random sends particles along different paths, sideways and diagonal included", () => {
    const presentation = getEffectPresentation(custom)!;
    const particles = buildParticles(
      { ...custom, density: "dense", movement: "random" },
      presentation,
      seeded(11)
    );
    const edges = new Set(particles.map((p) => p.edge));
    // Several start edges — not one shared direction for the whole layer
    expect(edges.size).toBeGreaterThanOrEqual(3);
    expect([...edges].some((e) => e === "left" || e === "right")).toBe(true);
    // Paths cross to the opposite edge at a different point, so most are diagonal
    const diagonal = particles.filter((p) =>
      p.edge === "top" || p.edge === "bottom" ? p.fromX !== p.toX : p.fromY !== p.toY
    );
    expect(diagonal.length).toBeGreaterThan(particles.length / 2);
    // Delays are negative so the layer is populated at once
    expect(particles.every((p) => p.delayS <= 0)).toBe(true);
  });

  it("pushes large sprites far enough off-screen that loop restarts stay hidden", () => {
    const presentation = getEffectPresentation({ ...custom, size: 10 })!;
    for (const p of buildParticles(
      { ...custom, size: 10, movement: "down" },
      presentation,
      seeded(5)
    )) {
      const px = Number(/max\(12vh, (\d+)px\)/.exec(p.fromY)![1]);
      expect(px).toBeGreaterThan(p.sizePx * 1.5);
    }
  });
});
