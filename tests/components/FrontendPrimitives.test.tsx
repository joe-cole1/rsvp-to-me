// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EventCard } from "@/components/event/event-page/EventCard";
import { ThemeBackground } from "@/components/event/ThemeBackground";
import { LocationFields } from "@/components/event/LocationFields";
import { RsvpStatusChoice } from "@/components/rsvp/status";
import { AppCard } from "@/components/ui/AppPrimitives";
import { Dialog } from "@/components/ui/Dialog";
import { testTheme } from "./helpers/theme";

describe("shared frontend primitives", () => {
  it("uses one semantic event section surface", () => {
    render(<EventCard theme={testTheme}>Event content</EventCard>);

    const card = screen.getByText("Event content");
    expect(card.tagName).toBe("SECTION");
    expect(card.style.background.replaceAll(" ", "")).toBe(testTheme.cardBg.replaceAll(" ", ""));
    expect(card.style.borderRadius).toBe(testTheme.cardRadius);
  });

  it("uses one semantic app-shell card surface", () => {
    render(<AppCard>App content</AppCard>);
    expect(screen.getByText("App content").tagName).toBe("SECTION");
  });

  it("renders the shared theme decoration", () => {
    const { container } = render(<ThemeBackground theme={testTheme} />);
    expect(container.querySelectorAll('[aria-hidden="true"]')).toHaveLength(2);
  });

  it("shares RSVP status presentation between links and buttons", () => {
    const onClick = vi.fn();
    render(
      <div>
        <RsvpStatusChoice status="GOING" theme={testTheme} href="/rsvp" />
        <RsvpStatusChoice status="MAYBE" theme={testTheme} active onClick={onClick} />
      </div>
    );

    expect(screen.getByRole("link", { name: /Going/ })).toHaveAttribute("href", "/rsvp");
    const maybe = screen.getByRole("button", { name: /Maybe/ });
    expect(maybe).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(maybe);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("shares location fields between create and edit flows", () => {
    const onChange = vi.fn();
    const value = { type: "PHYSICAL" as const, name: "", address: "", virtualUrl: "" };
    render(<LocationFields value={value} onChange={onChange} theme={testTheme} submitNames />);

    expect(screen.getByDisplayValue("PHYSICAL")).toHaveAttribute("name", "locationType");
    fireEvent.click(screen.getByRole("button", { name: /Virtual/ }));
    expect(onChange).toHaveBeenCalledWith({ ...value, type: "VIRTUAL" });
  });

  it("gives every shared dialog semantics and Escape handling", () => {
    const onClose = vi.fn();
    render(
      <Dialog open onClose={onClose} titleId="test-dialog-title">
        <h2 id="test-dialog-title">Shared dialog</h2>
        <button>Action</button>
      </Dialog>
    );

    expect(screen.getByRole("dialog", { name: "Shared dialog" })).toHaveAttribute(
      "aria-modal",
      "true"
    );
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledOnce();
  });
});
