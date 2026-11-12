// @vitest-environment jsdom
// Root cause (#812, site-wide design review d0d5fb15, finding L1): the guest list page drew
// its own 22px title in the card's `textPrimary` and the body font, on the page ground. On
// BOLD that ignored the hero ink chosen against the gradient (and its scrim), and on every
// theme it dropped the event's heading font, so the event read differently from its own
// page. Its document title was the generic "Event invitation" even for public events. The
// page now shares the event hero's title block, and its title is "Guest list · Event" only
// where the event's link preview would show the title too.
import "@/tests/helpers/english-request-locale";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@/tests/components/render";
import english from "@/messages/en-US.json";
import { resolveTheme } from "@/lib/theme";

const m = vi.hoisted(() => ({ find: vi.fn(), access: vi.fn() }));
vi.mock("@/lib/db", () => ({
  db: {
    event: { findUnique: m.find },
    invitation: { findMany: vi.fn().mockResolvedValue([]) },
  },
}));
vi.mock("@/lib/eventAccess", () => ({ resolveEventAccess: m.access }));
vi.mock("@/lib/config", () => ({
  getChannelConfig: vi.fn().mockResolvedValue({ email: false, sms: false }),
}));
vi.mock("@/components/event/EventAtmosphere", () => ({ EventAtmosphere: () => null }));
vi.mock("@/components/event/GuestListFilter", () => ({ GuestListFilter: () => null }));

import GuestListPage, { generateMetadata } from "@/app/e/[slug]/guests/page";

const props = {
  params: Promise.resolve({ slug: "summer" }),
  searchParams: Promise.resolve({}),
} as never;

// Summer Vibes-style light gradient: the hero ink is the dark stone, not the card's text.
const theme = {
  baseTheme: "BOLD" as const,
  gradientFrom: "#fde68a",
  gradientTo: "#fca5a5",
  accentColor: "#ea580c",
  cardOpacity: null,
  fontId: "pacifico",
  effectId: null,
};

const event = {
  id: "event-1",
  title: "Summer party",
  slug: "summer",
  status: "PUBLISHED",
  visibility: "PUBLIC",
  passwordHash: null,
  guestListVis: "ALL",
  timezone: "UTC",
  theme,
  rsvps: [],
};

function cssColor(value: string): string {
  const probe = document.createElement("div");
  probe.style.color = value;
  return probe.style.color;
}

describe("guest list title (#812)", () => {
  beforeEach(() => {
    m.find.mockReset();
    m.access.mockResolvedValue({
      isHost: false,
      isLoggedInGuest: false,
      hasValidToken: false,
      decision: "granted",
    });
  });

  it("shares the event hero's title block: heading font and hero ink", async () => {
    m.find.mockResolvedValue(event);
    render(await GuestListPage(props));
    const t = resolveTheme(
      theme.baseTheme,
      theme.gradientFrom,
      theme.gradientTo,
      theme.accentColor,
      theme.cardOpacity,
      theme.fontId
    );
    const title = screen.getByRole("heading", { level: 1, name: "Summer party" });
    expect(title.style.fontFamily).toBe(t.headingFont);
    expect(title.style.color).toBe(cssColor(t.heroText));
    expect(title.style.color).not.toBe(cssColor(t.textPrimary));
  });

  // Absolute: the event layout's own title keeps the root template from this child route.
  it("names the page, the event and the site in the document title", async () => {
    m.find.mockResolvedValue(event);
    const page = english.Ui.Event.GuestsRoute.title;
    expect((await generateMetadata(props)).title).toEqual({
      absolute: `${page} · Summer party | RSVP to Me`,
    });
  });

  it.each([
    ["a private event", { visibility: "PRIVATE" }],
    ["a password-protected event", { passwordHash: "hash" }],
    ["a draft", { status: "DRAFT" }],
  ])("keeps the title of %s out of the document title", async (_name, override) => {
    m.find.mockResolvedValue({ ...event, ...override });
    expect((await generateMetadata(props)).title).toEqual({
      absolute: `${english.Ui.Event.GuestsRoute.title} | RSVP to Me`,
    });
  });
});
