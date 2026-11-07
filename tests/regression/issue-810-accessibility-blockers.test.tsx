// #810 (and #795), found in the 2026-11-05 site-wide design review: hosts' edit pencils
// on the event page were clickable SVGs with no name or keyboard access, the "N others"
// co-host trigger and the settings breadcrumb were clickable spans, and destructive
// actions in the guest list and admin used the browser's confirm()/alert(), which can't
// be labeled, themed or styled and block the page.
//
// Root cause: there was no shared confirm dialog, so call sites reached for the native
// one, and hero controls were built from bare icons instead of the shared Button.
//
// Fix: `useConfirm()` in components/ui/ConfirmDialog.tsx (built on Dialog), Icon
// buttons with names for the pencils, and real buttons for the other triggers.

// @vitest-environment jsdom
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import React from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@/tests/components/render";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { testTheme } from "@/tests/components/helpers/theme";
import type { EventData } from "@/components/event/event-page/types";

const mocks = vi.hoisted(() => ({ deleteRsvpAsHost: vi.fn() }));

vi.mock("@/app/actions/event", () => ({
  addWalkIn: vi.fn(),
  approveRsvp: vi.fn(),
  checkInRsvp: vi.fn(),
  declineRsvp: vi.fn(),
  deleteInvitationAsHost: vi.fn(),
  deleteRsvpAsHost: mocks.deleteRsvpAsHost,
  previewGuestInvitations: vi.fn(),
  sendGuestInvitations: vi.fn(),
  undoCheckIn: vi.fn(),
}));
vi.mock("next/image", () => ({ default: () => null }));

import { GuestListFilter } from "@/components/event/GuestListFilter";
import { EventHero } from "@/components/event/event-page/EventHero";

const ROOT = path.resolve(__dirname, "../..");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return name === "generated" ? [] : sourceFiles(full);
    return /\.tsx?$/.test(name) ? [full] : [];
  });
}

describe("#810 accessibility blockers", () => {
  beforeEach(() => vi.clearAllMocks());

  it("never calls the browser's confirm(), alert() or prompt()", () => {
    // `useConfirm()` is called with an options object; the native dialogs take a string.
    const native = /(?<![\w.$])(?:window\.)?(?:confirm|alert|prompt)\(\s*(?!\{)/;
    const offenders = ["app", "components"]
      .flatMap((dir) => sourceFiles(path.join(ROOT, dir)))
      .flatMap((file) =>
        readFileSync(file, "utf8")
          .split("\n")
          .map((line, i) => ({ line: line.trim(), at: `${path.relative(ROOT, file)}:${i + 1}` }))
          .filter(({ line }) => !line.startsWith("//") && !line.startsWith("*"))
          .filter(({ line }) => native.test(line))
          .map(({ at }) => at)
      );
    expect(offenders).toEqual([]);
  });

  it("confirms a guest-list removal in the shared dialog, not window.confirm", async () => {
    const nativeConfirm = vi.spyOn(window, "confirm");
    mocks.deleteRsvpAsHost.mockResolvedValue({ success: true });
    render(
      <GuestListFilter
        going={[
          {
            id: "rsvp-1",
            guestName: "Alice",
            guestEmail: "alice@example.com",
            guestPhone: null,
            status: "GOING" as const,
            plusOneCount: 0,
            note: null,
            createdAt: "2026-07-10T18:00:00.000Z",
            answers: [],
            plusOneGuests: [],
            editToken: "token-1",
            user: null,
            checkIn: null,
          },
        ]}
        maybe={[]}
        no={[]}
        invited={[]}
        isHost
        eventId="event-1"
        slug="party"
        timezone="America/New_York"
        channelConfig={{ email: true, sms: true }}
        t={testTheme}
      />
    );

    fireEvent.click(screen.getAllByRole("button", { name: /remove/i })[0]);
    const dialog = screen.getByRole("dialog", { name: "Remove this RSVP?" });
    expect(mocks.deleteRsvpAsHost).not.toHaveBeenCalled();

    await act(async () => {
      fireEvent.click(within(dialog).getByRole("button", { name: "Remove" }));
    });
    await waitFor(() => expect(mocks.deleteRsvpAsHost).toHaveBeenCalledWith("rsvp-1"));
    expect(nativeConfirm).not.toHaveBeenCalled();
  });

  it("gives the hero's host controls names and keyboard access", () => {
    const titleRef = React.createRef<HTMLSpanElement>();
    const event = {
      id: "event-1",
      slug: "party",
      title: "Party",
      description: "Details",
      startAt: new Date("2030-12-01T20:00:00Z"),
      endAt: null,
      timezone: "America/New_York",
      locationType: "PHYSICAL",
      locationName: "My House",
      locationAddress: "123 Main St",
      virtualUrl: null,
      host: { name: "Host User", email: "host@example.com" },
      theme: { coverImageUrl: null, baseTheme: "DARK" },
      coHosts: [
        { id: "c1", displayName: "Bo", user: { name: "Bo", email: "bo@example.com" } },
        { id: "c2", displayName: "Cy", user: { name: "Cy", email: "cy@example.com" } },
      ],
    } as unknown as EventData;

    render(
      <EventHero
        event={event}
        setEvent={vi.fn()}
        detailsRef={React.createRef<HTMLSpanElement>()}
        titleRef={titleRef}
        fileInputRef={React.createRef<HTMLInputElement>()}
        renderAvatar={(name) => <span>{name[0]}</span>}
        isUploading={false}
        isPending={false}
        t={testTheme}
        save={vi.fn()}
        uploadStatus="idle"
        handleCoverRemove={vi.fn()}
        handleCoverUpload={vi.fn()}
        isHost
        coverUploadEnabled={false}
      />
    );

    expect(screen.getByRole("button", { name: "Edit description" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Edit date and time" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Edit location" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Edit title" }));
    expect(screen.getByRole("textbox", { name: "Event title" })).toBeTruthy();

    const others = screen.getByRole("button", { name: "2 others" });
    expect(others.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(others);
    expect(others.getAttribute("aria-expanded")).toBe("true");
    fireEvent.keyDown(window, { key: "Escape" });
    expect(others.getAttribute("aria-expanded")).toBe("false");
  });
});
