// @vitest-environment jsdom
// Root cause (#812, site-wide design review d0d5fb15, findings C1, C2, D2, A1 and A2): app
// chrome and app pages bypassed the design language.
// - The global header over event pages was a hard-coded 45% black wash, which read as a
//   gray slab on SOFT and a brown band on BOLD; the host bar painted literal dark surfaces,
//   11px labels, and changed its hover colors in JS. Decision 1 keeps chrome on the dark
//   shell, so both now read one solid `APP_SHELL.chromeSurface` and shared controls.
// - No `not-found.tsx` existed, so a missing event showed Next's unstyled default 404.
// - The dashboard wrapped six filter chips onto three rows at 375px, zero-result chips
//   included, and read "Upcoming3" to screen readers.
// - The admin users table forced a 700px width inside a 333px phone card, and the admin
//   heading's gradient-clipped text turned the title's emoji into blank boxes.
import "@/tests/helpers/english-request-locale";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@/tests/components/render";
import english from "@/messages/en-US.json";
import dutch from "@/messages/nl-NL.json";
import german from "@/messages/de-DE.json";
import spanish from "@/messages/es-ES.json";
import { APP_SHELL, resolveTheme } from "@/lib/theme";

const m = vi.hoisted(() => ({ path: "/e/party" }));
vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  usePathname: () => m.path,
}));
vi.mock("@/components/ui/LanguageSelector", () => ({ default: () => null }));
vi.mock("@/components/ui/ProfileDropdown", () => ({ default: () => null }));
vi.mock("@/app/actions/event", () => ({
  sendBlast: vi.fn(),
  sendSmsBlast: vi.fn(),
  saveEventSettings: vi.fn(),
  previewGuestInvitations: vi.fn(),
  sendGuestInvitations: vi.fn(),
}));

import GlobalHeader from "@/components/ui/GlobalHeader";
import { HostBar } from "@/components/event/HostBar";
import { DashboardClient } from "@/components/dashboard/DashboardClient";
import { UsersTab } from "@/app/(app)/admin/tabs/UsersTab";
import NotFound from "@/app/not-found";

/** The browser's own spelling of a color, so hex and rgba compare equal. */
function cssColor(value: string): string {
  const probe = document.createElement("div");
  probe.style.background = value;
  return probe.style.background;
}

const CHROME = cssColor(APP_SHELL.chromeSurface);
const EVENT = resolveTheme("SOFT", "#f9a8d4", "#c4b5fd", "#db2777");

describe("app chrome over event pages (#812, decision 1)", () => {
  beforeEach(() => {
    m.path = "/e/party";
  });

  it.each(["/e/party", "/e/party/guests", "/e/party/settings"])(
    "draws the header on %s as one solid dark chrome bar, not a wash",
    (path) => {
      m.path = path;
      const { container } = render(<GlobalHeader user={null} />);
      const nav = container.querySelector("nav")!;
      expect(nav.style.background).toBe(CHROME);
      expect(nav.style.position).toBe("fixed");
    }
  );

  it("keeps app pages on the shell's page ground", () => {
    m.path = "/dashboard";
    const { container } = render(<GlobalHeader user={null} />);
    expect(container.querySelector("nav")!.style.position).not.toBe("fixed");
  });

  it("builds the host bar from chrome tokens and the shared toolbar button", () => {
    render(<HostBar eventId="event-1" eventSlug="party" theme={EVENT} visibility="PUBLIC" />);
    const invite = screen.getByRole("button", { name: "Invite" });
    expect(invite.parentElement!.style.background).toBe(CHROME);
    // The shared hover and focus classes, not JS: hovering leaves the inline style alone.
    expect(invite.className).toContain("rsvp-press");
    expect(invite.className).toContain("rsvp-control");
    fireEvent.mouseEnter(invite);
    expect(invite.style.background).toBe("");
    expect(parseFloat(invite.style.fontSize)).toBeGreaterThanOrEqual(12);
    const settings = screen.getByRole("link", { name: "Settings" });
    expect(settings.className).toContain("rsvp-press");
  });
});

describe("missing pages (#812)", () => {
  it("renders the app-shell state page with a title, a sentence and a way back", async () => {
    render(await NotFound());
    expect(
      screen.getByRole("heading", { level: 1, name: english.Ui.Errors.NotFound.title })
    ).toBeTruthy();
    expect(screen.getByText(english.Ui.Errors.NotFound.description)).toBeTruthy();
    const home = screen.getByRole("link", { name: english.Ui.Errors.Common.home });
    expect(home.getAttribute("href")).toBe("/");
  });
});

describe("dashboard filter chips (#812)", () => {
  const upcoming = {
    id: "event-1",
    slug: "party",
    title: "Party",
    startAt: new Date(Date.now() + 86_400_000),
    status: "PUBLISHED",
    theme: null,
    going: 2,
    maybe: 0,
    pending: 0,
    isCohost: false,
    host: { name: "Alex", email: null, avatarUrl: null },
    coHosts: [],
    commentCount: 0,
    rsvpDeadline: null,
    hostDisplayName: null,
  };

  it("keeps one scrolling row and hides chips with no results", () => {
    render(
      <DashboardClient
        initialEvents={[upcoming]}
        initialInvites={[]}
        recentActivities={[]}
        userName="Alex"
        userRole="HOST"
        openRegistration={false}
      />
    );
    const d = english.Ui.Dashboard;
    const upcomingChip = screen.getByRole("button", { name: `${d.upcoming} 1` });
    expect(screen.getByRole("button", { name: `${d.hosting} 1` })).toBeTruthy();
    for (const hidden of [d.openInvite, d.attended, d.allPastEvents]) {
      expect(screen.queryByRole("button", { name: new RegExp(`^${hidden}`) })).toBeNull();
    }
    const row = upcomingChip.parentElement!;
    expect(row.style.overflowX).toBe("auto");
    expect(row.style.flexWrap).not.toBe("wrap");
  });
});

describe("admin (#812)", () => {
  it("stacks the users table instead of forcing a 700px width", () => {
    const { container } = render(
      <UsersTab
        userSearch=""
        handleUserSearch={async () => {}}
        roleFilter="ALL"
        setRoleFilter={() => {}}
        statusFilter="ALL"
        setStatusFilter={() => {}}
        setCreateUserOpen={() => {}}
        filteredUsers={[
          {
            id: "user-1",
            name: "Riley",
            email: "riley@example.test",
            phone: null,
            role: "HOST",
            createdAt: new Date("2026-01-01T00:00:00Z"),
            deletionRequestedAt: null,
            deletionScheduledAt: null,
            _count: { events: 1, rsvps: 0 },
          },
        ]}
        handleRoleChange={() => {}}
        handleCancelDeletion={() => {}}
        handleUserDeleteImmediately={() => {}}
        handleUserDelete={() => {}}
      />
    );
    expect(container.querySelector(".rsvp-table-wrap table.rsvp-table")).toBeTruthy();
    const widths = [...container.querySelectorAll<HTMLElement>("[style]")].map(
      (el) => el.style.minWidth
    );
    expect(widths).not.toContain("700px");
    const cells = container.querySelectorAll("tbody td");
    expect(cells.length).toBe(4);
    cells.forEach((cell) => expect(cell.getAttribute("data-label")).toBeTruthy());
  });

  it("keeps emoji out of the admin titles in every language", () => {
    const keys = [
      "overview2",
      "userManagement",
      "eventModeration",
      "hostSettings",
      "emailSettings",
      "smsSettings",
      "themePresets2",
      "databaseBackups",
      "documentation",
      "adminNavigation",
    ] as const;
    const emoji = /\p{Extended_Pictographic}/u;
    for (const catalog of [english, german, spanish, dutch]) {
      for (const key of keys) expect(catalog.Ui.Admin[key]).not.toMatch(emoji);
    }
  });

  it("draws app-page headings as plain text, never gradient-clipped", () => {
    const walk = (dir: string): string[] =>
      readdirSync(dir).flatMap((name) => {
        const path = join(dir, name);
        return statSync(path).isDirectory() ? walk(path) : path.endsWith(".tsx") ? [path] : [];
      });
    const clipped = walk(join(process.cwd(), "app", "(app)")).filter((file) =>
      readFileSync(file, "utf8").includes("WebkitTextFillColor")
    );
    expect(clipped).toEqual([]);
  });
});
