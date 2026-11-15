// #853 root cause: disabled submission hid validation, fields relied on placeholders,
// and errors did not mark or focus the relevant input. The audit is tracked in #852.
// @vitest-environment jsdom
import React from "react";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@/tests/components/render";
import { testTheme } from "@/tests/components/helpers/theme";
const m = vi.hoisted(() => ({ add: vi.fn(), edit: vi.fn() }));
vi.mock("@/app/actions/event", () => ({
  addRSVP: m.add,
  updateRSVP: m.edit,
  updateRsvpAsHost: m.edit,
}));
vi.mock("@/components/event/EventAtmosphere", () => ({ EventAtmosphere: () => null }));
import { RsvpFlow } from "@/components/rsvp/RsvpFlow";
const event = {
  id: "event",
  slug: "party",
  title: "Party",
  startAt: new Date("2030-12-01T20:00:00Z"),
  endAt: null,
  timezone: "America/New_York",
  locationName: null,
  plusOneAllowed: true,
  plusOneMax: 2,
  plusOneNamesRequired: true,
  maybeEnabled: true,
  questionnaireEnabled: false,
  rsvpFields: [],
};
const open = (override: Partial<typeof event> = {}) =>
  render(<RsvpFlow event={{ ...event, ...override }} theme={testTheme} />);
beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);
describe("#853 RSVP feedback", () => {
  it("labels contact fields visibly and supplies autocomplete and required semantics", () => {
    open();
    for (const [name, autocomplete] of [
      ["Your name (required)", "name"],
      ["Email (optional — for updates)", "email"],
      ["Phone (optional — for SMS updates)", "tel"],
    ]) {
      const input = screen.getByRole("textbox", { name });
      expect(input).toHaveAttribute("autocomplete", autocomplete);
      expect(input.closest("label")).toHaveTextContent(name);
    }
    expect(screen.getByRole("textbox", { name: "Your name (required)" })).toBeRequired();
    expect(screen.getByRole("textbox", { name: /Email/ })).not.toBeRequired();
  });
  it("announces a blank/whitespace name and focuses the invalid field without saving", () => {
    open();
    const name = screen.getByRole("textbox", { name: "Your name (required)" });
    fireEvent.change(name, { target: { value: "  " } });
    fireEvent.click(screen.getByRole("button", { name: "Confirm RSVP" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Check the highlighted fields.");
    expect(name).toHaveAttribute("aria-invalid", "true");
    expect(name).toHaveAccessibleDescription("Enter your name.");
    expect(name).toHaveFocus();
    expect(m.add).not.toHaveBeenCalled();
    fireEvent.change(name, { target: { value: "Alice" } });
    expect(name).not.toHaveAttribute("aria-invalid");
    expect(screen.queryByRole("alert")).toBeNull();
  });
  it("validates email and required companions, then sends a valid RSVP", async () => {
    m.add.mockResolvedValue({ success: true, editToken: "token" });
    open();
    fireEvent.change(screen.getByRole("textbox", { name: "Your name (required)" }), {
      target: { value: "Alice" },
    });
    const email = screen.getByRole("textbox", { name: /Email/ });
    fireEvent.change(email, { target: { value: "invalid" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirm RSVP" }));
    expect(email).toHaveFocus();
    expect(email).toHaveAccessibleDescription("Enter a valid email address.");
    fireEvent.change(email, { target: { value: "alice@example.test" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Attendee Count" }), {
      target: { value: "2" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Confirm RSVP" }));
    const companion = screen.getByRole("textbox", { name: "Guest 1 Name (required)" });
    expect(companion).toHaveFocus();
    expect(companion).toBeRequired();
    fireEvent.change(companion, { target: { value: "Bob" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirm RSVP" }));
    await waitFor(() =>
      expect(m.add).toHaveBeenCalledWith(
        expect.objectContaining({
          guestName: "Alice",
          guestEmail: "alice@example.test",
          plusOneGuestNames: ["Bob"],
        }),
        null
      )
    );
    expect(await screen.findByText("You're in!")).toBeInTheDocument();
  });
  it.each(["TEXT", "TEXTAREA", "SELECT", "CHECKBOX"])(
    "announces and focuses a missing required %s answer",
    (fieldType) => {
      render(
        <RsvpFlow
          event={{
            ...event,
            rsvpFields: [{ id: "q", label: "Meal", required: true, fieldType, options: '["Veg"]' }],
          }}
          theme={testTheme}
        />
      );
      fireEvent.change(screen.getByRole("textbox", { name: "Your name (required)" }), {
        target: { value: "Alice" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Continue →" }));
      fireEvent.click(screen.getByRole("button", { name: "Submit" }));
      const invalid = document.querySelector('[aria-invalid="true"]');
      expect(invalid).toHaveFocus();
      expect(invalid).toHaveAccessibleDescription("Complete this required field.");
      expect(screen.getByRole("alert")).toHaveTextContent("Check the highlighted fields.");
      expect(m.add).not.toHaveBeenCalled();
    }
  );
  it("announces and focuses action failures", async () => {
    m.add.mockResolvedValue({ success: false, error: "Event is at capacity" });
    open();
    fireEvent.change(screen.getByRole("textbox", { name: "Your name (required)" }), {
      target: { value: "Alice" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Confirm RSVP" }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Event is at capacity");
    expect(alert.parentElement).toHaveFocus();
  });
});
