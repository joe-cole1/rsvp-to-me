import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@/tests/components/render";
import { testTheme } from "./helpers/theme";
import { GuestListSection } from "@/components/event/event-page/GuestListSection";
import type { EventData } from "@/components/event/event-page/types";
import { GuestRsvpDisplaySettings } from "@/components/event/settings-page/GuestRsvpDisplaySettings";
import { guestRsvpDisplayFields, type GuestRsvpDisplayFields } from "@/lib/guestRsvpDisplay";

vi.mock("@/app/actions/event", () => ({
  addWalkIn: vi.fn(),
  approveRsvp: vi.fn(),
  checkInRsvp: vi.fn(),
  declineRsvp: vi.fn(),
  deleteInvitationAsHost: vi.fn(),
  deleteRsvpAsHost: vi.fn(),
  previewGuestInvitations: vi.fn(),
  sendGuestInvitations: vi.fn(),
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
const invited = [
  { id: "invited-1", guestName: "Kai Invitee" },
  { id: "invited-2", guestName: "Lu Invitee" },
];
const preferences = guestRsvpDisplayFields({
  guestDeclinedList: "COLLAPSED",
  guestDeclinedCount: "HIDDEN",
});

function renderCard(
  fields = preferences,
  isHost = false,
  guestListVis = "ALL",
  extra: Partial<EventData> = {}
) {
  const event = {
    ...fields,
    ...extra,
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

function renderFullList(
  fields = preferences,
  isHost = false,
  guestInvited: { id: string; guestName: string }[] = []
) {
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
      guestInvited={guestInvited}
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
    const declined = screen.getByRole("button", { name: "Can't make it 3 or more" });
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

  it("shows a count-only heading without any names", () => {
    renderCard({ ...preferences, guestMaybeList: "HIDDEN", guestMaybeCount: "EXACT" });
    expect(screen.getByText("Maybe · 1")).toBeVisible();
    expect(screen.queryByText("Maybe Guest")).not.toBeInTheDocument();
  });

  it("reads a capped heading count as 3 or more", () => {
    renderCard({ ...preferences, guestDeclinedList: "EXPANDED", guestDeclinedCount: "CAPPED" });
    expect(screen.getByText("3 or more")).toHaveClass("sr-only");
    expect(screen.getByText("3+")).toHaveAttribute("aria-hidden", "true");
  });

  it("keeps the Invited row off the event card by default", () => {
    renderCard(preferences, false, "ALL", { invitedGuests: invited, invitedCount: 2 });
    expect(screen.queryByText(/Invited/)).not.toBeInTheDocument();
    expect(screen.queryByText("Kai Invitee")).not.toBeInTheDocument();
  });

  it("shows Invited names and count on the event card when the host turns it on", () => {
    renderCard(
      { ...preferences, guestInvitedList: "EXPANDED", guestInvitedCount: "EXACT" },
      false,
      "ALL",
      { invitedGuests: invited, invitedCount: 2 }
    );
    expect(screen.getByText("Invited · 2")).toBeVisible();
    expect(screen.getByText("Kai Invitee")).toBeVisible();
  });

  it("shows an Invited count alone when only the count is on", () => {
    renderCard(
      { ...preferences, guestInvitedList: "HIDDEN", guestInvitedCount: "EXACT" },
      false,
      "ALL",
      { invitedGuests: [], invitedCount: 2 }
    );
    expect(screen.getByText("Invited · 2")).toBeVisible();
    expect(screen.queryByText("Kai Invitee")).not.toBeInTheDocument();
  });

  it("lists invited names for guests only when the host shows them", () => {
    renderFullList(preferences, false, invited);
    expect(screen.queryByRole("button", { name: /Invited/ })).not.toBeInTheDocument();
    expect(screen.queryByText("Kai Invitee")).not.toBeInTheDocument();
  });

  it("adds an Invited filter and cards for guests when the host shows names", () => {
    renderFullList(
      { ...preferences, guestInvitedList: "EXPANDED", guestInvitedCount: "EXACT" },
      false,
      invited
    );
    expect(screen.getByRole("button", { name: "Invited 2" })).toBeVisible();
    expect(screen.getByText("Kai Invitee")).toBeVisible();
    expect(screen.getAllByText("No reply")).toHaveLength(2);
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
      />
    );
  }

  it("shows one choice table with a Names and a Count menu per response", () => {
    render(<Settings />);
    expect(screen.getByText(/Hosts and co-hosts always see every name and count\./)).toBeVisible();
    const table = screen.getByRole("table", { name: "Guest RSVP display" });
    const rows = within(table).getAllByRole("row").slice(1);
    expect(rows.map((row) => within(row).getByRole("rowheader").textContent)).toEqual([
      "Going",
      "Maybe",
      "Can't make it",
      "InvitedNo reply yet",
    ]);
    for (const row of rows) expect(within(row).getAllByRole("combobox")).toHaveLength(2);
    for (const label of ["Going", "Maybe", "Can't make it", "Invited"]) {
      const names = screen.getByLabelText(`${label}: Names`);
      const count = screen.getByLabelText(`${label}: Count`);
      expect(
        within(names)
          .getAllByRole("option")
          .map((option) => option.textContent)
      ).toEqual(["Shown", "Collapsed", "Hidden"]);
      expect(
        within(count)
          .getAllByRole("option")
          .map((option) => option.textContent)
      ).toEqual(["Exact", "3+", "Hidden"]);
    }
    expect(screen.queryByText(/Guests can count the names/)).not.toBeInTheDocument();
  });

  it("previews what guests see under the table and updates it live", () => {
    render(<Settings />);
    const preview = within(screen.getByRole("region", { name: "What guests see" }));
    expect(preview.getByText("Going · 5")).toBeVisible();
    expect(preview.getByText("Ana")).toBeVisible();
    expect(preview.getByText("Hal")).not.toBeVisible();
    expect(preview.queryByText(/Invited/)).not.toBeInTheDocument();
    expect(preview.queryByText(/responses/)).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Can't make it: Count"), {
      target: { value: "EXACT" },
    });
    expect(preview.getByText("20 responses")).toBeVisible();

    fireEvent.change(screen.getByLabelText("Going: Names"), { target: { value: "HIDDEN" } });
    fireEvent.change(screen.getByLabelText("Going: Count"), { target: { value: "CAPPED" } });
    expect(preview.queryByText("Ana")).not.toBeInTheDocument();
    expect(preview.getByText("3 or more")).toHaveClass("sr-only");

    fireEvent.change(screen.getByLabelText("Invited: Count"), { target: { value: "EXACT" } });
    expect(preview.getByText("Invited · 8")).toBeVisible();
    expect(preview.queryByText("Kai")).not.toBeInTheDocument();
  });

  it("says when guests would see no responses at all", () => {
    render(<Settings />);
    for (const label of ["Going", "Maybe", "Can't make it"]) {
      fireEvent.change(screen.getByLabelText(`${label}: Names`), { target: { value: "HIDDEN" } });
      fireEvent.change(screen.getByLabelText(`${label}: Count`), { target: { value: "HIDDEN" } });
    }
    expect(screen.getByText("Guests see no responses.")).toBeVisible();
  });

  it("starts Invited hidden and keeps Count usable when Names is hidden", () => {
    render(<Settings />);
    expect(screen.getByLabelText("Invited: Names")).toHaveValue("HIDDEN");
    expect(screen.getByLabelText("Invited: Count")).toHaveValue("HIDDEN");
    fireEvent.change(screen.getByLabelText("Going: Names"), { target: { value: "HIDDEN" } });
    const goingCount = screen.getByLabelText("Going: Count");
    expect(goingCount).toBeEnabled();
    fireEvent.change(goingCount, { target: { value: "CAPPED" } });
    expect(goingCount).toHaveValue("CAPPED");
  });

  it("explains and disables guest presentation controls when only hosts can access the list", () => {
    render(<Settings hostOnly />);
    expect(screen.getByText(/Your guest list is currently Host only/)).toBeVisible();
    for (const select of screen.getAllByRole("combobox")) expect(select).toBeDisabled();
  });
});
