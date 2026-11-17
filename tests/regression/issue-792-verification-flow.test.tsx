// @vitest-environment jsdom
// #792 root cause: the public form saved an invited response from unproved contact text.
// Proof must be followed by review and a separate explicit final confirmation.
import "@testing-library/jest-dom/vitest";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, fireEvent, waitFor } from "@/tests/components/render";
import { testTheme } from "@/tests/components/helpers/theme";
const m = vi.hoisted(() => ({ add: vi.fn(), request: vi.fn(), verify: vi.fn() }));
vi.mock("@/app/actions/event", () => ({
  addRSVP: m.add,
  requestRsvpVerification: m.request,
  verifyRsvpVerification: m.verify,
  updateRSVP: vi.fn(),
  updateRsvpAsHost: vi.fn(),
}));
vi.mock("@/components/event/EventAtmosphere", () => ({ EventAtmosphere: () => null }));
import { RsvpFlow } from "@/components/rsvp/RsvpFlow";
const event = {
  id: "event",
  slug: "party",
  title: "Party",
  startAt: new Date("2099-01-01"),
  endAt: null,
  timezone: "UTC",
  locationName: null,
  plusOneAllowed: false,
  plusOneMax: 0,
  plusOneNamesRequired: false,
  maybeEnabled: true,
  questionnaireEnabled: false,
  rsvpFields: [],
};
const proof = { challengeId: "challenge", receipt: "receipt" };
beforeEach(() => {
  vi.clearAllMocks();
  m.request.mockResolvedValue({ success: true, challengeId: proof.challengeId });
  m.verify.mockResolvedValue({ success: true, proof });
  m.add.mockResolvedValue({ success: true, id: "saved", editToken: "saved-token" });
});
afterEach(cleanup);
function open(phone = false) {
  render(<RsvpFlow event={event} theme={testTheme} />);
  fireEvent.change(screen.getByRole("textbox", { name: "Your name (required)" }), {
    target: { value: "Alice" },
  });
  fireEvent.change(screen.getByRole("textbox", { name: /Email/ }), {
    target: { value: "alice@example.com" },
  });
  if (phone)
    fireEvent.change(screen.getByRole("textbox", { name: /Phone/ }), {
      target: { value: "+1 (555) 123-4567" },
    });
  fireEvent.click(screen.getByRole("button", { name: "Confirm RSVP" }));
}
async function verifyContact() {
  fireEvent.click(await screen.findByRole("button", { name: "Send code" }));
  const code = await screen.findByRole("textbox", { name: "Verification code" });
  expect(code).toHaveFocus();
  expect(code).toHaveAttribute("autocomplete", "one-time-code");
  fireEvent.change(code, { target: { value: "12345678" } });
  await waitFor(() => expect(screen.getByRole("button", { name: "Verify code" })).toBeEnabled());
  fireEvent.click(screen.getByRole("button", { name: "Verify code" }));
}
describe("#792 public RSVP verification and review", () => {
  it("reveals no private link and saves nothing until proof and final confirmation", async () => {
    open();
    expect(screen.getByRole("heading", { name: "Verify your contact to continue" })).toBeVisible();
    expect(m.add).not.toHaveBeenCalled();
    expect(m.request).not.toHaveBeenCalled();
    await verifyContact();
    expect(
      await screen.findByText("Contacts verified. Review your response, then confirm your RSVP.")
    ).toBeVisible();
    expect(m.add).not.toHaveBeenCalled();
    expect(screen.queryByRole("link", { name: "Keep your private RSVP edit link" })).toBeNull();
    expect(screen.getByRole("textbox", { name: "Your name (required)" })).toHaveValue("Alice");
    fireEvent.click(await screen.findByRole("button", { name: "Confirm RSVP" }));
    await screen.findByText("You're in!");
    expect(m.add).toHaveBeenCalledWith(
      expect.objectContaining({ eventId: "event", guestEmail: "alice@example.com" }),
      null,
      [proof]
    );
  });
  it("requires both contacts and resets proof when a contact changes", async () => {
    open(true);
    await verifyContact();
    await screen.findByText("+15551234567");
    expect(m.add).not.toHaveBeenCalled();
    await verifyContact();
    await screen.findByText(/Contacts verified/);
    expect(m.request).toHaveBeenNthCalledWith(
      2,
      { eventId: "event", channel: "sms", destination: "+15551234567" },
      null
    );
    fireEvent.change(screen.getByRole("textbox", { name: /Email/ }), {
      target: { value: "different@example.com" },
    });
    fireEvent.click(await screen.findByRole("button", { name: "Confirm RSVP" }));
    expect(screen.getByRole("heading", { name: "Verify your contact to continue" })).toBeVisible();
    expect(m.add).not.toHaveBeenCalled();
  });
  it("announces invalid codes, enforces resend cooldown, and keeps the RSVP unsaved", async () => {
    m.verify.mockResolvedValue({ success: false, error: "Invalid code" });
    open();
    await verifyContact();
    expect(await screen.findByRole("alert")).toHaveTextContent("Invalid code");
    expect(screen.getByRole("button", { name: /Resend in/ })).toBeDisabled();
    expect(m.add).not.toHaveBeenCalled();
  });
  it("returns to verification when a receipt expires before final save", async () => {
    m.add.mockResolvedValue({
      success: false,
      error: "Verify contacts",
      verificationRequired: true,
    });
    open();
    await verifyContact();
    await screen.findByText(/Contacts verified/);
    fireEvent.click(await screen.findByRole("button", { name: "Confirm RSVP" }));
    await screen.findByText("Verify contacts");
    fireEvent.click(await screen.findByRole("button", { name: "Confirm RSVP" }));
    expect(screen.getByRole("heading", { name: "Verify your contact to continue" })).toBeVisible();
  });
  it("announces delivery failures without showing invitation data", async () => {
    m.request.mockResolvedValue({ success: false, error: "Verification unavailable" });
    open();
    fireEvent.click(screen.getByRole("button", { name: "Send code" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Verification unavailable");
    expect(m.add).not.toHaveBeenCalled();
  });
  it("returns questionnaire submissions to their details for review and retains answers", async () => {
    render(
      <RsvpFlow
        event={{
          ...event,
          rsvpFields: [
            { id: "food", label: "Food", fieldType: "TEXT", required: true, options: null },
          ],
        }}
        theme={testTheme}
      />
    );
    fireEvent.change(screen.getByRole("textbox", { name: "Your name (required)" }), {
      target: { value: "Alice" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: /Email/ }), {
      target: { value: "alice@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Continue →" }));
    fireEvent.change(screen.getByRole("textbox", { name: /Food/ }), { target: { value: "Salad" } });
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));
    await verifyContact();
    await screen.findByText(/Contacts verified/);
    expect(screen.getByRole("textbox", { name: "Your name (required)" })).toHaveValue("Alice");
    expect(m.add).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByRole("button", { name: "Continue →" }));
    expect(screen.getByRole("textbox", { name: /Food/ })).toHaveValue("Salad");
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));
    await waitFor(() =>
      expect(m.add).toHaveBeenCalledWith(
        expect.objectContaining({ answers: { food: "Salad" } }),
        null,
        [proof]
      )
    );
  });
});
