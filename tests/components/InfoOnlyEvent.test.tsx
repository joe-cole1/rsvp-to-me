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
import { guestRsvpDisplayFields } from "@/lib/guestRsvpDisplay";

const { mockSubmitQuestionnaire, mockCastVote, mockAddComment, mockSaveEventSettings } = vi.hoisted(
  () => ({
    mockSubmitQuestionnaire: vi.fn(),
    mockCastVote: vi.fn(),
    mockAddComment: vi.fn(),
    mockSaveEventSettings: vi.fn(),
  })
);

vi.mock("@/app/actions/notifications", () => ({
  getNotificationManagement: vi.fn().mockResolvedValue({
    success: false,
    error: "ok",
  }),
  saveNotificationPreferences: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock("@/app/actions/event", () => ({
  saveEventField: vi.fn(),
  saveCoverImage: vi.fn(),
  removeCoverImage: vi.fn(),
  addComment: mockAddComment,
  deleteComment: vi.fn(),
  addInfoSection: vi.fn(),
  updateInfoSection: vi.fn(),
  removeInfoSection: vi.fn(),
  reorderInfoSections: vi.fn(),
  approveRsvp: vi.fn(),
  declineRsvp: vi.fn(),
  addEventUpdate: vi.fn(),
  deleteEventUpdate: vi.fn(),
  claimPotluckItem: vi.fn(),
  unclaimPotluckItem: vi.fn(),
  deleteActivityEvent: vi.fn(),
  castVote: mockCastVote,
  addPollOption: vi.fn(),
  submitQuestionnaireResponse: mockSubmitQuestionnaire,
  sendBlast: vi.fn(),
  sendSmsBlast: vi.fn(),
  saveEventSettings: mockSaveEventSettings,
  previewEventUrl: vi.fn(),
  saveEventUrl: vi.fn(),
}));

import { EventPage } from "@/components/event/EventPage";
import { HostBar } from "@/components/event/HostBar";
import { RsvpOptionsPanel } from "@/components/event/settings-page/RsvpOptionsPanel";
import { SettingsMenu } from "@/components/event/settings-page/SettingsMenu";
import { PollsPanel } from "@/components/event/settings-page/PollsPanel";
import { DisplayOptionsPanel } from "@/components/event/settings-page/DisplayOptionsPanel";
import { DashboardClient } from "@/components/dashboard/DashboardClient";

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

function makeInfoOnlyEvent(overrides: Partial<EventData> = {}): EventData {
  return {
    id: "evt-flyer",
    slug: "flyer",
    title: "Neighborhood Block Party",
    description: "Drop by anytime!",
    startAt: new Date("2030-08-15T18:00:00Z"),
    endAt: null,
    timezone: "America/New_York",
    locationType: "PHYSICAL",
    locationName: "Maple Street",
    locationAddress: "100 Maple St",
    virtualUrl: null,
    rsvpEnabled: false,
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
    allowEditAfterDeadline: false,
    host: { id: "host-1", name: "Alex", email: "alex@test.local", avatarUrl: null },
    coHosts: [],
    theme: {
      baseTheme: "DARK",
      gradientFrom: "#7c3aed",
      gradientTo: "#1e40af",
      accentColor: "#a855f7",
      coverImageUrl: null,
    },
    infoSections: [],
    rsvps: [
      {
        id: "dormant-1",
        guestName: "Dormant Guest",
        status: "GOING",
        plusOneCount: 0,
        note: null,
        createdAt: new Date(),
      },
    ],
    comments: [],
    rsvpFields: [
      {
        id: "field-1",
        label: "What music do you want?",
        fieldType: "TEXT",
        required: true,
        options: null,
      },
    ],
    updates: [],
    potluckItems: [{ id: "pot-1", label: "Soda", quantity: 2, createdAt: new Date(), claims: [] }],
    rsvpDeadline: null,
    pendingRsvps: [],
    activityEvents: [],
    polls: [
      {
        id: "poll-1",
        question: "Favorite snack?",
        multiChoice: false,
        allowGuestsToAdd: false,
        locked: false,
        hideVoters: false,
        requireRsvp: true,
        createdAt: new Date(),
        options: [
          { id: "opt-1", text: "Pretzels", creatorName: null, createdAt: new Date(), votes: [] },
          { id: "opt-2", text: "Popcorn", creatorName: null, createdAt: new Date(), votes: [] },
        ],
      },
    ],
    ...overrides,
  };
}

describe("Issue #843: Info-only events UI", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSubmitQuestionnaire.mockResolvedValue({
      success: true,
      respondentName: "Sam",
      updatedAt: "2030-08-01T12:00:00.000Z",
      answers: { "field-1": "Jazz" },
    });
    mockCastVote.mockResolvedValue({ success: true });
    mockAddComment.mockResolvedValue({ success: true, id: "cmt-1", guestName: "Sam" });
    mockSaveEventSettings.mockResolvedValue({ success: true });
  });

  it("hides RSVP, guest list, and potluck while rendering questionnaire, open polls, and open comments", async () => {
    const event = makeInfoOnlyEvent();
    renderWithProviders(<EventPage event={event} isHost={false} theme={theme} />);

    // RSVP, Guest List, and Potluck are hidden
    expect(screen.queryByRole("button", { name: /Going/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/Dormant Guest/i)).not.toBeInTheDocument();
    expect(screen.queryByText("Soda")).not.toBeInTheDocument();

    // Standalone Questionnaire renders and validates/submits
    expect(screen.getByText("Questions from the host")).toBeInTheDocument();
    expect(screen.getByText("Favorite snack?")).toBeInTheDocument();
    expect(screen.queryByText("Open without RSVP")).not.toBeInTheDocument();

    // Shared name input works across questionnaire, polls, and comments
    const nameInputs = screen.getAllByPlaceholderText("Your name");
    fireEvent.change(nameInputs[0], { target: { value: "Sam" } });
    fireEvent.change(screen.getByLabelText(/What music do you want\?/), {
      target: { value: "Jazz" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Submit answers" }));

    await waitFor(() => {
      expect(mockSubmitQuestionnaire).toHaveBeenCalledWith(
        {
          eventId: "evt-flyer",
          respondentName: "Sam",
          answers: { "field-1": "Jazz" },
        },
        null
      );
    });
    expect(await screen.findByText("Your answers have been saved.")).toBeInTheDocument();

    // Comment box is available to anonymous visitor on info-only event
    const commentBox = screen.getByPlaceholderText("Leave a comment…");
    fireEvent.change(commentBox, { target: { value: "See you there!" } });
    fireEvent.click(screen.getByRole("button", { name: "Leave a comment…" }));
    await waitFor(() => {
      expect(mockAddComment).toHaveBeenCalledWith(
        {
          eventId: "evt-flyer",
          guestName: "Sam",
          body: "See you there!",
          guestEditToken: undefined,
        },
        null
      );
    });
  });

  it("prompts for confirmation in RsvpOptionsPanel only when responses exist", async () => {
    const triggerSaveSettings = vi.fn();
    function Wrapper({ count }: { count: number }) {
      const [rsvpEnabled, setRsvpEnabled] = useState(true);
      const [plusOneAllowed, setPlusOneAllowed] = useState(false);
      const [plusOneMax, setPlusOneMax] = useState(1);
      const [plusOneNamesRequired, setPlusOneNamesRequired] = useState(false);
      const [approvalRequired, setApprovalRequired] = useState(false);
      const [maybeEnabled, setMaybeEnabled] = useState(true);
      const [showTimestamps, setShowTimestamps] = useState(true);
      const [capacity, setCapacity] = useState("");
      const [rsvpDeadline, setRsvpDeadline] = useState("");
      const [allowEditAfterDeadline, setAllowEditAfterDeadline] = useState(false);
      const [hostAlertEmail, setHostAlertEmail] = useState(true);
      const [hostAlertSms, setHostAlertSms] = useState(false);
      return (
        <RsvpOptionsPanel
          rsvpEnabled={rsvpEnabled}
          setRsvpEnabled={setRsvpEnabled}
          existingRsvpCount={count}
          plusOneAllowed={plusOneAllowed}
          setPlusOneAllowed={setPlusOneAllowed}
          plusOneMax={plusOneMax}
          setPlusOneMax={setPlusOneMax}
          plusOneNamesRequired={plusOneNamesRequired}
          setPlusOneNamesRequired={setPlusOneNamesRequired}
          approvalRequired={approvalRequired}
          setApprovalRequired={setApprovalRequired}
          maybeEnabled={maybeEnabled}
          setMaybeEnabled={setMaybeEnabled}
          showTimestamps={showTimestamps}
          setShowTimestamps={setShowTimestamps}
          capacity={capacity}
          setCapacity={setCapacity}
          rsvpDeadline={rsvpDeadline}
          setRsvpDeadline={setRsvpDeadline}
          allowEditAfterDeadline={allowEditAfterDeadline}
          setAllowEditAfterDeadline={setAllowEditAfterDeadline}
          hostAlertEmail={hostAlertEmail}
          setHostAlertEmail={setHostAlertEmail}
          hostAlertSms={hostAlertSms}
          setHostAlertSms={setHostAlertSms}
          channelConfig={{ email: true, sms: false }}
          triggerSaveSettings={triggerSaveSettings}
          eventId="evt-1"
          onNotificationStatus={() => {}}
          t={theme}
        />
      );
    }

    const { rerender } = renderWithProviders(<Wrapper count={0} />);
    fireEvent.click(screen.getByRole("switch", { name: /Collect RSVPs/i }));
    expect(triggerSaveSettings).toHaveBeenCalledWith({ rsvpEnabled: false });

    triggerSaveSettings.mockClear();
    rerender(
      <Providers>
        <Wrapper count={3} />
      </Providers>
    );
    fireEvent.click(screen.getByRole("switch", { name: /Collect RSVPs/i }));
    expect(await screen.findByText("Turn off RSVPs?")).toBeInTheDocument();
    expect(triggerSaveSettings).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Turn off RSVPs" }));
    await waitFor(() => {
      expect(triggerSaveSettings).toHaveBeenCalledWith({ rsvpEnabled: false });
    });
  });

  it("adapts SettingsMenu, PollsPanel, DisplayOptionsPanel, HostBar, and DashboardClient for info-only mode", () => {
    const samplePoll: PollEntry = {
      id: "p1",
      eventId: "e1",
      question: "Drinks?",
      multiChoice: false,
      allowGuestsToAdd: false,
      locked: false,
      hideVoters: false,
      requireRsvp: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      options: [],
    };

    const { unmount } = renderWithProviders(
      <>
        <SettingsMenu isOwner={true} openSection={() => {}} t={theme} rsvpEnabled={false} />
        <PollsPanel
          rsvpEnabled={false}
          polls={[samplePoll]}
          newPollQuestion=""
          setNewPollQuestion={() => {}}
          newPollOptions={["", ""]}
          setNewPollOptions={() => {}}
          newPollMultiChoice={false}
          setNewPollMultiChoice={() => {}}
          newPollAllowGuestsToAdd={false}
          setNewPollAllowGuestsToAdd={() => {}}
          newPollHideVoters={false}
          setNewPollHideVoters={() => {}}
          newPollOptionTexts={{}}
          setNewPollOptionTexts={() => {}}
          handleAddPoll={() => {}}
          handleDeletePoll={() => {}}
          handleUpdatePollSettings={() => {}}
          handleAddPollOption={() => {}}
          handleDeletePollOption={() => {}}
          isPending={false}
          t={theme}
        />
        <DisplayOptionsPanel
          rsvpEnabled={false}
          eventId="e1"
          slug="flyer"
          commentsEnabled={true}
          setCommentsEnabled={() => {}}
          guestSharingEnabled={true}
          setGuestSharingEnabled={() => {}}
          guestListVis="ALL"
          setGuestListVis={() => {}}
          guestRsvpDisplay={guestRsvpDisplayFields()}
          onGuestRsvpDisplayChange={() => {}}
          visibility="PRIVATE"
          setVisibility={() => {}}
          guestsCanInvite={false}
          setGuestsCanInvite={() => {}}
          password=""
          setPassword={() => {}}
          passwordDirty={false}
          setPasswordDirty={() => {}}
          hasPassword={false}
          isPending={false}
          triggerSaveSettings={() => {}}
          t={theme}
        />
      </>
    );

    expect(screen.queryByText("Auto-reminders")).not.toBeInTheDocument();
    expect(screen.queryByText("Emails")).not.toBeInTheDocument();
    expect(screen.queryByText("Potluck")).not.toBeInTheDocument();
    expect(screen.queryByText(/Require RSVP/)).not.toBeInTheDocument();
    expect(screen.queryByText("Guest list visibility")).not.toBeInTheDocument();
    expect(
      screen.getAllByText(/Private info-only events have no guest invitations/).length
    ).toBeGreaterThan(0);
    unmount();

    const { unmount: unmountHostBar } = renderWithProviders(
      <HostBar
        eventId="e1"
        eventSlug="flyer"
        theme={theme}
        visibility="PRIVATE"
        rsvpEnabled={false}
        hasPassword={true}
      />
    );
    expect(screen.queryByRole("button", { name: "Invite" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Message" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Share" }));
    expect(
      screen.getAllByText(/Share both the link and the event password/).length
    ).toBeGreaterThan(0);
    unmountHostBar();

    renderWithProviders(
      <DashboardClient
        initialEvents={[
          {
            id: "e1",
            slug: "flyer",
            title: "Flyer Event",
            startAt: new Date("2030-09-01T18:00:00Z"),
            timezone: "America/New_York",
            status: "PUBLISHED",
            rsvpEnabled: false,
            theme: null,
            going: 0,
            maybe: 0,
            pending: 0,
            isCohost: false,
            host: { name: "Alex", email: "a@test.local", avatarUrl: null },
            coHosts: [],
            commentCount: 2,
            rsvpDeadline: null,
            hostDisplayName: null,
          },
        ]}
        initialInvites={[]}
        recentActivities={[]}
        userName="Alex"
        userRole="HOST"
        openRegistration={true}
      />
    );
    expect(screen.getByText("Info only")).toBeInTheDocument();
    expect(screen.queryByText(/0 going/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Options for Flyer Event" }));
    expect(screen.queryByText("Guests List")).not.toBeInTheDocument();
  });
});
