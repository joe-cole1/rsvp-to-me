// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { act, render } from "@/tests/components/render";
import React from "react";
import { ParticleLayer } from "@/components/event/event-page/ParticleLayer";
import { EFFECT_DENSITIES, getEffectById } from "@/lib/effects";
import { setEffectsHidden } from "@/lib/effect-visibility";

const TINT = ["#a855f7", "#7c3aed", "#1e40af", "#ffffff"];

describe("ParticleLayer", () => {
  beforeEach(() => {
    window.localStorage.removeItem("rsvp:hide-effects");
  });
  it("renders nothing when no effect is configured", () => {
    const { container } = render(<ParticleLayer config={null} tintColors={TINT} />);
    expect(container.querySelector(".rsvp-effect-layer")).toBeNull();
  });

  it("renders nothing for an unknown effect id", () => {
    const { container } = render(
      <ParticleLayer
        config={{ effectId: "lasers", density: "medium", speed: "medium" }}
        tintColors={TINT}
      />
    );
    expect(container.querySelector(".rsvp-effect-layer")).toBeNull();
  });

  it("renders the configured particle count with fall mode for autumn leaves", () => {
    const { container } = render(
      <ParticleLayer
        config={{ effectId: "autumn-leaves", density: "sparse", speed: "gentle" }}
        tintColors={TINT}
      />
    );
    const layer = container.querySelector(".rsvp-effect-layer");
    expect(layer).not.toBeNull();
    expect(layer!.getAttribute("data-effect-mode")).toBe("fall");
    expect(layer!.getAttribute("aria-hidden")).toBe("true");
    const imgs = layer!.querySelectorAll("img");
    expect(imgs.length).toBe(EFFECT_DENSITIES.sparse.count);
    // Untinted set renders <img> sprites from the set's own files
    const set = getEffectById("autumn-leaves")!;
    for (const img of imgs) {
      expect(set.sprites).toContain(img.getAttribute("src"));
      expect(img.getAttribute("alt")).toBe("");
    }
  });

  it("renders tinted sets as masked spans colored from the theme palette", () => {
    const { container } = render(
      <ParticleLayer
        config={{ effectId: "confetti", density: "dense", speed: "lively" }}
        tintColors={TINT}
      />
    );
    const layer = container.querySelector(".rsvp-effect-layer")!;
    expect(layer.querySelectorAll("img").length).toBe(0);
    const spans = layer.querySelectorAll("span");
    expect(spans.length).toBe(EFFECT_DENSITIES.dense.count);
    for (const span of spans) {
      expect(span.style.backgroundColor).not.toBe("");
    }
  });

  it("recolors tinted particles in place when theme colors change (no teleporting)", () => {
    const { container, rerender } = render(
      <ParticleLayer
        config={{ effectId: "confetti", density: "sparse", speed: "medium" }}
        tintColors={TINT}
      />
    );
    const positionsBefore = [...container.querySelectorAll(".rsvp-effect-layer > div")].map((el) =>
      ["--from-x", "--from-y", "--to-x", "--to-y"]
        .map((k) => (el as HTMLElement).style.getPropertyValue(k))
        .join(" ")
    );
    expect(positionsBefore.every((p) => p.trim().length > 0)).toBe(true);
    const colorBefore = container.querySelector("span")!.style.backgroundColor;

    rerender(
      <ParticleLayer
        config={{ effectId: "confetti", density: "sparse", speed: "medium" }}
        tintColors={["#16a34a", "#166534", "#facc15", "#ffffff"]}
      />
    );
    const positionsAfter = [...container.querySelectorAll(".rsvp-effect-layer > div")].map((el) =>
      ["--from-x", "--from-y", "--to-x", "--to-y"]
        .map((k) => (el as HTMLElement).style.getPropertyValue(k))
        .join(" ")
    );
    const colorAfter = container.querySelector("span")!.style.backgroundColor;

    expect(positionsAfter).toEqual(positionsBefore);
    expect(colorAfter).not.toBe(colorBefore);
  });

  it("reacts to the shared viewer preference and persists the choice", () => {
    const { container } = render(
      <ParticleLayer
        config={{ effectId: "snow", density: "medium", speed: "gentle" }}
        tintColors={TINT}
      />
    );
    expect(container.querySelector(".rsvp-effect-layer")).not.toBeNull();

    act(() => setEffectsHidden(true));
    expect(container.querySelector(".rsvp-effect-layer")).toBeNull();
    expect(window.localStorage.getItem("rsvp:hide-effects")).toBe("1");

    act(() => setEffectsHidden(false));
    expect(container.querySelector(".rsvp-effect-layer")).not.toBeNull();
    expect(window.localStorage.getItem("rsvp:hide-effects")).toBe("0");
  });

  it("respects a stored hide preference on mount", () => {
    window.localStorage.setItem("rsvp:hide-effects", "1");
    const { container } = render(
      <ParticleLayer
        config={{ effectId: "snow", density: "medium", speed: "gentle" }}
        tintColors={TINT}
      />
    );
    expect(container.querySelector(".rsvp-effect-layer")).toBeNull();
  });

  it("does not own a separate effects toggle", () => {
    const { container } = render(<ParticleLayer config={null} tintColors={TINT} />);
    expect(container.querySelector(".rsvp-effect-toggle")).toBeNull();
  });

  it("scales sprites by the size multiplier (default 1x, max 10x)", () => {
    const base = getEffectById("autumn-leaves")!.baseSizePx;
    const widthsFor = (size?: number) => {
      const { container, unmount } = render(
        <ParticleLayer
          config={{ effectId: "autumn-leaves", density: "sparse", speed: "gentle", size }}
          tintColors={TINT}
        />
      );
      const widths = [...container.querySelectorAll("img")].map((img) =>
        parseFloat(img.getAttribute("width")!)
      );
      unmount();
      return widths;
    };
    // No size (legacy config) = the set's designed size, randomized ±40%
    for (const w of widthsFor(undefined)) {
      expect(w).toBeGreaterThanOrEqual(base * 0.6);
      expect(w).toBeLessThanOrEqual(base * 1.4);
    }
    for (const w of widthsFor(10)) {
      expect(w).toBeGreaterThanOrEqual(base * 10 * 0.6);
      expect(w).toBeLessThanOrEqual(base * 10 * 1.4);
    }
    // Out-of-range values are clamped, never trusted blindly
    for (const w of widthsFor(9999)) {
      expect(w).toBeLessThanOrEqual(base * 10 * 1.4);
    }
    for (const w of widthsFor(0.01)) {
      expect(w).toBeGreaterThanOrEqual(base * 0.6);
    }
  });

  it("uses float mode for beer (rising toast, not falling mugs)", () => {
    const { container } = render(
      <ParticleLayer
        config={{ effectId: "beer", density: "medium", speed: "medium" }}
        tintColors={TINT}
      />
    );
    const layer = container.querySelector(".rsvp-effect-layer")!;
    expect(layer.getAttribute("data-effect-mode")).toBe("float");
    expect(layer.getAttribute("data-effect-movement")).toBe("up");
  });

  // ── #825: library mixtures and independent movement ──
  const LIBRARY = [
    { id: "noto:cat", src: "/effects/library/noto/1.2.10/cat.svg" },
    { id: "fluent-emoji-flat:pizza", src: "/effects/library/fluent-emoji-flat/1.2.6/pizza.svg" },
  ];

  it("draws a custom mixture's own colors with img sprites in a contained square", () => {
    const { container } = render(
      <ParticleLayer
        config={{
          effectId: "custom",
          density: "sparse",
          speed: "medium",
          size: 3,
          movement: "random",
          libraryIcons: LIBRARY,
        }}
        tintColors={TINT}
      />
    );
    const layer = container.querySelector(".rsvp-effect-layer") as HTMLElement;
    expect(layer.getAttribute("data-effect-id")).toBe("custom");
    expect(layer.getAttribute("data-effect-movement")).toBe("random");
    expect(layer.getAttribute("aria-hidden")).toBe("true");
    expect(layer.style.pointerEvents).toBe("none");
    expect(layer.querySelectorAll("span").length).toBe(0); // never tinted
    const imgs = [...layer.querySelectorAll("img")];
    expect(imgs.length).toBe(EFFECT_DENSITIES.sparse.count);
    expect(imgs.map((i) => i.getAttribute("src")).slice(0, 2)).toEqual(LIBRARY.map((l) => l.src));
    for (const img of imgs) {
      expect(img.style.objectFit).toBe("contain");
      expect(img.style.width).toBe(img.style.height);
      expect(img.getAttribute("alt")).toBe("");
    }
  });

  it("refuses library sprites that aren't trusted local paths", () => {
    const { container } = render(
      <ParticleLayer
        config={{
          effectId: "custom",
          density: "sparse",
          speed: "medium",
          libraryIcons: [{ id: "noto:cat", src: "https://cdn.example.com/cat.svg" }],
        }}
        tintColors={TINT}
      />
    );
    expect(container.querySelector(".rsvp-effect-layer")).toBeNull();
  });

  it("applies an explicit movement to a built-in set", () => {
    const { container } = render(
      <ParticleLayer
        config={{ effectId: "snow", density: "dense", speed: "medium", movement: "random" }}
        tintColors={TINT}
      />
    );
    const layer = container.querySelector(".rsvp-effect-layer")!;
    expect(layer.getAttribute("data-effect-movement")).toBe("random");
    const edges = new Set(
      [...layer.querySelectorAll("[data-effect-edge]")].map((el) =>
        el.getAttribute("data-effect-edge")
      )
    );
    expect(edges.size).toBeGreaterThan(1);
  });
});
