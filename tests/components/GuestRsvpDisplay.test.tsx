import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { testTheme } from "./helpers/theme";
import { GuestListSection } from "@/components/event/event-page/GuestListSection";
import type { EventData } from "@/components/event/event-page/types";
import { GuestRsvpDisplaySettings } from "@/components/event/settings-page/GuestRsvpDisplaySettings";
import { buildStyles } from "@/components/event/settings-page/styles";
import { guestRsvpDisplayFields, type GuestRsvpDisplayFields } from "@/lib/guestRsvpDisplay";

vi.mock("@/app/actions/event", () => ({
  addWalkIn: vi.fn(),
  approveRsvp: vi.fn(),
  checkInRsvp: vi.fn(),
  declineRsvp: vi.fn(),
  deleteInvitationAsHost: vi.fn(),
  deleteRsvpAsHost: vi.fn(),
  inviteGuest: vi.fn(),
  undoCheckIn: vi.fn(),
}));
vi.mock("next/image", () => ({ default: () => null }));

import { GuestListFilter } from "@/components/event/GuestListFilter";

const going = [
  {
    id: "going-1",
    guestName: "Going Guest",
    status: "GOING" as const,
    plusOneCount: 1,
    note: null,
    createdAt: new Date("2026-09-20T18:00:00Z"),
  },
];
const maybe = [
  {
    ...going[0],
    id: "maybe-1",
    guestName: "Maybe Guest",
    status: "MAYBE" as const,
    plusOneCount: 0,
  },
];
const no = Array.from({ length: 13 }, (_, i) => ({
  ...going[0],
  id: `no-${i}`,
  guestName: `Declined Guest ${i}`,
  status: "NO" as const,
  plusOneCount: 0,
}));
const preferences = guestRsvpDisplayFields({
  guestDeclinedList: "COLLAPSED",
  guestDeclinedCount: "HIDDEN",
});

function renderCard(fields = preferences, isHost = false, guestListVis = "ALL") {
  const event = {
    ...fields,
    slug: "party",
    guestListVis,
    rsvps: [...going, ...maybe, ...no],
  } as EventData;
  return render(
    <GuestListSection
      event={event}
      isHost={isHost}
      going={going}
      maybe={maybe}
      no={no}
      totalGoing={2}
      renderAvatar={() => null}
      t={testTheme}
    />
  );
}

function renderFullList(fields = preferences, isHost = false) {
  const serialize = (r: (typeof going)[number] | (typeof maybe)[number] | (typeof no)[number]) => ({
    ...r,
    createdAt: r.createdAt.toISOString(),
    guestEmail: null,
    guestPhone: null,
    answers: [],
    plusOneGuests: [],
    editToken: "",
    checkIn: null,
  });
  return render(
    <GuestListFilter
      going={going.map(serialize)}
      maybe={maybe.map(serialize)}
      no={no.map(serialize)}
      invited={[]}
      isHost={isHost}
      guestRsvpDisplay={fields}
      eventId="event-1"
      slug="party"
      timezone="UTC"
      channelConfig={{ email: false, sms: false }}
      t={testTheme}
    />
  );
}

describe("guest-facing RSVP display", () => {
  it("starts declines collapsed and opens names without revealing a hidden count", () => {
    const { container } = renderCard();
    expect(screen.getByText("Going · 2")).toBeVisible();
    expect(screen.getByText("Guests")).toBeVisible();
    expect(screen.queryByText("Guests (15)")).not.toBeInTheDocument();
    expect(screen.getByText("Declined Guest 0")).not.toBeVisible();
    fireEvent.click(container.querySelector("summary")!);
    expect(screen.getByText("Declined Guest 0")).toBeVisible();
    expect(screen.queryByText("Can't make it · 13")).not.toBeInTheDocument();
  });

  it("lets each response type independently collapse or disappear", () => {
    const { container } = renderCard({
      ...preferences,
      guestGoingList: "COLLAPSED",
      guestGoingCount: "HIDDEN",
      guestMaybeList: "HIDDEN",
      guestDeclinedList: "HIDDEN",
    });
    expect(screen.getByText("Going Guest +1")).not.toBeVisible();
    expect(screen.queryByText("Maybe Guest")).not.toBeInTheDocument();
    expect(screen.queryByText("Declined Guest 0")).not.toBeInTheDocument();
    fireEvent.click(container.querySelector("summary")!);
    expect(screen.getByText("Going Guest +1")).toBeVisible();
  });

  it("always expands every list and shows exact counts for the host/co-host role", () => {
    const { container } = renderCard(
      {
        ...preferences,
        guestGoingList: "HIDDEN",
        guestMaybeList: "HIDDEN",
        guestDeclinedList: "HIDDEN",
        guestDeclinedCount: "CAPPED",
      },
      true
    );
    expect(screen.getByText("Guests (15)")).toBeVisible();
    expect(screen.getByText("Going · 2")).toBeVisible();
    expect(screen.getByText("Maybe · 1")).toBeVisible();
    expect(screen.getByText("Can't make it · 13")).toBeVisible();
    expect(screen.getByText("Declined Guest 0")).toBeVisible();
    expect(container.querySelector("details")).toBeNull();
  });

  it.each(["HOST_ONLY", "GUESTS_ONLY"])(
    "keeps the event-card visibility gate for %s",
    (visibility) => {
      renderCard(guestRsvpDisplayFields(), false, visibility);
      expect(screen.queryByText("Going Guest +1")).not.toBeInTheDocument();
    }
  );

  it("keeps collapsed names out of All until the guest selects that response", () => {
    renderFullList({ ...preferences, guestDeclinedCount: "CAPPED" });
    expect(screen.queryByText("Declined Guest 0")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "All" })).toBeVisible();
    const declined = screen.getByRole("button", { name: "Can't make it 3+" });
    fireEvent.click(declined);
    expect(screen.getByText("Declined Guest 0")).toBeVisible();
    expect(declined).toHaveTextContent("3+");
    fireEvent.click(screen.getByRole("button", { name: "All" }));
    expect(screen.queryByText("Declined Guest 0")).not.toBeInTheDocument();
  });

  it("removes omitted response types from the guest filters and cards", () => {
    renderFullList({ ...preferences, guestMaybeList: "HIDDEN", guestDeclinedList: "HIDDEN" });
    expect(screen.queryByRole("button", { name: /Maybe|Can't make it/ })).not.toBeInTheDocument();
    expect(screen.queryByText("Maybe Guest")).not.toBeInTheDocument();
    expect(screen.queryByText("Declined Guest 0")).not.toBeInTheDocument();
  });

  it("preserves exact host management counts and names despite guest preferences", () => {
    renderFullList({ ...preferences, guestMaybeList: "HIDDEN", guestDeclinedList: "HIDDEN" }, true);
    expect(screen.getByRole("button", { name: "All 15" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Can't make it 13" })).toBeVisible();
    expect(screen.getByText("Declined Guest 0")).toBeVisible();
    expect(screen.getByText("Maybe Guest")).toBeVisible();
  });
});

describe("grouped guest display settings", () => {
  function Settings({ hostOnly = false }: { hostOnly?: boolean }) {
    const [value, setValue] = useState(preferences);
    return (
      <GuestRsvpDisplaySettings
        value={value}
        onChange={(update: Partial<GuestRsvpDisplayFields>) =>
          setValue((old) => ({ ...old, ...update }))
        }
        guestListVis={hostOnly ? "HOST_ONLY" : "ALL"}
        t={testTheme}
        S={buildStyles(testTheme)}
      />
    );
  }

  it("explains the guest-only scope and groups separate name/count controls by response", () => {
    render(<Settings />);
    expect(
      screen.getByText("Hosts and co-hosts always see all names and exact counts.")
    ).toBeVisible();
    for (const label of ["Going", "Maybe", "Can't make it"]) {
      const group = within(screen.getByRole("group", { name: label }));
      expect(group.getAllByRole("combobox")).toHaveLength(2);
      expect(group.getByText("Guest preview · example responses")).toBeVisible();
    }
    expect(
      within(screen.getByRole("group", { name: "Going" })).queryByRole("option", {
        name: "Limit to 3+",
      })
    ).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Can't make it: count shown to guests"), {
      target: { value: "CAPPED" },
    });
    expect(screen.getByText("Can't make it · 3+")).toBeVisible();
    fireEvent.change(screen.getByLabelText("Can't make it: guest names"), {
      target: { value: "HIDDEN" },
    });
    expect(screen.queryByLabelText("Can't make it: count shown to guests")).not.toBeInTheDocument();
    expect(screen.getByText("This response type is not displayed to guests.")).toBeVisible();
  });

  it("explains and disables guest presentation controls when only hosts can access the list", () => {
    render(<Settings hostOnly />);
    expect(screen.getByText(/Your guest list is currently Host only/)).toBeVisible();
    for (const select of screen.getAllByRole("combobox")) expect(select).toBeDisabled();
  });
});
