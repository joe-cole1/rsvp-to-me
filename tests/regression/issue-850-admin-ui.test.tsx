// #850 root cause: admin lists fetched every row and filtered roles/statuses
// locally. Pagination must fetch the selected page/filter and ignore stale reads.
// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@/tests/components/render";
import AdminClient from "@/app/(app)/admin/AdminClient";
const m = vi.hoisted(() => ({ users: vi.fn(), events: vi.fn() }));
vi.mock("@/app/actions/admin", () => ({ getAdminUsers: m.users, getAdminEvents: m.events }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams("tab=users"),
}));
const user = (name: string) => ({
  id: name,
  name,
  email: `${name}@example.test`,
  phone: null,
  role: "GUEST" as const,
  createdAt: new Date(),
  deletionRequestedAt: null,
  deletionScheduledAt: null,
  _count: { events: 0, rsvps: 0 },
});
const props = {
  initialStats: {
    totalUsers: 50,
    totalEvents: 0,
    totalRsvps: 0,
    totalCheckIns: 0,
    totalInviteCodes: 0,
  },
  initialUsers: { items: [user("First")], page: 1, hasMore: true },
  initialEvents: { items: [], page: 1, hasMore: false },
  initialInviteCodes: [],
  initialConfig: {},
  initialBackupConfig: { backup_schedule: "", backup_keep_count: 7, last_backup_time: "" },
  initialBackups: [],
  initialThemePresets: [],
  initialDocs: [],
  sessionUser: null,
};
beforeEach(() => {
  cleanup();
  vi.clearAllMocks();
  m.users.mockResolvedValue(props.initialUsers);
  m.events.mockResolvedValue(props.initialEvents);
});
describe("#850 admin pagination UI", () => {
  it("loads subsequent pages and resets page when a filter changes", async () => {
    render(<AdminClient {...props} />);
    await waitFor(() =>
      expect(m.users).toHaveBeenLastCalledWith("", 1, { role: "ALL", status: "ACTIVE" })
    );
    await waitFor(() => expect(screen.getByRole("button", { name: "Next" })).toBeEnabled());
    m.users.mockResolvedValue({ items: [user("Second")], page: 2, hasMore: false });
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    await waitFor(() =>
      expect(m.users).toHaveBeenLastCalledWith("", 2, { role: "ALL", status: "ACTIVE" })
    );
    expect(await screen.findByText("Second")).toBeVisible();
    m.users.mockResolvedValue({
      items: [{ ...user("Filtered host"), role: "HOST" }],
      page: 1,
      hasMore: false,
    });
    fireEvent.change(screen.getAllByRole("combobox", { name: "Role" })[0], {
      target: { value: "HOST" },
    });
    await waitFor(() =>
      expect(m.users).toHaveBeenLastCalledWith("", 1, { role: "HOST", status: "ACTIVE" })
    );
    expect(await screen.findByText("Filtered host")).toBeVisible();
  });
  it("ignores an older search response arriving after a newer one", async () => {
    render(<AdminClient {...props} />);
    await screen.findByText("First");
    let finishOld!: (value: typeof props.initialUsers) => void;
    m.users.mockImplementation((query: string) =>
      query === "old"
        ? new Promise((resolve) => {
            finishOld = resolve;
          })
        : Promise.resolve({ items: [user("Newest")], page: 1, hasMore: false })
    );
    const search = screen.getByRole("textbox", { name: /Search users/ });
    fireEvent.change(search, { target: { value: "old" } });
    await waitFor(() => expect(finishOld).toBeTypeOf("function"));
    fireEvent.change(search, { target: { value: "new" } });
    expect(await screen.findByText("Newest")).toBeVisible();
    finishOld({ items: [user("Stale")], page: 1, hasMore: false });
    await waitFor(() => expect(screen.queryByText("Stale")).toBeNull());
  });
  it("shows a retryable error when fetching fails", async () => {
    m.users.mockRejectedValueOnce(new Error("private error"));
    render(<AdminClient {...props} />);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Could not load this list. Try again."
    );
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("First")).toBeVisible();
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
  });
});
