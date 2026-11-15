// #850 root cause: the home feed ignored publication/privacy/time gates and
// always rendered exact counts. Capped labels also need non-numeric ICU copy.
// @vitest-environment jsdom
import "@/tests/helpers/english-request-locale";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, cleanup } from "@/tests/components/render";
import "@testing-library/jest-dom/vitest";
const m = vi.hoisted(() => ({ findMany: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: { event: { findMany: m.findMany } } }));
vi.mock("@/lib/session", () => ({ getSession: async () => null }));
vi.mock("@/components/ui/AppShell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/components/ui/UploadedImage", () => ({ default: () => null }));
import Home from "@/app/page";
import { getUpcomingPublicEvents } from "@/lib/public-events";
const now = new Date("2030-01-01");
function event(guestGoingCount: "CAPPED" | "HIDDEN" | "EXACT", count: number) {
  return {
    id: "event",
    slug: "party",
    title: "Party",
    startAt: now,
    timezone: "America/New_York",
    host: { name: "Host", email: "host@example.test", avatarUrl: null },
    theme: null,
    guestGoingCount,
    guestListVis: "ALL",
    commentsEnabled: true,
    _count: { rsvps: count, comments: 0 },
  };
}
beforeEach(() => {
  cleanup();
  vi.clearAllMocks();
});
describe("#850 public feed contract", () => {
  it("queries future published public password-free events in stable order, with approved Going counts", async () => {
    m.findMany.mockResolvedValue([event("EXACT", 2)]);
    const result = await getUpcomingPublicEvents(now);
    expect(m.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          visibility: "PUBLIC",
          status: "PUBLISHED",
          passwordHash: null,
          startAt: { gt: now },
        },
        orderBy: [{ startAt: "asc" }, { id: "asc" }],
        take: 20,
        include: expect.objectContaining({
          _count: {
            select: { rsvps: { where: { status: "GOING", approved: true } }, comments: true },
          },
        }),
      })
    );
    expect(result[0].goingLabel).toBe("2");
    expect(result[0]).not.toHaveProperty("_count");
  });
  it.each([
    ["CAPPED", 10, "3+ going"],
    ["CAPPED", 2, "2 going"],
    ["EXACT", 1, "1 going"],
  ] as const)("renders %s %s without corrupting ICU pluralization", async (mode, count, label) => {
    m.findMany.mockResolvedValue([event(mode, count)]);
    render(await Home());
    const text = screen.getByText(label);
    if (count >= 3 && mode === "CAPPED")
      expect(text).toHaveAttribute("aria-label", "3 or more going");
    expect(screen.queryByText(/NaN/)).toBeNull();
  });
  it("does not expose a hidden count in page text", async () => {
    m.findMany.mockResolvedValue([event("HIDDEN", 17)]);
    render(await Home());
    expect(screen.queryByText(/17 going/)).toBeNull();
    expect(screen.queryByText(/going$/)).toBeNull();
  });
});
