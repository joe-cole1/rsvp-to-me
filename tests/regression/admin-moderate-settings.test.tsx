// @vitest-environment jsdom
// Root cause (task 79c90196): an ADMIN who opened "Moderate" on an event they don't host
// got the host toolbar on the event page (`?admin=1`), but the host-only sub-pages ignored
// the ADMIN role. `/e/[slug]/settings` admitted only the owner and co-hosts and redirected
// everyone else to the bare event URL, dropping `?admin=1`, so the admin landed on the
// guest view. The guest list never passed the moderation flag, so a host-only list sent
// admins away too, and Preview appended `?preview=1` to a URL that already had a query.
// Once inside, RSVP options showed the admin an error for organizer alert preferences
// they don't have.
// The settings actions (assertHost/assertHostOrCohost) already accepted ADMIN. The pages
// now admit admins by their stored role, never by a URL flag, and links back to the
// event page keep the host view.
import "@/tests/helpers/english-request-locale";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@/tests/components/render";
import english from "@/messages/en-US.json";

const m = vi.hoisted(() => ({
  user: null as null | { id: string; role: "GUEST" | "HOST" | "ADMIN" },
  findEvent: vi.fn(),
  settingsProps: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT ${url}`);
  },
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined }),
}));
vi.mock("@/lib/session-user", () => ({
  getSessionUser: async () =>
    m.user ? { ...m.user, email: null, name: null, avatarUrl: null, preferredLocale: null } : null,
}));
vi.mock("@/lib/db", () => ({
  db: {
    event: { findUnique: m.findEvent },
    rSVP: { findFirst: vi.fn().mockResolvedValue(null) },
    // Host-only data: one unanswered invitation, so a host sees the list instead of
    // the empty state.
    invitation: {
      findMany: vi
        .fn()
        .mockResolvedValue([
          { id: "inv-1", sentTo: "a@example.com", channel: "EMAIL", sentAt: new Date(0) },
        ]),
    },
  },
}));
vi.mock("@/lib/config", () => ({
  getChannelConfig: vi.fn().mockResolvedValue({ email: false, sms: false }),
}));
vi.mock("@/app/actions/event", () => ({ getActiveThemePresets: vi.fn().mockResolvedValue([]) }));
vi.mock("@/lib/editor-icon-summaries", () => ({
  getEditorIconSummaries: vi.fn().mockResolvedValue([]),
}));
vi.mock("@/components/event/SettingsPage", () => ({
  SettingsPage: (props: Record<string, unknown>) => {
    m.settingsProps(props);
    return null;
  },
}));
vi.mock("@/components/notifications/NotificationPreferences", () => ({
  NotificationPreferences: () => <p>organizer preferences</p>,
}));
vi.mock("@/components/event/EventAtmosphere", () => ({ EventAtmosphere: () => null }));
vi.mock("@/components/event/GuestListFilter", () => ({
  GuestListFilter: ({ isHost }: { isHost: boolean }) => (
    <p data-testid="guest-list">{isHost ? "host view" : "guest view"}</p>
  ),
}));

import EventSettingsRoute from "@/app/e/[slug]/settings/page";
import GuestListPage from "@/app/e/[slug]/guests/page";
import { resolveEventAccess } from "@/lib/eventAccess";
import { eventPagePath, guestPreviewUrl } from "@/lib/admin-moderation";
import { RsvpOptionsPanel } from "@/components/event/settings-page/RsvpOptionsPanel";
import { resolveTheme } from "@/lib/theme";

const OWNER = "owner-1";
const COHOST = "cohost-1";

const settingsEvent = {
  id: "event-1",
  slug: "picnic",
  hostId: OWNER,
  coHosts: [{ user: { id: COHOST, name: null, email: null } }],
  theme: null,
};

const guestsEvent = {
  id: "event-1",
  title: "Picnic",
  slug: "picnic",
  hostId: OWNER,
  status: "PUBLISHED",
  visibility: "PUBLIC",
  passwordHash: null,
  guestListVis: "HOST_ONLY",
  timezone: "UTC",
  theme: null,
  coHosts: [{ userId: COHOST }],
  rsvps: [],
};

const gateEvent = {
  id: "event-1",
  visibility: "PUBLIC",
  passwordHash: null,
  hostId: OWNER,
  coHosts: [{ userId: COHOST }],
};

const props = (searchParams: Record<string, string> = {}) =>
  ({
    params: Promise.resolve({ slug: "picnic" }),
    searchParams: Promise.resolve(searchParams),
  }) as never;

async function openSettings() {
  render(await EventSettingsRoute(props()));
  return m.settingsProps.mock.calls.at(-1)?.[0] as Record<string, unknown>;
}

beforeEach(() => {
  m.user = null;
  m.findEvent.mockReset();
  m.settingsProps.mockReset();
});

describe("admin moderation reaches event settings (79c90196)", () => {
  beforeEach(() => m.findEvent.mockResolvedValue(settingsEvent));

  it("opens settings for an admin who doesn't host the event, in the co-host view", async () => {
    m.user = { id: "admin-1", role: "ADMIN" };
    const settings = await openSettings();
    expect(settings).toMatchObject({ isOwner: false, adminModerating: true });
  });

  it("keeps the owner's own view for an admin who owns or co-hosts the event", async () => {
    m.user = { id: OWNER, role: "ADMIN" };
    expect(await openSettings()).toMatchObject({ isOwner: true, adminModerating: false });
    m.user = { id: COHOST, role: "ADMIN" };
    expect(await openSettings()).toMatchObject({ isOwner: false, adminModerating: false });
  });

  it.each(["HOST", "GUEST"] as const)(
    "still sends a %s who doesn't host the event back to it",
    async (role) => {
      m.user = { id: "someone", role };
      await expect(EventSettingsRoute(props({ admin: "1" }))).rejects.toThrow("REDIRECT /e/picnic");
      expect(m.settingsProps).not.toHaveBeenCalled();
    }
  );
});

describe("RSVP options for a moderating admin (79c90196)", () => {
  const noop = () => {};
  const panel = (adminModerating: boolean) => (
    <RsvpOptionsPanel
      plusOneAllowed={false}
      setPlusOneAllowed={noop}
      plusOneMax={0}
      setPlusOneMax={noop}
      plusOneNamesRequired={false}
      setPlusOneNamesRequired={noop}
      approvalRequired={false}
      setApprovalRequired={noop}
      maybeEnabled={true}
      setMaybeEnabled={noop}
      showTimestamps={true}
      setShowTimestamps={noop}
      capacity=""
      setCapacity={noop}
      rsvpDeadline=""
      setRsvpDeadline={noop}
      allowEditAfterDeadline={false}
      setAllowEditAfterDeadline={noop}
      hostAlertEmail={true}
      setHostAlertEmail={noop}
      hostAlertSms={false}
      setHostAlertSms={noop}
      channelConfig={{ email: true, sms: false }}
      triggerSaveSettings={noop}
      eventId="event-1"
      onNotificationStatus={noop}
      adminModerating={adminModerating}
      t={resolveTheme("DARK", "#7c3aed", "#1e40af", "#a855f7")}
    />
  );
  const alertsTitle = english.Ui.Notifications.organizerTitle;

  it("shows organizers their own RSVP alert channels", () => {
    render(panel(false));
    expect(screen.queryByText(alertsTitle)).not.toBeNull();
    expect(screen.queryByText("organizer preferences")).not.toBeNull();
  });

  // The admin has no organizer preferences on the event, so the panel used to show
  // "You cannot manage these preferences." with a retry button.
  it("leaves them out for an admin, who is not an organizer, but keeps the event's alert switch", () => {
    render(panel(true));
    expect(screen.queryByText(alertsTitle)).toBeNull();
    expect(screen.queryByText("organizer preferences")).toBeNull();
    expect(screen.queryByText(english.Ui.Notifications.enableHostAlerts)).not.toBeNull();
  });
});

describe("admin moderation reaches the guest list (79c90196)", () => {
  beforeEach(() => m.findEvent.mockResolvedValue(guestsEvent));

  it("shows a host-only list to an admin, with the way back to the host view", async () => {
    m.user = { id: "admin-1", role: "ADMIN" };
    render(await GuestListPage(props()));
    expect(screen.getByTestId("guest-list").textContent).toBe("host view");
    const back = screen.getByRole("link", { name: english.Ui.Event.GuestsRoute.back });
    expect(back.getAttribute("href")).toBe("/e/picnic?admin=1");
  });

  it("keeps the plain event link for the owner", async () => {
    m.user = { id: OWNER, role: "HOST" };
    render(await GuestListPage(props()));
    const back = screen.getByRole("link", { name: english.Ui.Event.GuestsRoute.back });
    expect(back.getAttribute("href")).toBe("/e/picnic");
  });

  it("does not let a guest through a host-only list by adding ?admin=1", async () => {
    m.user = { id: "guest-1", role: "GUEST" };
    await expect(GuestListPage(props({ admin: "1" }))).rejects.toThrow("REDIRECT /e/picnic");
  });
});

describe("the ?admin=1 flag is only honoured for an ADMIN role (79c90196)", () => {
  it.each([
    ["anonymous visitor", null],
    ["guest", { id: "guest-1", role: "GUEST" as const }],
    ["host of another event", { id: "host-2", role: "HOST" as const }],
  ])("ignores the flag for a %s", async (_name, user) => {
    m.user = user;
    const access = await resolveEventAccess(gateEvent, "picnic", { admin: true });
    expect(access).toMatchObject({ isHost: false, isAdminModerating: false });
  });

  it("grants the host view to a moderating admin, but not in guest preview", async () => {
    m.user = { id: "admin-1", role: "ADMIN" };
    expect(await resolveEventAccess(gateEvent, "picnic", { admin: true })).toMatchObject({
      isHost: true,
      isAdminModerating: true,
    });
    expect(
      await resolveEventAccess(gateEvent, "picnic", { admin: true, isPreview: true })
    ).toMatchObject({ isHost: false, isAdminModerating: false });
  });

  it("does not count an admin who owns the event as moderating", async () => {
    m.user = { id: OWNER, role: "ADMIN" };
    expect(await resolveEventAccess(gateEvent, "picnic", { admin: true })).toMatchObject({
      isHost: true,
      isAdminModerating: false,
    });
  });
});

describe("moderation URLs (79c90196)", () => {
  it("returns to the event page's host view only while moderating", () => {
    expect(eventPagePath("picnic")).toBe("/e/picnic");
    expect(eventPagePath("picnic", true)).toBe("/e/picnic?admin=1");
  });

  it.each([
    ["http://localhost:3000/e/picnic", "http://localhost:3000/e/picnic?preview=1"],
    ["http://localhost:3000/e/picnic?admin=1", "http://localhost:3000/e/picnic?preview=1"],
    [
      "http://localhost:3000/e/picnic?token=abc#rsvp",
      "http://localhost:3000/e/picnic?token=abc&preview=1#rsvp",
    ],
  ])("builds a valid guest preview URL from %s", (href, expected) => {
    expect(guestPreviewUrl(href)).toBe(expected);
  });
});
