// @vitest-environment jsdom
// #566 follow-up (November 2026): successful deletion used document navigation,
// bypassing the App Router. Keep confirmation/error handling while navigating
// through the router only after the server confirms deletion.
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@/tests/components/render";
import { APP_SHELL_THEME } from "@/lib/theme";

const m = vi.hoisted(() => ({ deleteEvent: vi.fn(), push: vi.fn() }));
vi.mock("@/app/actions/event", () => ({ deleteEvent: m.deleteEvent }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: m.push }) }));
import { DangerZonePanel } from "@/components/event/settings-page/DangerZonePanel";

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

function confirmDeletion() {
  render(<DangerZonePanel eventId="event-566" t={APP_SHELL_THEME} />);
  fireEvent.click(screen.getByRole("button", { name: /delete event/i }));
  expect(screen.getByRole("button", { name: "Confirm Delete" })).toBeDisabled();
  fireEvent.change(screen.getByRole("textbox", { name: "DELETE" }), {
    target: { value: "DELETE" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Confirm Delete" }));
}

describe("#566 event deletion navigation", () => {
  it("uses the App Router to return to the dashboard after successful deletion", async () => {
    m.deleteEvent.mockResolvedValueOnce({ success: true });
    confirmDeletion();
    await waitFor(() => expect(m.push).toHaveBeenCalledWith("/dashboard"));
    expect(m.deleteEvent).toHaveBeenCalledWith("event-566");
    expect(m.push).toHaveBeenCalledTimes(1);
  });

  it.each(["unsuccessful", "rejected"])(
    "keeps the confirmation open and does not navigate after an %s deletion",
    async (failure) => {
      if (failure === "rejected") m.deleteEvent.mockRejectedValueOnce(new Error("Try again"));
      else m.deleteEvent.mockResolvedValueOnce({ success: false });
      confirmDeletion();
      expect(await screen.findByRole("alert")).toHaveTextContent(
        failure === "rejected" ? "Try again" : "Failed to delete event"
      );
      expect(screen.getByRole("dialog")).toBeVisible();
      expect(m.push).not.toHaveBeenCalled();
    }
  );
});
