// @vitest-environment jsdom
// The shared control set (components/ui): one definition per look, every color from
// the ResolvedTheme it is given, on the app shell and on DARK, SOFT and BOLD events.
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@/tests/components/render";
import {
  APP_SHELL_THEME,
  BASE_THEMES,
  THEME_PRESETS,
  chromeTheme,
  resolveTheme,
  type ResolvedTheme,
} from "@/lib/theme";
import { contrastRatio, parseColor } from "@/lib/theme-contrast";
import { Button, DISABLED_OPACITY, buttonStyle, type ButtonVariant } from "@/components/ui/Button";
import { Chip, ChoiceTile, Swatch } from "@/components/ui/Choice";
import { Field, Input, Label, fieldStyle } from "@/components/ui/Field";
import { InlineAlert, StatusChip, Toast } from "@/components/ui/Feedback";
import { Toggle } from "@/components/ui/Toggle";

const base = (id: "DARK" | "SOFT" | "BOLD") => {
  const b = BASE_THEMES.find((theme) => theme.id === id)!;
  return resolveTheme(id, b.defaultGradientFrom, b.defaultGradientTo, b.defaultAccent);
};
const summer = THEME_PRESETS.find((preset) => preset.name === "Summer Vibes")!;
const THEMES: [string, ResolvedTheme][] = [
  ["app shell", APP_SHELL_THEME],
  ["DARK", base("DARK")],
  ["SOFT", base("SOFT")],
  ["BOLD", base("BOLD")],
  [
    "BOLD Summer Vibes",
    resolveTheme(summer.base, summer.gradientFrom, summer.gradientTo, summer.accentColor),
  ],
  ["host bar chrome on SOFT", chromeTheme(base("SOFT"))],
];
const px = (value: string | number | undefined) => parseFloat(String(value));

describe.each(THEMES)("shared controls on %s", (_name, t) => {
  it("draws the primary button from the accent and its readable text", () => {
    const s = buttonStyle(t, { variant: "primary" });
    expect(s.backgroundColor).toBe(t.accent);
    expect(s.color).toBe(t.accentFg);
    expect(s.borderRadius).toBe(t.btnRadius);
    expect(px(s.minHeight)).toBe(44);
    expect(contrastRatio(parseColor(t.accentFg), parseColor(t.accent))).toBeGreaterThanOrEqual(3);
  });

  it("keeps every other variant on theme fields", () => {
    const secondary = buttonStyle(t, { variant: "secondary" });
    expect(secondary.backgroundColor).toBe(t.inputBg);
    expect(secondary.color).toBe(t.textPrimary);
    expect(px(secondary.minHeight)).toBe(40);
    const destructive = buttonStyle(t, { variant: "destructive" });
    expect(destructive.color).toBe(t.status.error.text);
    expect(destructive.backgroundColor).toBe(t.status.error.bg);
    expect(buttonStyle(t, { variant: "link" }).color).toBe(t.accentText);
    expect(buttonStyle(t, { variant: "add" }).color).toBe(t.accentText);
  });

  it("styles inputs and labels from the theme's input and text fields", () => {
    const s = fieldStyle(t);
    expect(s.backgroundColor).toBe(t.inputBg);
    expect(s.color).toBe(t.inputText);
    expect(s.borderRadius).toBe("10px");
    render(
      <Field theme={t} label="Guest name" hint="Shown on the guest list">
        <Input theme={t} />
      </Field>
    );
    const input = screen.getByLabelText("Guest name");
    expect(input.getAttribute("aria-describedby")).toBeTruthy();
    expect(document.getElementById(input.getAttribute("aria-describedby")!)?.textContent).toBe(
      "Shown on the guest list"
    );
    expect(screen.getByText("Guest name").style.color).not.toBe("");
  });

  it("colors alerts and chips with the theme's status set", () => {
    render(
      <>
        <InlineAlert theme={t}>Could not save</InlineAlert>
        <InlineAlert theme={t} tone="success">
          Saved
        </InlineAlert>
        <StatusChip theme={t} tone="success">
          Verified
        </StatusChip>
      </>
    );
    expect(screen.getByRole("alert").textContent).toBe("Could not save");
    expect(screen.getByRole("status").textContent).toBe("Saved");
    expect(screen.getByText("Verified").style.color).not.toBe("");
  });
});

describe("one button component", () => {
  it.each<Exclude<ButtonVariant, "icon">>([
    "primary",
    "secondary",
    "destructive",
    "add",
    "link",
    "overlay",
  ])("%s buttons fade to 0.45 and show not-allowed when disabled", (variant) => {
    render(
      <Button theme={APP_SHELL_THEME} variant={variant} disabled>
        Save
      </Button>
    );
    const button = screen.getByRole("button", { name: "Save" });
    expect(Number(button.style.opacity)).toBe(DISABLED_OPACITY);
    expect(button.style.cursor).toBe("not-allowed");
    expect(button.hasAttribute("disabled")).toBe(true);
  });

  it("names icon buttons and keeps them 40px square (32px in rows)", () => {
    render(
      <>
        <Button theme={APP_SHELL_THEME} variant="icon" aria-label="Close">
          ×
        </Button>
        <Button theme={APP_SHELL_THEME} variant="icon" size="sm" aria-label="Remove">
          −
        </Button>
      </>
    );
    const close = screen.getByRole("button", { name: "Close" });
    expect(close.style.width).toBe("40px");
    expect(close.style.height).toBe("40px");
    expect(screen.getByRole("button", { name: "Remove" }).style.height).toBe("32px");
  });

  it("does not choose a submit type for the caller", () => {
    render(
      <form onSubmit={(event) => event.preventDefault()}>
        <Button theme={APP_SHELL_THEME} variant="primary">
          Send
        </Button>
      </form>
    );
    expect(screen.getByRole("button", { name: "Send" }).getAttribute("type")).toBeNull();
  });
});

describe("choices, switch and toast", () => {
  it("exposes chips, tiles and swatches as pressed buttons", () => {
    render(
      <>
        <Chip theme={APP_SHELL_THEME} selected>
          Upcoming
        </Chip>
        <ChoiceTile theme={APP_SHELL_THEME} selected={false}>
          Playfair
        </ChoiceTile>
        <Swatch theme={APP_SHELL_THEME} color="#f43f5e" label="Rose" selected onClick={vi.fn()} />
      </>
    );
    expect(screen.getByRole("button", { name: "Upcoming" }).getAttribute("aria-pressed")).toBe(
      "true"
    );
    expect(screen.getByRole("button", { name: "Playfair" }).getAttribute("aria-pressed")).toBe(
      "false"
    );
    expect(screen.getByRole("button", { name: "Rose" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("gives the switch a 40px hit area, a name, its state and a disabled look", () => {
    const change = vi.fn();
    render(
      <>
        <Toggle theme={APP_SHELL_THEME} label="Event updates" value onChange={change} />
        <Toggle
          theme={APP_SHELL_THEME}
          label="Host alerts"
          description="Only for this event"
          value={false}
          onChange={change}
          disabled
        />
      </>
    );
    const on = screen.getByRole("switch", { name: "Event updates" });
    expect(on.getAttribute("aria-checked")).toBe("true");
    expect(px(on.style.minHeight)).toBeGreaterThanOrEqual(40);
    fireEvent.click(on);
    expect(change).toHaveBeenCalledWith(false);
    const off = screen.getByRole("switch", { name: "Host alerts" });
    expect(Number(off.style.opacity)).toBe(DISABLED_OPACITY);
    expect(off.style.cursor).toBe("not-allowed");
    expect(document.getElementById(off.getAttribute("aria-describedby")!)?.textContent).toBe(
      "Only for this event"
    );
  });

  it("renders the toast only with a message, with the right role and action", () => {
    const undo = vi.fn();
    const { rerender } = render(<Toast theme={APP_SHELL_THEME} toast={null} />);
    expect(screen.queryByRole("status")).toBeNull();
    rerender(
      <Toast
        theme={APP_SHELL_THEME}
        toast={{ tone: "info", message: "Section removed" }}
        action={{ label: "Undo", onClick: undo }}
      />
    );
    expect(screen.getByRole("status").textContent).toContain("Section removed");
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(undo).toHaveBeenCalled();
    rerender(<Toast theme={APP_SHELL_THEME} toast={{ tone: "error", message: "Not saved" }} />);
    expect(screen.getByRole("alert").textContent).toContain("Not saved");
  });

  it("renders a group label without a control as plain text", () => {
    render(<Label theme={APP_SHELL_THEME}>Delivery channels</Label>);
    expect(screen.getByText("Delivery channels").tagName).toBe("DIV");
  });
});

// ── Guard: buttons that look alike are one definition ──
// A native <button>, <a> or <Link> outside components/ui that paints an accent fill
// is a hand-built primary button; use <Button variant="primary"> or buttonProps().
const ROOT = process.cwd();
function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      return ["node_modules", "generated", "preview", "ui"].includes(entry.name)
        ? []
        : sourceFiles(path);
    }
    return entry.name.endsWith(".tsx") ? [path] : [];
  });
}
function openingTags(source: string): string[] {
  const tags: string[] = [];
  const start = /<(button|a|Link)\b/g;
  let match;
  while ((match = start.exec(source))) {
    let depth = 0;
    let i = match.index;
    for (; i < source.length; i++) {
      const c = source[i];
      if (c === "{") depth++;
      else if (c === "}") depth--;
      else if (c === ">" && depth === 0 && source[i - 1] !== "=") break;
    }
    tags.push(source.slice(match.index, i));
  }
  return tags;
}

describe("no hand-built buttons", () => {
  it("leaves accent-filled buttons and links to components/ui", () => {
    const offenders = ["app", "components"].flatMap((dir) =>
      sourceFiles(join(ROOT, dir)).flatMap((file) =>
        openingTags(readFileSync(file, "utf8"))
          .filter((tag) => /background(Color)?:\s*[\w.]*\.accent\b(?!\w)/.test(tag))
          .map((tag) => `${relative(ROOT, file)}: ${tag.slice(0, 60).replace(/\s+/g, " ")}`)
      )
    );
    expect(offenders).toEqual([]);
  });
});
