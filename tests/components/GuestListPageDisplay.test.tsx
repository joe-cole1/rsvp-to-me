import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const mocks = vi.hoisted(() => ({
  find: vi.fn(),
  access: vi.fn(),
  filter: vi.fn<(props: { guestRsvpDisplay: unknown }) => null>(() => null),
}));
vi.mock("@/lib/db", () => ({
  db: {
    event: { findUnique: mocks.find },
    invitation: { findMany: vi.fn().mockResolvedValue([]) },
  },
}));
vi.mock("@/lib/eventAccess", () => ({ resolveEventAccess: mocks.access }));
vi.mock("@/lib/config", () => ({
  getChannelConfig: vi.fn().mockResolvedValue({ email: false, sms: false }),
}));
vi.mock("@/components/ui/AppNav", () => ({ AppTopNav: () => null }));
vi.mock("@/components/event/EventAtmosphere", () => ({ EventAtmosphere: () => null }));
vi.mock("@/components/event/GuestListFilter", () => ({ GuestListFilter: mocks.filter }));

import GuestListPage from "@/app/e/[slug]/guests/page";

const rsvp = {
  id: "going-1",
  guestName: "Going Guest",
  guestEmail: null,
  guestPhone: null,
  status: "GOING",
  approved: true,
  plusOneCount: 1,
  createdAt: new Date(),
  editToken: "token",
  note: null,
  answers: [],
  plusOneGuests: [],
  user: null,
  checkIn: null,
};
const event = {
  id: "event-1",
  title: "Party",
  slug: "party",
  status: "PUBLISHED",
  guestListVis: "ALL",
  timezone: "UTC",
  guestDeclinedList: "COLLAPSED",
  guestDeclinedCount: "CAPPED",
  rsvps: [
    rsvp,
    ...Array.from({ length: 13 }, (_, i) => ({
      ...rsvp,
      id: `no-${i}`,
      status: "NO",
      plusOneCount: 0,
    })),
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.find.mockResolvedValue(event);
  mocks.access.mockResolvedValue({
    decision: "granted",
    isHost: false,
    sessionUser: null,
    isLoggedInGuest: false,
    hasValidToken: false,
  });
});

async function renderPage() {
  render(
    await GuestListPage({
      params: Promise.resolve({ slug: "party" }),
      searchParams: Promise.resolve({}),
    })
  );
}

describe("guest list page summary", () => {
  it("caps guest counts and omits the aggregate response total", async () => {
    await renderPage();
    expect(screen.getByText("2 going · 3+ can't make it")).toBeVisible();
    expect(screen.queryByText(/14 responses|13 can't make it/)).not.toBeInTheDocument();
    expect(mocks.filter.mock.calls[0]?.[0]).toMatchObject({
      guestRsvpDisplay: { guestDeclinedList: "COLLAPSED", guestDeclinedCount: "CAPPED" },
    });
  });

  it("does not expose omitted response types through the summary", async () => {
    mocks.find.mockResolvedValue({ ...event, guestDeclinedList: "HIDDEN" });
    await renderPage();
    expect(screen.getByText("2 going")).toBeVisible();
    expect(screen.queryByText(/can't make it|responses/)).not.toBeInTheDocument();
  });

  it("always shows hosts and co-hosts exact counts and the complete total", async () => {
    mocks.access.mockResolvedValue({ decision: "granted", isHost: true, sessionUser: null });
    await renderPage();
    expect(screen.getByText("14 responses · 2 going · 13 can't make it")).toBeVisible();
  });
});
