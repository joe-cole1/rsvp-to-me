// #850 root cause: the event activity feed offered no organizer moderation control.
// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, fireEvent, waitFor, within, cleanup } from "@/tests/components/render";
import "@testing-library/jest-dom/vitest";
import { EventPage } from "@/components/event/EventPage";
import { resolveTheme } from "@/lib/theme";
const m = vi.hoisted(() => ({ remove: vi.fn() }));
vi.mock("@/app/actions/event", () => ({ deleteComment: m.remove }));
vi.mock("@/components/event/HostBar", () => ({ HostBar: () => null }));
vi.mock("@/components/ui/CaptchaProvider", () => ({
  useCaptcha: () => ({ runWithCaptcha: vi.fn() }),
}));
import { qcEvent as event } from "@/tests/helpers/qc-event";

beforeEach(() => {
  cleanup();
  vi.clearAllMocks();
  m.remove.mockResolvedValue({ success: true, removedIds: ["comment-1", "reply-1"] });
});
const theme = (base: "DARK" | "SOFT" | "BOLD" = "DARK") =>
  resolveTheme(base, "#fce7f3", "#fef3c7", "#8b5cf6");
async function confirmRemoval(name: string) {
  fireEvent.click(screen.getByRole("button", { name }));
  const dialog = await screen.findByRole("dialog", { name: "Remove this comment?" });
  expect(
    within(dialog).getByText("This comment and all of its replies will be removed.")
  ).toBeVisible();
  fireEvent.click(within(dialog).getByRole("button", { name: "Remove" }));
}
describe("#850 comment moderation UI", () => {
  it.each(["DARK", "SOFT", "BOLD"] as const)(
    "confirms and removes the thread on %s",
    async (base) => {
      render(<EventPage event={event} isHost theme={theme(base)} />);
      await confirmRemoval("Remove comment by Alex");
      await waitFor(() => expect(screen.queryByText("Main comment")).toBeNull());
      expect(screen.queryByText("Reply comment")).toBeNull();
      expect(m.remove).toHaveBeenCalledWith("event-1", "comment-1");
    }
  );
  it("lets Cancel preserve the thread", async () => {
    render(<EventPage event={event} isHost theme={theme()} />);
    fireEvent.click(screen.getByRole("button", { name: "Remove comment by Alex" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(m.remove).not.toHaveBeenCalled();
    expect(screen.getByText("Main comment")).toBeVisible();
  });
  it("removes an individual reply while keeping its parent", async () => {
    m.remove.mockResolvedValue({ success: true, removedIds: ["reply-1"] });
    render(<EventPage event={event} isHost theme={theme()} />);
    await confirmRemoval("Remove comment by Sam");
    await waitFor(() => expect(screen.queryByText("Reply comment")).toBeNull());
    expect(screen.getByText("Main comment")).toBeVisible();
  });
  it("keeps the comment and shows an inline error when removal fails", async () => {
    m.remove.mockRejectedValue(new Error("private database details"));
    render(<EventPage event={event} isHost theme={theme()} />);
    await confirmRemoval("Remove comment by Alex");
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Could not remove this comment. Try again."
    );
    expect(screen.getByText("Main comment")).toBeVisible();
    expect(screen.queryByText("private database details")).toBeNull();
  });
  it("lets organizers moderate existing comments even when new comments are disabled", async () => {
    render(<EventPage event={{ ...event, commentsEnabled: false }} isHost theme={theme()} />);
    await confirmRemoval("Remove comment by Alex");
    await waitFor(() => expect(screen.queryByText("Main comment")).toBeNull());
  });

  it("does not show moderation controls to guests", () => {
    render(<EventPage event={event} isHost={false} theme={theme()} />);
    expect(screen.queryByRole("button", { name: /Remove comment by/ })).toBeNull();
  });
});
