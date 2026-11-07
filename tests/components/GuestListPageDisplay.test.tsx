import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@/tests/components/render";

const mocks = vi.hoisted(() => ({
  locale: "en-US" as "en-US" | "nl-NL",
  find: vi.fn(),
  access: vi.fn(),
  filter: vi.fn<
    (props: { guestRsvpDisplay: unknown; guestInvited: unknown; invited: unknown }) => null
  >(() => null),
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

vi.mock("@/i18n/server", async () => {
  const { createTranslator } = await import("next-intl");
  const english = (await import("@/messages/en-US.json")).default;
  const dutch = (await import("@/messages/nl-NL.json")).default;
  return {
    getRequestTranslator: async () =>
      createTranslator({
        locale: mocks.locale,
        messages: mocks.locale === "nl-NL" ? dutch : english,
      }),
  };
});
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

const invitedRsvps = ["Kai Invitee", "Lu Invitee"].map((guestName, i) => ({
  ...rsvp,
  id: `invited-${i + 1}`,
  guestName,
  guestEmail: "invitee@example.test",
  editToken: "invite-token",
  status: "INVITED",
  plusOneCount: 0,
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.locale = "en-US";
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
  it("localizes summary labels without exposing hidden exact counts", async () => {
    mocks.locale = "nl-NL";
    await renderPage();
    expect(screen.getByText("2 aanwezig · 3+ afwezig")).toBeVisible();
    expect(screen.queryByText(/13 afwezig|14 aanmeldingen/)).not.toBeInTheDocument();
  });
  it("caps guest counts and omits the aggregate response total", async () => {
    await renderPage();
    expect(screen.getByText("2 going · 3+ can't make it")).toBeVisible();
    expect(screen.queryByText(/14 responses|13 can't make it/)).not.toBeInTheDocument();
    expect(mocks.filter.mock.calls[0]?.[0]).toMatchObject({
      guestRsvpDisplay: { guestDeclinedList: "COLLAPSED", guestDeclinedCount: "CAPPED" },
    });
  });

  it("does not expose omitted response types through the summary", async () => {
    mocks.find.mockResolvedValue({
      ...event,
      guestDeclinedList: "HIDDEN",
      guestDeclinedCount: "HIDDEN",
    });
    await renderPage();
    expect(screen.getByText("2 going")).toBeVisible();
    expect(screen.queryByText(/can't make it|responses/)).not.toBeInTheDocument();
  });

  it("keeps a count in the summary when only that row's names are hidden", async () => {
    mocks.find.mockResolvedValue({ ...event, guestDeclinedList: "HIDDEN" });
    await renderPage();
    expect(screen.getByText("2 going · 3+ can't make it")).toBeVisible();
  });

  it("sends guests no invited guests while the Invited row is off", async () => {
    mocks.find.mockResolvedValue({ ...event, rsvps: [...event.rsvps, ...invitedRsvps] });
    await renderPage();
    expect(screen.queryByText(/invited/)).not.toBeInTheDocument();
    expect(mocks.filter.mock.calls[0]?.[0]).toMatchObject({ guestInvited: [], invited: [] });
  });

  it("sends guests invited names only, and counts them, when the host shows them", async () => {
    mocks.find.mockResolvedValue({
      ...event,
      guestInvitedList: "EXPANDED",
      guestInvitedCount: "EXACT",
      rsvps: [...event.rsvps, ...invitedRsvps],
    });
    await renderPage();
    expect(screen.getByText("2 going · 3+ can't make it · 2 invited")).toBeVisible();
    expect(mocks.filter.mock.calls[0]?.[0]).toMatchObject({
      guestInvited: [
        { id: "invited-1", guestName: "Kai Invitee" },
        { id: "invited-2", guestName: "Lu Invitee" },
      ],
      invited: [],
    });
    const sent = JSON.stringify(mocks.filter.mock.calls[0]?.[0].guestInvited);
    expect(sent).not.toMatch(/invitee@example\.test|invite-token/);
  });

  it("always shows hosts and co-hosts exact counts and the complete total", async () => {
    mocks.access.mockResolvedValue({ decision: "granted", isHost: true, sessionUser: null });
    await renderPage();
    expect(screen.getByText("14 responses · 2 going · 13 can't make it")).toBeVisible();
  });
});
