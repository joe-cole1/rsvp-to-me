// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import React from "react";
import { ParticleLayer } from "@/components/event/event-page/ParticleLayer";
import { EFFECT_DENSITIES, getEffectById } from "@/lib/effects";

const TINT = ["#a855f7", "#7c3aed", "#1e40af", "#ffffff"];

describe("ParticleLayer", () => {
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
    const positionsBefore = [...container.querySelectorAll(".rsvp-effect-layer > div")].map(
      (el) => (el as HTMLElement).style.left
    );
    const colorBefore = container.querySelector("span")!.style.backgroundColor;

    rerender(
      <ParticleLayer
        config={{ effectId: "confetti", density: "sparse", speed: "medium" }}
        tintColors={["#16a34a", "#166534", "#facc15", "#ffffff"]}
      />
    );
    const positionsAfter = [...container.querySelectorAll(".rsvp-effect-layer > div")].map(
      (el) => (el as HTMLElement).style.left
    );
    const colorAfter = container.querySelector("span")!.style.backgroundColor;

    expect(positionsAfter).toEqual(positionsBefore);
    expect(colorAfter).not.toBe(colorBefore);
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
  });
});
