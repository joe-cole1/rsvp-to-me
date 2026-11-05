// @vitest-environment jsdom
// Root cause (2026-11-05, design review B-1, task d1a4521f): the floating RSVP card
// placed its docking line using the height of whichever card was on screen. The
// compact floating card is shorter than the docked card, so a slot top between the
// two lines floated while docked and docked while floating. The effect also
// depended on isFloating, so every flip re-subscribed and re-measured at once. A
// 375×812 BOLD page logged "Maximum update depth exceeded" about 177 times, and
// DARK and SOFT pages flickered while scrolling through the band.
import { Profiler } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render } from "@/tests/components/render";
import { RsvpSection } from "@/components/event/event-page/RsvpSection";
import type { EventData } from "@/components/event/event-page/types";
import { testTheme } from "@/tests/components/helpers/theme";

// Card heights measured on /e/new-years-eve-gala at 375×812.
const VIEWPORT_HEIGHT = 812;
const DOCKED_HEIGHT = 179;
const FLOATING_HEIGHT = 104;
const SLOT_HEIGHT = DOCKED_HEIGHT + 16;
// Docking lines: 812 - 12 - 179 = 621 (docked card) and 812 - 12 - 104 = 696 (floating card).
const STRADDLING_SLOT_TOP = 650;
// Stops the simulated straddle after a runaway, so a failing run ends instead of
// looping inside act() (React only warns about passive-effect update loops).
const RUNAWAY_COMMITS = 60;

const event = {
  id: "event-1",
  slug: "new-years-eve-gala",
  startAt: new Date("2099-12-31T20:00:00Z"),
  rsvpDeadline: null,
  allowEditAfterDeadline: false,
  maybeEnabled: true,
} as unknown as EventData;

let slotTop = 0;
let commits = 0;
let observersCreated = 0;
const liveObservers = new Set<{ callback: ResizeObserverCallback }>();

beforeEach(() => {
  slotTop = 0;
  commits = 0;
  observersCreated = 0;
  liveObservers.clear();

  vi.stubGlobal(
    "ResizeObserver",
    class ResizeObserverMock {
      callback: ResizeObserverCallback;
      constructor(callback: ResizeObserverCallback) {
        this.callback = callback;
        observersCreated++;
        liveObservers.add(this);
      }
      observe() {}
      unobserve() {}
      disconnect() {
        liveObservers.delete(this);
      }
    }
  );
  vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockImplementation(function (
    this: HTMLElement
  ) {
    if (!this.hasAttribute("data-rsvp-floating")) return 0;
    if (commits > RUNAWAY_COMMITS) return DOCKED_HEIGHT;
    return this.getAttribute("data-rsvp-floating") === "true" ? FLOATING_HEIGHT : DOCKED_HEIGHT;
  });
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (
    this: HTMLElement
  ) {
    const top = this.hasAttribute("data-rsvp-slot") ? slotTop : 0;
    const height = this.hasAttribute("data-rsvp-slot") ? SLOT_HEIGHT : 0;
    return {
      x: 0,
      y: top,
      top,
      bottom: top + height,
      left: 0,
      right: 343,
      width: 343,
      height,
      toJSON: () => ({}),
    };
  });
  Object.defineProperty(window, "innerHeight", { configurable: true, value: VIEWPORT_HEIGHT });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function renderCard(initialSlotTop: number) {
  slotTop = initialSlotTop;
  const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  const view = render(
    <Profiler id="rsvp" onRender={() => commits++}>
      <RsvpSection
        event={event}
        t={testTheme}
        isHost={false}
        guestEditToken={null}
        rsvpStatus={null}
        rsvpDone={false}
        rsvpApproved={true}
      />
    </Profiler>
  );
  const floating = () =>
    view.container.querySelector("[data-rsvp-floating]")?.getAttribute("data-rsvp-floating");
  const updateDepthErrors = () =>
    consoleError.mock.calls.filter((call) => String(call[0]).includes("Maximum update depth"));
  return { floating, updateDepthErrors };
}

// Layout changes reach the card through window resize and its ResizeObserver.
function relayout(nextSlotTop = slotTop) {
  slotTop = nextSlotTop;
  act(() => {
    window.dispatchEvent(new Event("resize"));
    for (const observer of [...liveObservers]) {
      observer.callback([], observer as unknown as ResizeObserver);
    }
  });
}

describe("floating RSVP card docking line (B-1)", () => {
  it("settles once when the docked and floating heights straddle the docking line", () => {
    const { floating, updateDepthErrors } = renderCard(STRADDLING_SLOT_TOP);

    expect(commits).toBeLessThanOrEqual(4);
    expect(updateDepthErrors()).toEqual([]);
    expect(floating()).toBe("true");

    relayout();
    relayout();
    const settledCommits = commits;
    relayout();
    relayout();

    expect(commits).toBe(settledCommits);
    expect(commits).toBeLessThanOrEqual(4);
    expect(floating()).toBe("true");
    expect(updateDepthErrors()).toEqual([]);
  });

  it("docks once while scrolling through the band and ignores jitter at the line", () => {
    const { floating, updateDepthErrors } = renderCard(900);
    expect(floating()).toBe("true");

    const states: (string | null | undefined)[] = [floating()];
    for (let top = 890; top >= 400; top -= 10) {
      relayout(top);
      states.push(floating());
    }
    const flips = states.filter((state, index) => index > 0 && state !== states[index - 1]);
    expect(flips).toEqual(["false"]);
    // The docked card's bottom reaches the floating card's bottom (812 - 12) at 621.
    expect(states[states.indexOf("false") - 1]).toBe("true");

    relayout(621);
    expect(floating()).toBe("false");
    for (const top of [623, 625, 628, 622, 627]) {
      relayout(top);
      expect(floating()).toBe("false");
    }
    relayout(640);
    expect(floating()).toBe("true");
    for (const top of [635, 630, 625, 622]) {
      relayout(top);
      expect(floating()).toBe("true");
    }
    relayout(621);
    expect(floating()).toBe("false");
    expect(updateDepthErrors()).toEqual([]);
  });

  it("keeps one ResizeObserver subscription across float and dock transitions", () => {
    const { floating } = renderCard(900);
    expect(floating()).toBe("true");

    relayout(500);
    expect(floating()).toBe("false");
    relayout(900);
    expect(floating()).toBe("true");
    relayout(-400);
    expect(floating()).toBe("true");
    relayout(500);
    expect(floating()).toBe("false");

    expect(observersCreated).toBe(1);
    expect(liveObservers.size).toBe(1);
  });
});
