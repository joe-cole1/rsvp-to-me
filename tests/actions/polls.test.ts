import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockEventFindUnique,
  mockPollCreate,
  mockPollFindUnique,
  mockPollDelete,
  mockPollOptionCreateMany,
  mockPollOptionCreate,
  mockPollOptionFindFirst,
  mockPollVoteDeleteMany,
  mockPollVoteUpsert,
  mockRsvpFindFirst,
  mockGetSession,
  mockUserFindUnique,
} = vi.hoisted(() => ({
  mockEventFindUnique: vi.fn(),
  mockPollCreate: vi.fn(),
  mockPollFindUnique: vi.fn(),
  mockPollDelete: vi.fn(),
  mockPollOptionCreateMany: vi.fn(),
  mockPollOptionCreate: vi.fn(),
  mockPollOptionFindFirst: vi.fn(),
  mockPollVoteDeleteMany: vi.fn(),
  mockPollVoteUpsert: vi.fn(),
  mockRsvpFindFirst: vi.fn(),
  mockGetSession: vi.fn(),
  mockUserFindUnique: vi.fn(),
}));

vi.mock("@/lib/db", () => {
  const dbClient = {
    event: { findUnique: mockEventFindUnique },
    poll: {
      create: mockPollCreate,
      findUnique: mockPollFindUnique,
      delete: mockPollDelete,
    },
    pollOption: {
      createMany: mockPollOptionCreateMany,
      create: mockPollOptionCreate,
      findFirst: mockPollOptionFindFirst,
    },
    pollVote: {
      deleteMany: mockPollVoteDeleteMany,
      upsert: mockPollVoteUpsert,
    },
    rSVP: {
      findFirst: mockRsvpFindFirst,
    },
    user: {
      findUnique: mockUserFindUnique,
    },
    activityEvent: {
      create: vi.fn().mockResolvedValue({}),
    },
  };
  return {
    db: {
      ...dbClient,
      $transaction: vi.fn((cb) => cb(dbClient)),
    },
  };
});

vi.mock("@/lib/session", () => ({ getSession: mockGetSession }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/email", () => ({
  sendRsvpConfirmationEmail: vi.fn(),
  sendBlastEmail: vi.fn(),
}));
vi.mock("@/lib/sms", () => ({
  sendRsvpConfirmationSms: vi.fn(),
  sendSmsBlast: vi.fn(),
}));

import { createPoll, deletePoll, castVote, addPollOption } from "@/app/actions/event";

const HOST_ID = "host-1";
const COHOST_ID = "cohost-1";
const GUEST_ID = "guest-1";
const EVENT_ID = "event-1";
const EVENT_SLUG = "test-event";

function asHost() {
  mockGetSession.mockResolvedValue({ userId: HOST_ID, email: "host@example.com" });
}

function asCohost() {
  mockGetSession.mockResolvedValue({ userId: COHOST_ID, email: "cohost@example.com" });
}

function asGuest() {
  mockGetSession.mockResolvedValue({ userId: GUEST_ID, email: "guest@example.com" });
}

function hostEventRow(overrides = {}) {
  return { hostId: HOST_ID, slug: EVENT_SLUG, coHosts: [], ...overrides };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ── createPoll ─────────────────────────────────────────────────────────────────

describe("createPoll", () => {
  beforeEach(() => {
    asHost();
    mockEventFindUnique.mockResolvedValue(hostEventRow());
    mockPollCreate.mockResolvedValue({ id: "poll-1" });
    mockUserFindUnique.mockResolvedValue({ name: "Host Person" });
  });

  it("creates a poll successfully when authorized", async () => {
    const result = await createPoll(EVENT_ID, "What should we eat?", ["Pizza", "Tacos"], false, true);
    expect(result.success).toBe(true);
    expect(result.id).toBe("poll-1");
    expect(mockPollCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventId: EVENT_ID,
          question: "What should we eat?",
          multiChoice: false,
          allowGuestsToAdd: true,
        }),
      })
    );
    expect(mockPollOptionCreateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [
          { pollId: "poll-1", text: "Pizza" },
          { pollId: "poll-1", text: "Tacos" },
        ],
      })
    );
  });

  it("throws Forbidden when unauthorized user tries to create a poll", async () => {
    mockGetSession.mockResolvedValue({ userId: "stranger", email: "stranger@example.com" });
    await expect(createPoll(EVENT_ID, "Question", [], false, true)).rejects.toThrow("Forbidden");
  });

  it("throws validation error for empty question", async () => {
    await expect(createPoll(EVENT_ID, "   ", [], false, true)).rejects.toThrow("Question cannot be empty");
  });
});

// ── deletePoll ─────────────────────────────────────────────────────────────────

describe("deletePoll", () => {
  beforeEach(() => {
    asHost();
    mockPollFindUnique.mockResolvedValue({ eventId: EVENT_ID });
    mockEventFindUnique.mockResolvedValue(hostEventRow());
    mockPollDelete.mockResolvedValue({ id: "poll-1" });
  });

  it("deletes a poll successfully when host deletes", async () => {
    const result = await deletePoll("poll-1");
    expect(result.success).toBe(true);
    expect(mockPollDelete).toHaveBeenCalledWith({ where: { id: "poll-1" } });
  });

  it("deletes a poll successfully when co-host deletes", async () => {
    asCohost();
    mockEventFindUnique.mockResolvedValue(hostEventRow({ coHosts: [{ userId: COHOST_ID }] }));
    const result = await deletePoll("poll-1");
    expect(result.success).toBe(true);
  });

  it("throws Forbidden when a regular user tries to delete the poll", async () => {
    asGuest();
    await expect(deletePoll("poll-1")).rejects.toThrow("Forbidden");
  });
});

// ── castVote ───────────────────────────────────────────────────────────────────

describe("castVote", () => {
  beforeEach(() => {
    mockPollFindUnique.mockResolvedValue({
      id: "poll-1",
      eventId: EVENT_ID,
      multiChoice: false,
      event: {
        hostId: HOST_ID,
        slug: EVENT_SLUG,
        coHosts: [],
      },
    });
  });

  it("allows a host to vote without a guest RSVP ID", async () => {
    asHost();
    const result = await castVote("poll-1", "option-1", "Host Person", true);
    expect(result.success).toBe(true);
    expect(mockPollVoteUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          pollOptionId_voterName: {
            pollOptionId: "option-1",
            voterName: "Host Person",
          },
        },
      })
    );
  });

  it("allows an approved guest to vote with a matching RSVP name", async () => {
    mockGetSession.mockResolvedValue(null); // Guest is not logged in as host
    mockRsvpFindFirst.mockResolvedValue({ id: "rsvp-1", guestName: "Alice", approved: true });

    const result = await castVote("poll-1", "option-1", "Alice", true, "rsvp-1");
    expect(result.success).toBe(true);
    expect(mockRsvpFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "rsvp-1", eventId: EVENT_ID, approved: true },
      })
    );
  });

  it("throws Unauthorized for guest if guestRsvpId is missing", async () => {
    mockGetSession.mockResolvedValue(null);
    await expect(castVote("poll-1", "option-1", "Alice", true)).rejects.toThrow(
      "Unauthorized: Guest RSVP ID required to vote"
    );
  });

  it("throws Unauthorized if guestRsvpId doesn't exist or is not approved", async () => {
    mockGetSession.mockResolvedValue(null);
    mockRsvpFindFirst.mockResolvedValue(null);
    await expect(castVote("poll-1", "option-1", "Alice", true, "rsvp-1")).rejects.toThrow(
      "Unauthorized: RSVP not found or not approved"
    );
  });

  it("throws Unauthorized if voterName does not match RSVP guestName", async () => {
    mockGetSession.mockResolvedValue(null);
    mockRsvpFindFirst.mockResolvedValue({ id: "rsvp-1", guestName: "Alice", approved: true });
    await expect(castVote("poll-1", "option-1", "Bob", true, "rsvp-1")).rejects.toThrow(
      "Unauthorized: Voter name does not match guest name"
    );
  });

  it("clears other votes on single-choice polls when voting", async () => {
    asHost();
    // mockPollFindUnique specifies multiChoice: false
    const result = await castVote("poll-1", "option-1", "Host Person", true);
    expect(result.success).toBe(true);
    expect(mockPollVoteDeleteMany).toHaveBeenCalledWith({
      where: { pollId: "poll-1", voterName: "Host Person" },
    });
  });

  it("does not clear other votes on multi-choice polls when voting", async () => {
    asHost();
    mockPollFindUnique.mockResolvedValue({
      id: "poll-1",
      eventId: EVENT_ID,
      multiChoice: true,
      event: {
        hostId: HOST_ID,
        slug: EVENT_SLUG,
        coHosts: [],
      },
    });

    const result = await castVote("poll-1", "option-1", "Host Person", true);
    expect(result.success).toBe(true);
    expect(mockPollVoteDeleteMany).not.toHaveBeenCalled();
  });

  it("deletes a vote when isVoted is false (retracting a vote)", async () => {
    asHost();
    const result = await castVote("poll-1", "option-1", "Host Person", false);
    expect(result.success).toBe(true);
    expect(mockPollVoteDeleteMany).toHaveBeenCalledWith({
      where: { pollOptionId: "option-1", voterName: "Host Person" },
    });
  });
});

// ── addPollOption ──────────────────────────────────────────────────────────────

describe("addPollOption", () => {
  beforeEach(() => {
    mockPollFindUnique.mockResolvedValue({
      id: "poll-1",
      eventId: EVENT_ID,
      allowGuestsToAdd: true,
      event: {
        hostId: HOST_ID,
        slug: EVENT_SLUG,
        coHosts: [],
      },
    });
    mockPollOptionFindFirst.mockResolvedValue(null); // No existing duplicate option
    mockPollOptionCreate.mockResolvedValue({ id: "option-new" });
  });

  it("allows a host to add a poll option", async () => {
    asHost();
    const result = await addPollOption("poll-1", "Fancy Cocktails", "Host Person");
    expect(result.success).toBe(true);
    expect(result.id).toBe("option-new");
    expect(mockPollOptionCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          pollId: "poll-1",
          text: "Fancy Cocktails",
          creatorName: null, // Host creator is null
        }),
      })
    );
  });

  it("allows an approved guest to suggest an option when allowGuestsToAdd is true", async () => {
    mockGetSession.mockResolvedValue(null);
    mockRsvpFindFirst.mockResolvedValue({ id: "rsvp-1", guestName: "Alice", approved: true });

    const result = await addPollOption("poll-1", "Gin & Tonic", "Alice", "rsvp-1");
    expect(result.success).toBe(true);
    expect(mockPollOptionCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          pollId: "poll-1",
          text: "Gin & Tonic",
          creatorName: "Alice",
        }),
      })
    );
  });

  it("throws error if guest suggests an option but allowGuestsToAdd is false", async () => {
    mockPollFindUnique.mockResolvedValue({
      id: "poll-1",
      eventId: EVENT_ID,
      allowGuestsToAdd: false,
      event: {
        hostId: HOST_ID,
        slug: EVENT_SLUG,
        coHosts: [],
      },
    });

    mockGetSession.mockResolvedValue(null);
    await expect(addPollOption("poll-1", "Gin & Tonic", "Alice", "rsvp-1")).rejects.toThrow(
      "Guests are not allowed to add options to this poll"
    );
  });

  it("throws error if option already exists", async () => {
    asHost();
    mockPollOptionFindFirst.mockResolvedValue({ id: "existing-opt" });
    await expect(addPollOption("poll-1", "Fancy Cocktails", "Host Person")).rejects.toThrow(
      "Option already exists"
    );
  });

  it("throws validation error for empty option text", async () => {
    asHost();
    await expect(addPollOption("poll-1", "   ", "Host Person")).rejects.toThrow(
      "Option text cannot be empty"
    );
  });
});
