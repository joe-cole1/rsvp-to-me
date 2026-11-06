// Root cause (2026-11-05, design review G11 and M1–M4, issue #808, task 46ded135):
// resolveEmailTheme() passed web colors straight into email, where the surfaces
// differ. Links used the raw accent on the white body (Winter #bae6fd read
// 1.33:1), BOLD hero text took the web's white even where the web only keeps
// white by drawing a scrim that email can't (Sunset 2.8:1), the small hero text
// was faded further with opacity, and the fixed muted gray #8b8b94 read 3.08:1
// on the canvas. The fix measures every email color on email surfaces.
import { describe, expect, it } from "vitest";
import { THEME_PRESETS } from "@/lib/theme";
import {
  bannerSurfaces,
  EMAIL_SURFACES,
  resolveEmailTheme,
  type EmailThemeInput,
} from "@/lib/email-theme";
import { minContrast, parseColor } from "@/lib/theme-contrast";
import { buildSampleEmail } from "@/emails/registry";
import { renderEmail } from "@/emails/render";

function preset(id: string): EmailThemeInput {
  const p = THEME_PRESETS.find((x) => x.id === id)!;
  return {
    baseTheme: p.base,
    gradientFrom: p.gradientFrom,
    gradientTo: p.gradientTo,
    accentColor: p.accentColor,
  };
}

const LIGHT = [EMAIL_SURFACES.body, EMAIL_SURFACES.card, EMAIL_SURFACES.canvas].map(parseColor);

describe("issue #808: email contrast", () => {
  it("renders Winter's links in a readable shade of its accent", async () => {
    const t = resolveEmailTheme(preset("winter"));
    expect(minContrast(t.accent, LIGHT)).toBeLessThan(1.5);
    expect(minContrast(t.linkColor, LIGHT)).toBeGreaterThanOrEqual(4.5);
    const { element } = await buildSampleEmail("rsvpConfirmation", t);
    const { html } = await renderEmail(element);
    // As an inline text color only: the primary button keeps the accent as its
    // fill, and dark mode (where Winter's pale accent reads) may use it too.
    const asText = (hex: string) => new RegExp(`[;"]color:${hex}(?![0-9a-f])`, "i");
    expect(html).toMatch(asText(t.linkColor));
    expect(html).not.toMatch(asText(t.accent));
    expect(html).toMatch(new RegExp(`background-color:\\s*${t.accent}`, "i"));
  });

  it("gives Sunset's hero text a color that reads without the web scrim", async () => {
    const t = resolveEmailTheme(preset("sunset"));
    const hero = bannerSurfaces(t.heroGradient, t.heroFallback);
    expect(minContrast("#ffffff", hero)).toBeLessThan(3);
    expect(minContrast(t.heroText, hero)).toBeGreaterThanOrEqual(3);
    expect(minContrast(t.heroTextSecondary, hero)).toBeGreaterThanOrEqual(4.5);
    const { element } = await buildSampleEmail("rsvpConfirmation", t);
    const { html } = await renderEmail(element);
    expect(html).not.toMatch(/opacity:\s*0\.85/);
  });

  it("keeps the muted gray at 4.5:1 on the body, card and canvas", () => {
    const t = resolveEmailTheme(null);
    expect(t.textMuted).not.toBe("#8b8b94");
    expect(minContrast(t.textMuted, LIGHT)).toBeGreaterThanOrEqual(4.5);
  });
});
