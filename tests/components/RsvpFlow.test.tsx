// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@/tests/components/render";
import { useState } from "react";
import { NextIntlClientProvider } from "next-intl";
import english from "@/messages/en-US.json";
import dutch from "@/messages/nl-NL.json";
import {
  formatDate,
  formatTime,
  toDateTimeLocal,
  tzLocalToUtcClient,
} from "@/components/event/event-page/helpers";
import { testTheme } from "./helpers/theme";

const { mockAddRSVP, mockUpdateRSVP, mockUpdateRsvpAsHost } = vi.hoisted(() => ({
  mockAddRSVP: vi.fn(),
  mockUpdateRSVP: vi.fn(),
  mockUpdateRsvpAsHost: vi.fn(),
}));

vi.mock("@/app/actions/event", () => ({
  addRSVP: mockAddRSVP,
  updateRSVP: mockUpdateRSVP,
  updateRsvpAsHost: mockUpdateRsvpAsHost,
}));

import { RsvpFlow } from "@/components/rsvp/RsvpFlow";

const baseEvent = {
  id: "event-1",
  slug: "test-party",
  title: "Test Party",
  startAt: new Date("2030-12-01T20:00:00Z"),
  endAt: null,
  timezone: "America/New_York",
  locationName: "My House",
  plusOneAllowed: false,
  plusOneMax: 0,
  plusOneNamesRequired: false,
  maybeEnabled: true,
  questionnaireEnabled: false,
  rsvpFields: [],
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("RsvpFlow — new RSVP", () => {
  it("renders Going, Maybe, and Can't go buttons", () => {
    render(
      <RsvpFlow event={baseEvent} theme={testTheme} initialStatus="GOING" sessionUser={null} />
    );
    expect(screen.getByText("Going")).toBeInTheDocument();
    expect(screen.getByText("Maybe")).toBeInTheDocument();
    expect(screen.getByText("Can't go")).toBeInTheDocument();
  });

  it("uses the shared 600px event width for the RSVP flow", () => {
    render(
      <RsvpFlow event={baseEvent} theme={testTheme} initialStatus="GOING" sessionUser={null} />
    );

    const heading = screen.getByRole("heading", { name: "Test Party" });
    expect(heading.parentElement?.parentElement?.style.maxWidth).toBe("600px");
  });

  it("carries the event effect into the RSVP flow", () => {
    const { container } = render(
      <RsvpFlow
        event={baseEvent}
        theme={testTheme}
        effect={{ effectId: "confetti", density: "sparse", speed: "gentle" }}
        initialStatus="GOING"
        sessionUser={null}
      />
    );

    expect(container.querySelector('[data-effect-id="confetti"]')).toBeTruthy();
  });

  it("does not render Maybe button when maybeEnabled is false", () => {
    render(
      <RsvpFlow
        event={{ ...baseEvent, maybeEnabled: false }}
        theme={testTheme}
        initialStatus="GOING"
        sessionUser={null}
      />
    );
    expect(screen.queryByText("Maybe")).not.toBeInTheDocument();
  });

  it("renders name input with required placeholder", () => {
    render(
      <RsvpFlow event={baseEvent} theme={testTheme} initialStatus="GOING" sessionUser={null} />
    );
    expect(screen.getByPlaceholderText("Your name (required)")).toBeInTheDocument();
  });

  it("allows submission so an empty name can receive validation feedback", () => {
    render(
      <RsvpFlow event={baseEvent} theme={testTheme} initialStatus="GOING" sessionUser={null} />
    );
    const btn = screen.getByText("Confirm RSVP");
    fireEvent.click(btn);
    expect(screen.getByRole("alert")).toHaveTextContent("Check the highlighted fields.");
    expect(screen.getByRole("textbox", { name: "Your name (required)" })).toHaveFocus();
    expect(mockAddRSVP).not.toHaveBeenCalled();
  });

  it("submit button is enabled after typing a name", () => {
    render(
      <RsvpFlow event={baseEvent} theme={testTheme} initialStatus="GOING" sessionUser={null} />
    );
    fireEvent.change(screen.getByPlaceholderText("Your name (required)"), {
      target: { value: "Alice" },
    });
    expect(screen.getByText("Confirm RSVP")).not.toBeDisabled();
  });

  it("shows confirmation screen after successful RSVP submission", async () => {
    mockAddRSVP.mockResolvedValue({ success: true, id: "rsvp-1", editToken: "tok-abc" });

    const { container } = render(
      <RsvpFlow
        event={baseEvent}
        theme={testTheme}
        effect={{ effectId: "confetti", density: "sparse", speed: "gentle" }}
        initialStatus="GOING"
        sessionUser={null}
      />
    );
    fireEvent.change(screen.getByPlaceholderText("Your name (required)"), {
      target: { value: "Alice" },
    });
    fireEvent.click(screen.getByText("Confirm RSVP"));

    await waitFor(() => {
      expect(screen.getByText("You're in!")).toBeInTheDocument();
    });
    expect(container.querySelector('[data-effect-id="confetti"]')).toBeTruthy();
  });

  it("shows inline error when addRSVP returns failure", async () => {
    mockAddRSVP.mockResolvedValue({ success: false, error: "Event is at capacity" });

    render(
      <RsvpFlow event={baseEvent} theme={testTheme} initialStatus="GOING" sessionUser={null} />
    );
    fireEvent.change(screen.getByPlaceholderText("Your name (required)"), {
      target: { value: "Bob" },
    });
    fireEvent.click(screen.getByText("Confirm RSVP"));

    await waitFor(() => {
      expect(screen.getByText("Event is at capacity")).toBeInTheDocument();
    });
  });

  it("shows 'Noted!' on confirmation for MAYBE status", async () => {
    mockAddRSVP.mockResolvedValue({ success: true, id: "rsvp-1", editToken: "tok-abc" });

    render(
      <RsvpFlow event={baseEvent} theme={testTheme} initialStatus="MAYBE" sessionUser={null} />
    );
    fireEvent.change(screen.getByPlaceholderText("Your name (required)"), {
      target: { value: "Carol" },
    });
    fireEvent.click(screen.getByText("Confirm RSVP"));

    await waitFor(() => {
      expect(screen.getByText("Noted!")).toBeInTheDocument();
    });
  });
});

// Regression (ROADMAP "RSVP Flow Confirmation Race Condition", found during the
// [89d70d] themes E2E audit): after a successful *create*, the Server Action's
// automatic page refresh re-requests the RSC payload with the new ?token= URL,
// so the server passes `existingRsvp` down and the still-mounted RsvpFlow
// flipped `isEdit` to true — transiently swapping the "You're in!" success
// heading to "RSVP updated!". The `justCreated` flag pins the create heading
// for the RSVP created in this mount. The rerender below simulates the RSC
// refresh delivering the new props.
describe("RsvpFlow — confirmation heading race (create → RSC refresh)", () => {
  it("keeps 'You're in!' when existingRsvp arrives after a create", async () => {
    mockAddRSVP.mockResolvedValue({ success: true, id: "rsvp-1", editToken: "tok-abc" });

    const { rerender } = render(
      <RsvpFlow event={baseEvent} theme={testTheme} initialStatus="GOING" sessionUser={null} />
    );
    fireEvent.change(screen.getByPlaceholderText("Your name (required)"), {
      target: { value: "Alice" },
    });
    fireEvent.click(screen.getByText("Confirm RSVP"));
    await waitFor(() => {
      expect(screen.getByText("You're in!")).toBeInTheDocument();
    });

    rerender(
      <RsvpFlow
        event={baseEvent}
        theme={testTheme}
        initialStatus="GOING"
        sessionUser={null}
        existingRsvp={{
          id: "rsvp-1",
          editToken: "tok-abc",
          guestName: "Alice",
          status: "GOING" as const,
          plusOneCount: 0,
          note: null,
          plusOneGuests: [],
          answers: [],
          hasContact: false,
          responded: true,
        }}
      />
    );

    expect(screen.getByText("You're in!")).toBeInTheDocument();
    expect(screen.queryByText("RSVP updated!")).not.toBeInTheDocument();
  });
});

describe("RsvpFlow — edit mode", () => {
  const existingRsvp = {
    id: "rsvp-1",
    editToken: "tok-abc",
    guestName: "Alice",
    status: "GOING" as const,
    plusOneCount: 0,
    note: null,
    plusOneGuests: [],
    answers: [],
    hasContact: true,
    responded: true,
  };

  it("renders an editable prefilled guest name", () => {
    render(
      <RsvpFlow
        event={baseEvent}
        theme={testTheme}
        existingRsvp={existingRsvp}
        sessionUser={null}
      />
    );
    expect(screen.getByPlaceholderText("Your name (required)")).toHaveValue("Alice");
  });

  it("shows 'Update RSVP' button in edit mode", () => {
    render(
      <RsvpFlow
        event={baseEvent}
        theme={testTheme}
        existingRsvp={existingRsvp}
        sessionUser={null}
      />
    );
    expect(screen.getByRole("button", { name: "Update RSVP" })).toBeInTheDocument();
  });

  it("shows 'RSVP updated!' on successful update", async () => {
    mockUpdateRSVP.mockResolvedValue({ success: true });

    render(
      <RsvpFlow
        event={baseEvent}
        theme={testTheme}
        existingRsvp={existingRsvp}
        sessionUser={null}
      />
    );
    fireEvent.change(screen.getByPlaceholderText("Your name (required)"), {
      target: { value: " Alice Jones " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Update RSVP" }));

    await waitFor(() => {
      expect(screen.getByText("RSVP updated!")).toBeInTheDocument();
    });
    expect(mockUpdateRSVP).toHaveBeenCalledWith(
      "tok-abc",
      expect.objectContaining({ guestName: "Alice Jones" }),
      null
    );
  });

  it("renders a read-only summary after event-start locking", () => {
    const { container } = render(
      <RsvpFlow
        event={baseEvent}
        theme={testTheme}
        effect={{ effectId: "confetti", density: "sparse", speed: "gentle" }}
        existingRsvp={existingRsvp}
        sessionUser={null}
        readOnlyReason="This event has started, so guests can no longer change their RSVP."
      />
    );

    expect(screen.getByText("RSVP editing is closed")).toBeInTheDocument();
    expect(screen.getByText("Going · Party of 1")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Update RSVP" })).not.toBeInTheDocument();
    expect(container.querySelector('[data-effect-id="confetti"]')).toBeTruthy();
  });

  it("uses the authenticated organizer update action in override mode", async () => {
    mockUpdateRsvpAsHost.mockResolvedValue({ success: true });
    render(
      <RsvpFlow
        event={baseEvent}
        theme={testTheme}
        existingRsvp={existingRsvp}
        sessionUser={null}
        organizerOverride
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Update RSVP" }));
    await waitFor(() =>
      expect(mockUpdateRsvpAsHost).toHaveBeenCalledWith("rsvp-1", expect.any(Object), null)
    );
    expect(mockUpdateRSVP).not.toHaveBeenCalled();
  });
});

describe("RSVP localization", () => {
  it("changes locale without discarding guest name, note, response or party size", () => {
    function LocaleHarness() {
      const [locale, setLocale] = useState<"en-US" | "nl-NL">("en-US");
      return (
        <>
          <button onClick={() => setLocale("nl-NL")}>Switch test locale</button>
          <NextIntlClientProvider locale={locale} messages={locale === "nl-NL" ? dutch : english}>
            <RsvpFlow
              event={{ ...baseEvent, plusOneAllowed: true, plusOneMax: 2 }}
              theme={testTheme}
              initialStatus="GOING"
              sessionUser={null}
            />
          </NextIntlClientProvider>
        </>
      );
    }
    render(<LocaleHarness />);
    fireEvent.change(screen.getByPlaceholderText("Your name (required)"), {
      target: { value: "Aïsha" },
    });
    fireEvent.change(screen.getByPlaceholderText("Leave a note…"), {
      target: { value: "User-written English stays English" },
    });
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "2" } });
    fireEvent.click(screen.getByRole("button", { name: "Switch test locale" }));
    expect(screen.getByPlaceholderText("Je naam (verplicht)")).toHaveValue("Aïsha");
    expect(screen.getByDisplayValue("User-written English stays English")).toBeInTheDocument();
    expect(screen.getByRole("combobox")).toHaveValue("2");
    expect(screen.getByRole("button", { name: "Aanwezig" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(screen.getByRole("button", { name: "RSVP bevestigen" })).toBeEnabled();
    expect(screen.queryByText("Confirm RSVP")).not.toBeInTheDocument();
  });

  it("submits canonical RSVP values from a Dutch form", async () => {
    mockAddRSVP.mockResolvedValue({ success: true, editToken: "dutch-edit-token" });
    render(
      <RsvpFlow event={baseEvent} theme={testTheme} initialStatus="MAYBE" sessionUser={null} />,
      { locale: "nl-NL", messages: dutch }
    );
    fireEvent.change(screen.getByPlaceholderText("Je naam (verplicht)"), {
      target: { value: "Sanne" },
    });
    fireEvent.click(screen.getByRole("button", { name: "RSVP bevestigen" }));
    await waitFor(() => expect(screen.getByText("Genoteerd!")).toBeVisible());
    expect(mockAddRSVP).toHaveBeenCalledWith(
      expect.objectContaining({ guestName: "Sanne", status: "MAYBE" }),
      null
    );
  });

  it("uses the selected display locale with the event timezone, preserving machine conversions", () => {
    const instant = new Date("2030-12-01T00:30:00Z");
    const timezone = "America/New_York";
    expect(formatDate(instant, timezone, "nl-NL")).toBe("zaterdag 30 november 2030");
    expect(formatTime(instant, timezone, "nl-NL")).toMatch(/19:30.*(?:EST|GMT-5)/);
    expect(formatDate(instant, timezone, "de-DE")).toBe("Samstag, 30. November 2030");
    const machineValue = toDateTimeLocal(instant, timezone);
    expect(machineValue).toBe("2030-11-30T19:30");
    expect(tzLocalToUtcClient(machineValue, timezone).toISOString()).toBe(instant.toISOString());
  });
});

describe("RsvpFlow — typed fields, templates, and goingOnly (#786)", () => {
  it("hides goingOnly questions when Maybe is selected and shows them for Going", async () => {
    mockAddRSVP.mockResolvedValue({ success: true, id: "rsvp-1", editToken: "tok-1" });
    const eventWithGoingOnly = {
      ...baseEvent,
      rsvpFields: [
        {
          id: "q-addr",
          label: "Mailing address",
          description: null,
          fieldType: "ADDRESS",
          required: true,
          goingOnly: true,
          options: null,
        },
      ],
    };

    render(
      <RsvpFlow
        event={eventWithGoingOnly}
        theme={testTheme}
        initialStatus="MAYBE"
        sessionUser={null}
      />
    );
    expect(screen.getByRole("button", { name: "Confirm RSVP" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Continue →" })).not.toBeInTheDocument();

    // Toggling to Going on Step 1 reveals Continue -> Step 2
    fireEvent.click(screen.getByRole("button", { name: "Going" }));
    expect(screen.getByRole("button", { name: "Continue →" })).toBeInTheDocument();

    // Toggling back to Maybe submits directly without Step 2
    fireEvent.click(screen.getByRole("button", { name: "Maybe" }));
    fireEvent.change(screen.getByPlaceholderText("Your name (required)"), {
      target: { value: "Maya" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Confirm RSVP" }));
    await waitFor(() => expect(screen.getByText("Noted!")).toBeInTheDocument());
  });

  it("validates and submits PHONE, international ADDRESS, and scrollable/linked TERMS", async () => {
    mockAddRSVP.mockResolvedValue({ success: true, id: "rsvp-2", editToken: "tok-2" });
    const eventWithNewFields = {
      ...baseEvent,
      rsvpFields: [
        {
          id: "q-phone",
          label: "Day-of phone",
          description: "Used only for urgent event updates.",
          fieldType: "PHONE",
          required: false,
          goingOnly: true,
          options: null,
        },
        {
          id: "q-addr",
          label: "Mailing address",
          description: null,
          fieldType: "ADDRESS",
          required: true,
          goingOnly: true,
          options: null,
        },
        {
          id: "q-terms",
          label: "Event waiver",
          description: "Read before attending.",
          fieldType: "TERMS",
          required: true,
          goingOnly: true,
          options: JSON.stringify({
            text: "Line 1\nLine 2\nBe kind and safe.",
            url: "https://example.com/waiver",
          }),
        },
      ],
    };

    render(
      <RsvpFlow
        event={eventWithNewFields}
        theme={testTheme}
        initialStatus="GOING"
        sessionUser={null}
      />
    );
    fireEvent.change(screen.getByPlaceholderText("Your name (required)"), {
      target: { value: "Sanne" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Continue →" }));

    // Terms scrollable region & external link render
    const region = screen.getByRole("region", { name: "Event waiver" });
    expect(region).toHaveTextContent("Be kind and safe.");
    expect(region.style.overflowY).toBe("auto");
    const link = screen.getByRole("link", { name: /Read full terms/ });
    expect(link).toHaveAttribute("href", "https://example.com/waiver");

    // Submitting with missing required address parts & unchecked terms focuses first invalid input
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));
    const street = screen.getByRole("textbox", { name: "Street address" });
    expect(street).toHaveAttribute("aria-invalid", "true");
    expect(street).toHaveFocus();
    expect(mockAddRSVP).not.toHaveBeenCalled();

    // Fill international address (no state/region, no country) + phone + agree to terms
    fireEvent.change(screen.getByRole("textbox", { name: /Day-of phone/ }), {
      target: { value: "+31 6 1234 5678" },
    });
    fireEvent.change(street, { target: { value: "Kerkstraat 12" } });
    fireEvent.change(screen.getByRole("textbox", { name: "City" }), {
      target: { value: "Amsterdam" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "Postal / ZIP code" }), {
      target: { value: "1017 GD" },
    });
    fireEvent.click(screen.getByRole("checkbox", { name: "I agree to Event waiver" }));
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));

    await waitFor(() =>
      expect(mockAddRSVP).toHaveBeenCalledWith(
        expect.objectContaining({
          guestName: "Sanne",
          status: "GOING",
          answers: {
            "q-phone": "+31 6 1234 5678",
            "q-addr": JSON.stringify({
              line1: "Kerkstraat 12",
              line2: "",
              city: "Amsterdam",
              region: "",
              postalCode: "1017 GD",
              country: "",
            }),
            "q-terms": "ACCEPTED",
          },
        }),
        null
      )
    );
    expect(await screen.findByText("You're in!")).toBeInTheDocument();
  });
});
