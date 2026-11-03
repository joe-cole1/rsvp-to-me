import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@/tests/components/render";
import { EventPage } from "@/components/event/EventPage";
import { NotificationDeliveryFeedback } from "@/components/event/event-page/NotificationDeliveryFeedback";
import type { EventData } from "@/components/event/event-page/types";
import { testTheme } from "./helpers/theme";

const mocks = vi.hoisted(() => ({ post: vi.fn() }));
vi.mock("@/app/actions/event", () => ({ addEventUpdate: mocks.post }));
vi.mock("@/components/event/HostBar", () => ({ HostBar: () => null }));
vi.mock("@/components/ui/CaptchaProvider", () => ({
  useCaptcha: () => ({
    runWithCaptcha: async (_action: string, operation: (token: string) => Promise<unknown>) =>
      operation("fixture-captcha"),
  }),
}));

const event: EventData = {
  id: "event-1",
  slug: "party",
  title: "Party",
  description: null,
  startAt: new Date("2026-12-01T18:00:00Z"),
  endAt: null,
  timezone: "UTC",
  locationType: "TBD",
  locationName: null,
  locationAddress: null,
  virtualUrl: null,
  commentsEnabled: true,
  plusOneAllowed: false,
  plusOneMax: 1,
  plusOneNamesRequired: false,
  guestSharingEnabled: false,
  guestsCanInvite: false,
  approvalRequired: false,
  maybeEnabled: true,
  questionnaireEnabled: false,
  showTimestamps: true,
  guestListVis: "ALL",
  visibility: "PUBLIC",
  hostDisplayName: null,
  allowEditAfterDeadline: false,
  host: { id: "host-1", name: "Host", email: "host@example.com" },
  coHosts: [],
  theme: null,
  infoSections: [],
  rsvps: [],
  comments: [],
  rsvpFields: [],
  updates: [],
  potluckItems: [],
  rsvpDeadline: null,
  pendingRsvps: [],
  activityEvents: [],
  polls: [],
};
beforeEach(() => {
  vi.clearAllMocks();
  mocks.post.mockResolvedValue({
    success: true,
    id: "update-1",
    createdAt: new Date(),
    notifications: {
      status: "completed",
      summary: { accepted: 2, skipped: 1, failed: 1, uncertain: 0 },
    },
  });
});

describe("event-update delivery feedback", () => {
  it("keeps a successfully posted update and displays partial notification results", async () => {
    render(<EventPage event={event} isHost theme={testTheme} />);
    fireEvent.change(
      screen.getByPlaceholderText("Changed start time, new location, what to bring…"),
      { target: { value: "New time is 7pm" } }
    );
    fireEvent.click(screen.getByRole("button", { name: "Post" }));
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        "2 accepted, 1 skipped, 1 failed, 0 uncertain"
      )
    );
    expect(screen.getByText("New time is 7pm")).toBeVisible();
    expect(mocks.post).toHaveBeenCalledWith("event-1", "New time is 7pm", true, "fixture-captcha");
    expect(screen.getByRole("status")).not.toHaveTextContent("host@example.com");
  });

  it("still displays the posted update when notification processing fails", async () => {
    mocks.post.mockResolvedValue({
      success: true,
      id: "update-1",
      createdAt: new Date(),
      notifications: { status: "failed" },
    });
    render(<EventPage event={event} isHost theme={testTheme} />);
    fireEvent.change(
      screen.getByPlaceholderText("Changed start time, new location, what to bring…"),
      { target: { value: "Bring a coat" } }
    );
    fireEvent.click(screen.getByRole("button", { name: "Post" }));
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        "Update posted. Notifications could not be processed."
      )
    );
    expect(screen.getByText("Bring a coat")).toBeVisible();
  });

  it("does not show notification feedback for posts with notification disabled", async () => {
    mocks.post.mockResolvedValue({
      success: true,
      id: "update-1",
      createdAt: new Date(),
      notifications: null,
    });
    render(<EventPage event={event} isHost theme={testTheme} />);
    fireEvent.click(screen.getByRole("checkbox", { name: "Notify guests of update" }));
    fireEvent.change(
      screen.getByPlaceholderText("Changed start time, new location, what to bring…"),
      { target: { value: "See you there" } }
    );
    fireEvent.click(screen.getByRole("button", { name: "Post" }));
    await waitFor(() => expect(screen.getByText("See you there")).toBeVisible());
    expect(mocks.post).toHaveBeenCalledWith("event-1", "See you there", false, "fixture-captcha");
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("warns about duplicates when acceptance is uncertain", () => {
    render(
      <NotificationDeliveryFeedback
        feedback={{
          status: "completed",
          summary: { accepted: 0, skipped: 0, failed: 0, uncertain: 1 },
        }}
      />
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "Retrying could send duplicate notifications"
    );
    expect(screen.getByRole("status")).not.toHaveTextContent("delivery is confirmed");
  });
});
