import { describe, expect, it } from "vitest";
import { buildSampleEmail } from "@/emails/registry";
import { renderEmail } from "@/emails/render";
import { appShellEmailTheme } from "@/lib/email-theme";
const theme = appShellEmailTheme();
describe("MagicLinkEmail code box", () => {
  it("renders a copyable code with email theme colors and dark-mode classes independent of custom body", async () => {
    const { element } = await buildSampleEmail("magicLink", theme, {
      body: "Custom admin body without any code placeholder.",
    });
    const { html, text } = await renderEmail(element);
    const document = new DOMParser().parseFromString(html, "text/html");
    const code = [...document.querySelectorAll(".dm-block .dm-text-primary")].find(
      (el) => el.textContent === "482910"
    ) as HTMLElement;
    expect(code).toBeDefined();
    expect(code.textContent).toBe("482910");
    const expected = document.createElement("span");
    expected.style.color = theme.textPrimary;
    expected.style.backgroundColor = theme.cardBg;
    expect(code.style.color).toBe(expected.style.color);
    expect(code.parentElement?.style.backgroundColor).toBe(expected.style.backgroundColor);
    expect(code.style.letterSpacing).toBe("6px");
    expect(code.style.fontSize).toBe("32px");
    expect(code.parentElement?.classList.contains("dm-block")).toBe(true);
    expect(text).toContain("482910");
    expect(text).toContain("Custom admin body without any code placeholder.");
    expect(text).toContain("15 minutes");
  });
});
