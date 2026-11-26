// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { useState, type ReactNode } from "react";
import { NextIntlClientProvider } from "next-intl";
import english from "@/messages/en-US.json";
import { resolveTheme } from "@/lib/theme";
import { CaptchaProvider } from "@/components/ui/CaptchaProvider";
import type { EventData } from "@/components/event/event-page/types";
import type { PollEntry } from "@/components/event/settings-page/types";

const { mockAddRSVP, mockUpdateRSVP, mockUpdateRsvpAsHost } = vi.hoisted(() => ({
  mockAddRSVP: vi.fn(),
  mockUpdateRSVP: vi.fn(),
  mockUpdateRsvpAsHost: vi.fn(),
}));

vi.mock("@/app/actions/event", () => ({
  addRSVP: mockAddRSVP,
  updateRSVP: mockUpdateRSVP,
  updateRsvpAsHost: mockUpdateRsvpAsHost,
}));

import { PotluckSection } from "@/components/event/event-page/PotluckSection";
import { PollsSection } from "@/components/event/event-page/PollsSection";
import { PollsPanel } from "@/components/event/settings-page/PollsPanel";
import { RsvpFlow } from "@/components/rsvp/RsvpFlow";

const theme = resolveTheme("DARK", "#7c3aed", "#1e40af", "#a855f7");

function Providers({ children }: { children: ReactNode }) {
  return (
    <NextIntlClientProvider locale="en-US" messages={english}>
      <CaptchaProvider siteKey={null}>{children}</CaptchaProvider>
    </NextIntlClientProvider>
  );
}

function renderWithProviders(ui: ReactNode) {
  return render(ui, { wrapper: Providers });
}

function makeEventData(overrides: Partial<EventData> = {}): EventData {
  return {
    id: "event-1",
    slug: "slug",
    title: "Summer Potluck",
    description: null,
    startAt: new Date("2030-07-01T18:00:00Z"),
    endAt: null,
    timezone: "America/New_York",
    locationType: "PHYSICAL",
    locationName: "Backyard",
    locationAddress: null,
    virtualUrl: null,
    commentsEnabled: true,
    plusOneAllowed: false,
    plusOneMax: 0,
    plusOneNamesRequired: false,
    guestSharingEnabled: true,
    guestsCanInvite: false,
    approvalRequired: false,
    maybeEnabled: true,
    questionnaireEnabled: false,
    showTimestamps: true,
    guestListVis: "ALL",
    visibility: "PUBLIC",
    hostDisplayName: null,
    allowEditAfterDeadline: true,
    host: { id: "host-1", name: "Hank Host", email: "host@example.com", avatarUrl: null },
    coHosts: [],
    theme: {
      baseTheme: "DARK",
      gradientFrom: "#7c3aed",
      gradientTo: "#1e40af",
      accentColor: "#a855f7",
      coverImageUrl: null,
    },
    infoSections: [],
    rsvps: [],
    comments: [],
    rsvpFields: [],
    updates: [],
    potluckItems: [
      {
        id: "item-1",
        label: "Pasta Salad",
        quantity: 3,
        createdAt: new Date("2030-06-01T12:00:00Z"),
        claims: [
          {
            id: "claim-1",
            potluckItemId: "item-1",
            guestName: "",
            quantity: 2,
            createdAt: new Date("2030-06-02T12:00:00Z"),
            isMine: false,
          },
        ],
      },
    ],
    rsvpDeadline: null,
    pendingRsvps: [],
    activityEvents: [],
    polls: [
      {
        id: "poll-1",
        question: "Which drink?",
        multiChoice: false,
        allowGuestsToAdd: true,
        locked: false,
        hideVoters: false,
        requireRsvp: true,
        createdAt: new Date("2030-06-01T12:00:00Z"),
        options: [
          {
            id: "opt-1",
            text: "Sparkling Water",
            creatorName: null,
            createdAt: new Date("2030-06-01T12:00:00Z"),
            votes: [],
          },
          {
            id: "opt-2",
            text: "Lemonade",
            creatorName: null,
            createdAt: new Date("2030-06-01T12:00:00Z"),
            votes: [],
          },
        ],
      },
    ],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ── PotluckSection ────────────────────────────────────────────────────────────

describe("PotluckSection — read-only pre-RSVP & Going requirement", () => {
  const basePotluckProps = {
    t: theme,
    isHost: false,
    guestName: "Alice",
    isPendingGuest: false,
    pendingNoticeStyle: {},
    claimingItemId: null,
    setClaimingItemId: vi.fn(),
    claimName: "",
    setClaimName: vi.fn(),
    claimQty: 1,
    setClaimQty: vi.fn(),
    claimItem: vi.fn(async () => {}),
    unclaimItem: vi.fn(async () => {}),
  };

  it("pre-RSVP: renders #potluck, shows item label & remaining count with redacted claims omitted, hides 'I'll bring it', and links 'RSVP Going to claim'", () => {
    const { container } = renderWithProviders(
      <PotluckSection
        {...basePotluckProps}
        event={makeEventData()}
        rsvpStatus={null}
        rsvpDone={false}
      />
    );

    expect(container.querySelector("#potluck")).toBeTruthy();
    expect(screen.getByText("Pasta Salad")).toBeInTheDocument();
    expect(screen.getByText("(need 3, 1 remaining)")).toBeInTheDocument();
    expect(screen.queryByText(/bringing/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "I'll bring it" })).not.toBeInTheDocument();

    const cta = screen.getByRole("link", { name: "RSVP Going to claim" });
    expect(cta).toHaveAttribute("href", "/e/slug/rsvp?status=GOING&return=potluck");
  });

  it("MAYBE guest with guestEditToken: renders 'Change RSVP to Going to claim' with token link and omits 'I'll bring it'", () => {
    renderWithProviders(
      <PotluckSection
        {...basePotluckProps}
        event={makeEventData()}
        rsvpStatus="MAYBE"
        rsvpDone={true}
        guestEditToken="tok-123"
      />
    );

    expect(screen.queryByRole("button", { name: "I'll bring it" })).not.toBeInTheDocument();
    const cta = screen.getByRole("link", { name: "Change RSVP to Going to claim" });
    expect(cta).toHaveAttribute("href", "/e/slug/rsvp?token=tok-123&status=GOING&return=potluck");
  });

  it("rsvpOpen={false}: omits the RSVP CTA link while keeping the read-only list visible", () => {
    renderWithProviders(
      <PotluckSection
        {...basePotluckProps}
        event={makeEventData()}
        rsvpStatus={null}
        rsvpDone={false}
        rsvpOpen={false}
      />
    );

    expect(screen.getByText("Pasta Salad")).toBeInTheDocument();
    expect(screen.getByText("(need 3, 1 remaining)")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "RSVP Going to claim" })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Change RSVP to Going to claim" })
    ).not.toBeInTheDocument();
  });

  it("approved GOING guest: renders 'I'll bring it' button", () => {
    renderWithProviders(
      <PotluckSection
        {...basePotluckProps}
        event={makeEventData()}
        rsvpStatus="GOING"
        rsvpDone={true}
        guestEditToken="tok-123"
      />
    );

    expect(screen.getByRole("button", { name: "I'll bring it" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /claim/i })).not.toBeInTheDocument();
  });
});

// ── PollsSection ──────────────────────────────────────────────────────────────

describe("PollsSection — requireRsvp gating vs open polls", () => {
  const basePollsProps = {
    isPending: false,
    t: theme,
    isHost: false,
    rsvpStatus: null as "GOING" | "MAYBE" | "NO" | "INVITED" | null,
    rsvpDone: false,
    isPendingGuest: false,
    newPollOptionTexts: {},
    setNewPollOptionTexts: vi.fn(),
    pendingNoticeStyle: {},
    handleVote: vi.fn(async () => {}),
    handleAddPollOption: vi.fn(async () => {}),
  };

  it("requireRsvp: true for pre-RSVP viewer disables option inputs and renders 'RSVP to vote' link", () => {
    renderWithProviders(<PollsSection {...basePollsProps} event={makeEventData()} />);

    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(2);
    radios.forEach((radio) => expect(radio).toBeDisabled());

    const rsvpLink = screen.getByRole("link", { name: "RSVP to vote" });
    expect(rsvpLink).toHaveAttribute("href", "/e/slug/rsvp?status=MAYBE&return=polls");
  });

  it("requireRsvp: false for pre-RSVP viewer shows open badge, name input & hint when empty, enables options once name is entered, and renders pollError in role=alert", () => {
    const openEvent = makeEventData({
      polls: [
        {
          ...makeEventData().polls[0],
          requireRsvp: false,
        },
      ],
    });

    function OpenPollHarness({ pollError }: { pollError: string | null }) {
      const [voterNameDraft, setVoterNameDraft] = useState("");
      return (
        <PollsSection
          {...basePollsProps}
          event={openEvent}
          voterNameDraft={voterNameDraft}
          setVoterNameDraft={setVoterNameDraft}
          pollError={pollError}
        />
      );
    }

    renderWithProviders(<OpenPollHarness pollError="Enter your name to vote." />);

    expect(screen.getByText("Open without RSVP")).toBeInTheDocument();
    expect(screen.getByText("Enter your name above to vote in this poll.")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Enter your name to vote.");

    const nameInput = screen.getByLabelText("Your name (required to vote)");
    expect(nameInput).toBeInTheDocument();

    screen.getAllByRole("radio").forEach((radio) => expect(radio).toBeDisabled());

    fireEvent.change(nameInput, { target: { value: "Sam" } });

    screen.getAllByRole("radio").forEach((radio) => expect(radio).toBeEnabled());
    expect(
      screen.queryByText("Enter your name above to vote in this poll.")
    ).not.toBeInTheDocument();
  });
});

// ── PollsPanel ────────────────────────────────────────────────────────────────

describe("PollsPanel — requireRsvp host toggle", () => {
  it("renders 'Require RSVP (Going or Maybe) to respond' toggle on active poll and calls handleUpdatePollSettings(pollId, { requireRsvp: false }) when clicked", () => {
    const handleUpdatePollSettings = vi.fn();
    const activePoll: PollEntry = {
      id: "poll-1",
      eventId: "event-1",
      question: "Which drink?",
      multiChoice: false,
      allowGuestsToAdd: true,
      locked: false,
      hideVoters: false,
      requireRsvp: true,
      createdAt: new Date("2030-06-01T12:00:00Z"),
      updatedAt: new Date("2030-06-01T12:00:00Z"),
      options: [
        {
          id: "opt-1",
          pollId: "poll-1",
          text: "Water",
          creatorName: null,
          createdAt: new Date("2030-06-01T12:00:00Z"),
          votes: [],
        },
        {
          id: "opt-2",
          pollId: "poll-1",
          text: "Juice",
          creatorName: null,
          createdAt: new Date("2030-06-01T12:00:00Z"),
          votes: [],
        },
      ],
    };

    renderWithProviders(
      <PollsPanel
        polls={[activePoll]}
        newPollQuestion=""
        setNewPollQuestion={vi.fn()}
        newPollOptions={["", ""]}
        setNewPollOptions={vi.fn()}
        newPollMultiChoice={false}
        setNewPollMultiChoice={vi.fn()}
        newPollAllowGuestsToAdd={false}
        setNewPollAllowGuestsToAdd={vi.fn()}
        newPollHideVoters={false}
        setNewPollHideVoters={vi.fn()}
        newPollRequireRsvp={true}
        setNewPollRequireRsvp={vi.fn()}
        newPollOptionTexts={{}}
        setNewPollOptionTexts={vi.fn()}
        handleAddPoll={vi.fn()}
        handleDeletePoll={vi.fn()}
        handleUpdatePollSettings={handleUpdatePollSettings}
        handleAddPollOption={vi.fn()}
        handleDeletePollOption={vi.fn()}
        isPending={false}
        t={theme}
      />
    );

    const toggle = screen.getByRole("switch", {
      name: "Require RSVP (Going or Maybe) to respond",
    });
    expect(toggle).toHaveAttribute("aria-checked", "true");
    fireEvent.click(toggle);
    expect(handleUpdatePollSettings).toHaveBeenCalledWith("poll-1", { requireRsvp: false });
  });
});

// ── RsvpFlow ──────────────────────────────────────────────────────────────────

describe("RsvpFlow — potluck returnSection & Next Steps", () => {
  const rsvpEvent = {
    id: "event-1",
    slug: "slug",
    title: "Summer Potluck",
    startAt: new Date("2030-07-01T18:00:00Z"),
    endAt: null,
    timezone: "America/New_York",
    locationName: "Backyard",
    plusOneAllowed: false,
    plusOneMax: 0,
    plusOneNamesRequired: false,
    maybeEnabled: true,
    questionnaireEnabled: false,
    rsvpFields: [],
    potluckItems: [{ id: "item-1", label: "Pasta Salad" }],
    polls: [{ id: "poll-1", question: "Which drink?" }],
  };

  it("renders potluckGoingBanner info status on Step 1 when returnSection='potluck'", () => {
    renderWithProviders(
      <RsvpFlow
        event={rsvpEvent}
        theme={theme}
        initialStatus="GOING"
        returnSection="potluck"
        sessionUser={null}
      />
    );

    expect(screen.getByRole("status")).toHaveTextContent(
      "Claiming a potluck item sets your RSVP to Going. Please only continue as Going if you plan to attend."
    );
  });

  it("on Done screen for MAYBE omits 'Bring something (Potluck)' from Next Steps", async () => {
    mockAddRSVP.mockResolvedValueOnce({ success: true, id: "rsvp-1", editToken: "tok-maybe" });

    renderWithProviders(
      <RsvpFlow event={rsvpEvent} theme={theme} initialStatus="MAYBE" sessionUser={null} />
    );

    fireEvent.change(screen.getByPlaceholderText("Your name (required)"), {
      target: { value: "Morgan" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Confirm RSVP" }));

    await waitFor(() => {
      expect(screen.getByText("Noted!")).toBeInTheDocument();
    });
    expect(screen.getByText(/Vote in the polls/)).toBeInTheDocument();
    expect(screen.queryByText(/Bring something \(Potluck\)/)).not.toBeInTheDocument();
  });

  it("on Done screen for GOING with returnSection='potluck' links 'Back to potluck' to /e/...#potluck", async () => {
    mockAddRSVP.mockResolvedValueOnce({ success: true, id: "rsvp-1", editToken: "tok-going" });

    renderWithProviders(
      <RsvpFlow
        event={rsvpEvent}
        theme={theme}
        initialStatus="GOING"
        returnSection="potluck"
        sessionUser={null}
      />
    );

    fireEvent.change(screen.getByPlaceholderText("Your name (required)"), {
      target: { value: "Alice" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Confirm RSVP" }));

    await waitFor(() => {
      expect(screen.getByText("You're in!")).toBeInTheDocument();
    });
    const backLink = screen.getByRole("link", { name: "Back to potluck" });
    expect(backLink).toHaveAttribute("href", "/e/slug?token=tok-going#potluck");
  });
});
