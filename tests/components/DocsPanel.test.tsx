import React from "react";
import { describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { act, fireEvent, waitFor } from "@testing-library/react";
import { render, screen } from "@/tests/components/render";
import DocsPanel, { type PanelDoc } from "@/components/docs/DocsPanel";
import dutch from "@/messages/nl-NL.json";

const docs: PanelDoc[] = [
  {
    slug: "starting",
    title: "Aan de slag",
    description: "Begin hier",
    category: "Handleidingen",
    content: "# Aan de slag {#getting-started}\n\n[Instellen](settings.md#settings)",
    locale: "nl-NL",
    dir: "ltr",
  },
  {
    slug: "settings",
    title: "Settings",
    description: "English fallback",
    category: "Guides",
    content: "# Settings\n\nEnglish article.",
    locale: "en-US",
    dir: "ltr",
  },
  {
    slug: "sharing",
    title: "Samen organiseren",
    description: "Samenwerken",
    category: "Handleidingen",
    content: "# Samen organiseren {#co-hosting}\n\n[Begin](starting.md#getting-started)",
    locale: "nl-NL",
    dir: "ltr",
  },
];

describe("DocsPanel language-aware navigation", () => {
  it("shows Dutch search feedback and filters translated article titles", async () => {
    const user = userEvent.setup();
    render(<DocsPanel docs={docs} />, { locale: "nl-NL", messages: dutch });
    expect(screen.getByRole("navigation", { name: "Hulpartikelen" })).toBeInTheDocument();
    await user.type(screen.getByRole("textbox", { name: "Handleidingen doorzoeken…" }), "Samen");
    expect(screen.getByRole("button", { name: "Samen organiseren" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Settings" })).not.toBeInTheDocument();
    await user.clear(screen.getByRole("textbox"));
    await user.type(screen.getByRole("textbox"), "niet-bestaand");
    expect(screen.getByText("Geen handleidingen gevonden.")).toBeInTheDocument();
  });

  it("navigates canonical crosslinks to translated and English fallback articles", async () => {
    const user = userEvent.setup();
    const scroll = vi.fn();
    HTMLElement.prototype.scrollIntoView = scroll;
    render(<DocsPanel docs={docs} />, { locale: "nl-NL", messages: dutch });
    expect(screen.getByRole("heading", { name: "Aan de slag" })).toHaveAttribute(
      "id",
      "getting-started"
    );
    await user.click(screen.getByRole("link", { name: "Instellen" }));
    expect(screen.getByRole("article")).toHaveAttribute("lang", "en-US");
    expect(screen.getByRole("heading", { name: "Settings" })).toHaveAttribute("id", "settings");
    await waitFor(() => expect(scroll).toHaveBeenCalledTimes(1));
    await user.click(screen.getByRole("button", { name: "Samen organiseren" }));
    expect(screen.getByRole("article")).toHaveAttribute("lang", "nl-NL");
    await user.click(screen.getByRole("link", { name: "Begin" }));
    expect(screen.getByRole("heading", { name: "Aan de slag" })).toHaveAttribute(
      "id",
      "getting-started"
    );
    expect(screen.getByRole("article")).toHaveAttribute("dir", "ltr");
    // Flush the second crosslink timer before jsdom is disposed.
    await waitFor(() => expect(scroll).toHaveBeenCalledTimes(2));
  });

  it("scrolls to a crosslinked heading after the article changes", () => {
    vi.useFakeTimers();
    const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;
    const scroll = vi.fn();
    HTMLElement.prototype.scrollIntoView = scroll;
    try {
      render(<DocsPanel docs={docs} />, { locale: "nl-NL", messages: dutch });
      fireEvent.click(screen.getByRole("link", { name: "Instellen" }));
      expect(screen.getByRole("heading", { name: "Settings" })).toBeInTheDocument();
      act(() => vi.advanceTimersByTime(49));
      expect(scroll).not.toHaveBeenCalled();
      act(() => vi.advanceTimersByTime(1));
      expect(scroll).toHaveBeenCalledExactlyOnceWith({ behavior: "smooth" });
    } finally {
      HTMLElement.prototype.scrollIntoView = originalScrollIntoView;
      vi.useRealTimers();
    }
  });

  it("cancels a pending crosslink scroll when another article is selected", () => {
    vi.useFakeTimers();
    const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;
    const scroll = vi.fn();
    HTMLElement.prototype.scrollIntoView = scroll;
    try {
      render(<DocsPanel docs={docs} />, { locale: "nl-NL", messages: dutch });
      fireEvent.click(screen.getByRole("link", { name: "Instellen" }));
      fireEvent.click(screen.getByRole("button", { name: "Samen organiseren" }));
      act(() => vi.advanceTimersByTime(100));
      expect(scroll).not.toHaveBeenCalled();
    } finally {
      HTMLElement.prototype.scrollIntoView = originalScrollIntoView;
      vi.useRealTimers();
    }
  });

  it("cancels a pending crosslink scroll when the panel unmounts", () => {
    vi.useFakeTimers();
    const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;
    const scroll = vi.fn();
    HTMLElement.prototype.scrollIntoView = scroll;
    try {
      const { unmount } = render(<DocsPanel docs={docs} />, {
        locale: "nl-NL",
        messages: dutch,
      });
      fireEvent.click(screen.getByRole("link", { name: "Instellen" }));
      unmount();
      act(() => vi.advanceTimersByTime(100));
      expect(scroll).not.toHaveBeenCalled();
    } finally {
      HTMLElement.prototype.scrollIntoView = originalScrollIntoView;
      vi.useRealTimers();
    }
  });

  it("localizes the empty-article state through the real provider", () => {
    render(<DocsPanel docs={[]} />, { locale: "nl-NL", messages: dutch });
    expect(screen.getByText("Er zijn geen handleidingen beschikbaar.")).toBeInTheDocument();
  });
});
