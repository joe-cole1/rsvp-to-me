// Issue #879 — Read-only Potluck pre-RSVP, Going-only potluck claiming,
// potluck RSC redaction, and per-poll open voting (`requireRsvp: false`).
//
// Root causes:
//   1. Potluck items were hidden before RSVP; revealing them read-only required
//      redacting non-viewer `claim.guestName` and `potluck_claim`/`potluck_unclaim`
//      activity in `stripHostOnlyEventData` per `guestListVis` so names never
//      leak in the RSC payload while keeping remaining quantities accurate.
//   2. `claimPotluckItem` accepted any approved RSVP token without checking
//      `status === "GOING"` and `responded !== false`.
//   3. Open polls (`requireRsvp: false`) needed an unspoofable `HttpOnly` browser
//      voter token (`lib/poll-voter-token.ts`) gated by `resolveEventAccess`,
//      Turnstile CAPTCHA, and rate limiting, plus duplicate-safe vote linking
//      when an anonymous voter later submits an RSVP via `addRSVP`.

import "@/tests/helpers/english-request-locale";
import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockCookieGet,
  mockCookieSet,
  mockHeadersGet,
  mockGetSession,
  mockResolveEventAccess,
  mockAssertCaptcha,
  mockRateLimit,
  mockCreateGuestRsvp,
  mockEventFindUnique,
  mockUserFindUnique,
  mockRsvpFindFirst,
  mockPotluckItemFindUnique,
  mockPotluckClaimCreate,
  mockPotluckClaimDelete,
  mockPollCreate,
  mockPollFindUnique,
  mockPollUpdate,
  mockPollOptionCreateMany,
  mockPollOptionCreate,
  mockPollOptionFindFirst,
  mockPollOptionFindUnique,
  mockPollVoteFindMany,
  mockPollVoteCreate,
  mockPollVoteDeleteMany,
  mockPollVoteUpdateMany,
  mockActivityEventCreate,
} = vi.hoisted(() => ({
  mockCookieGet: vi.fn(),
  mockCookieSet: vi.fn(),
  mockHeadersGet: vi.fn(),
  mockGetSession: vi.fn(),
  mockResolveEventAccess: vi.fn(),
  mockAssertCaptcha: vi.fn(),
  mockRateLimit: vi.fn(),
  mockCreateGuestRsvp: vi.fn(),
  mockEventFindUnique: vi.fn(),
  mockUserFindUnique: vi.fn(),
  mockRsvpFindFirst: vi.fn(),
  mockPotluckItemFindUnique: vi.fn(),
  mockPotluckClaimCreate: vi.fn(),
  mockPotluckClaimDelete: vi.fn(),
  mockPollCreate: vi.fn(),
  mockPollFindUnique: vi.fn(),
  mockPollUpdate: vi.fn(),
  mockPollOptionCreateMany: vi.fn(),
  mockPollOptionCreate: vi.fn(),
  mockPollOptionFindFirst: vi.fn(),
  mockPollOptionFindUnique: vi.fn(),
  mockPollVoteFindMany: vi.fn(),
  mockPollVoteCreate: vi.fn(),
  mockPollVoteDeleteMany: vi.fn(),
  mockPollVoteUpdateMany: vi.fn(),
  mockActivityEventCreate: vi.fn().mockResolvedValue({ id: "act-1" }),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({
    get: mockCookieGet,
    set: mockCookieSet,
  }),
  headers: vi.fn().mockResolvedValue({
    get: mockHeadersGet,
  }),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/session", () => ({ getSession: mockGetSession }));
vi.mock("@/lib/eventAccess", () => ({ resolveEventAccess: mockResolveEventAccess }));
vi.mock("@/lib/captcha", () => ({ assertCaptcha: mockAssertCaptcha }));
vi.mock("@/lib/rateLimit", () => ({ rateLimit: mockRateLimit }));
vi.mock("@/lib/rsvp-service", () => ({
  createGuestRsvp: mockCreateGuestRsvp,
  updateGuestRsvp: vi.fn(),
}));
vi.mock("@/lib/notifications/service", () => ({
  notifyRsvp: vi.fn().mockResolvedValue(undefined),
  notifyHostAlert: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/email", () => ({
  sendRsvpConfirmationEmail: vi.fn(),
  sendBlastEmail: vi.fn(),
}));
vi.mock("@/lib/sms", () => ({
  sendRsvpConfirmationSms: vi.fn(),
  sendSmsBlast: vi.fn(),
}));

vi.mock("@/lib/db", () => {
  const dbClient = {
    $executeRaw: vi.fn(),
    event: { findUnique: mockEventFindUnique },
    user: { findUnique: mockUserFindUnique },
    rSVP: { findFirst: mockRsvpFindFirst },
    potluckItem: { findUnique: mockPotluckItemFindUnique },
    potluckClaim: {
      create: mockPotluckClaimCreate,
      delete: mockPotluckClaimDelete,
    },
    poll: {
      create: mockPollCreate,
      findUnique: mockPollFindUnique,
      update: mockPollUpdate,
    },
    pollOption: {
      createMany: mockPollOptionCreateMany,
      create: mockPollOptionCreate,
      findFirst: mockPollOptionFindFirst,
      findUnique: mockPollOptionFindUnique,
    },
    pollVote: {
      findMany: mockPollVoteFindMany,
      create: mockPollVoteCreate,
      deleteMany: mockPollVoteDeleteMany,
      updateMany: mockPollVoteUpdateMany,
    },
    activityEvent: { create: mockActivityEventCreate },
  };
  return {
    db: {
      ...dbClient,
      $transaction: vi.fn(async (cb: (tx: typeof dbClient) => Promise<unknown>) => cb(dbClient)),
    },
  };
});

import { stripHostOnlyEventData, type GuestListViewer } from "@/lib/guestList";
import { hashToken } from "@/lib/hash";
import {
  POLL_VOTER_COOKIE,
  readPollVoterTokenHash,
  getOrCreatePollVoterTokenHash,
} from "@/lib/poll-voter-token";
import { claimPotluckItem, unclaimPotluckItem } from "@/app/actions/event/potluck";
import { createPoll, updatePollSettings, castVote, addPollOption } from "@/app/actions/event/polls";
import { addRSVP } from "@/app/actions/event/rsvp";

const HOST_ID = "host-1";
const EVENT_ID = "event-1";
const EVENT_SLUG = "summer-potluck";
const VALID_COOKIE_TOKEN = "123e4567-e89b-12d3-a456-426614174000";

const anonViewer: GuestListViewer = {
  isHost: false,
  isLoggedInGuest: false,
  hasValidToken: false,
};

const tokenViewer: GuestListViewer = {
  isHost: false,
  isLoggedInGuest: false,
  hasValidToken: true,
};

const hostViewer: GuestListViewer = {
  isHost: true,
  isLoggedInGuest: false,
  hasValidToken: false,
};

function samplePotluckEvent(guestListVis: "ALL" | "GUESTS_ONLY" | "HOST_ONLY") {
  return {
    id: EVENT_ID,
    guestListVis,
    host: { email: "host@example.com" },
    coHosts: [{ user: { email: "cohost@example.com" } }],
    rsvps: [{ id: "rsvp-1", guestName: "Alice" }],
    potluckItems: [
      {
        id: "item-1",
        label: "Pasta Salad",
        quantity: 3,
        claims: [
          { id: "claim-1", guestName: "Alice", quantity: 1, isMine: true },
          { id: "claim-2", guestName: "Bob", quantity: 1, isMine: false },
        ],
      },
    ],
    activityEvents: [
      { id: "a1", type: "potluck_claim", detail: "Alice is bringing: Pasta Salad" },
      { id: "a2", type: "potluck_unclaim", detail: "Bob won't bring: Pasta Salad" },
      { id: "a3", type: "poll_create", detail: 'created a new poll: "Drinks?"' },
    ],
  };
}

function baseOpenPoll(overrides: Record<string, unknown> = {}) {
  return {
    id: "poll-1",
    eventId: EVENT_ID,
    question: "What drinks?",
    multiChoice: false,
    allowGuestsToAdd: true,
    locked: false,
    hideVoters: false,
    requireRsvp: false,
    event: {
      id: EVENT_ID,
      hostId: HOST_ID,
      slug: EVENT_SLUG,
      status: "PUBLISHED",
      visibility: "PUBLIC",
      passwordHash: null,
      coHosts: [],
    },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetSession.mockResolvedValue(null);
  mockCookieGet.mockReturnValue(undefined);
  mockHeadersGet.mockReturnValue(null);
  mockResolveEventAccess.mockResolvedValue({ decision: "granted" });
  mockAssertCaptcha.mockResolvedValue(undefined);
  mockRateLimit.mockResolvedValue({ success: true });
  mockActivityEventCreate.mockResolvedValue({ id: "act-1" });
});

// ── a) stripHostOnlyEventData ────────────────────────────────────────────────

describe("stripHostOnlyEventData — potluck & activity RSC redaction (#879)", () => {
  it("ALL: anonymous pre-RSVP viewer keeps potluck claimer names and potluck_claim activity", () => {
    const out = stripHostOnlyEventData(samplePotluckEvent("ALL"), anonViewer);
    expect(out.potluckItems[0].claims).toEqual([
      { id: "claim-1", guestName: "Alice", quantity: 1, isMine: true },
      { id: "claim-2", guestName: "Bob", quantity: 1, isMine: false },
    ]);
    expect(out.activityEvents.map((a) => a.type)).toEqual([
      "potluck_claim",
      "potluck_unclaim",
      "poll_create",
    ]);
  });

  it("GUESTS_ONLY: strips non-isMine claim.guestName while preserving quantity & strips potluck activity for anonymous viewer, but keeps for RSVP token holder", () => {
    const anonEvent = samplePotluckEvent("GUESTS_ONLY");
    anonEvent.potluckItems[0].claims = [
      { id: "claim-1", guestName: "Alice", quantity: 1, isMine: false },
      { id: "claim-2", guestName: "Bob", quantity: 2, isMine: false },
    ];
    const redacted = stripHostOnlyEventData(anonEvent, anonViewer);
    expect(redacted.potluckItems[0].claims).toEqual([
      { id: "claim-1", guestName: "", quantity: 1, isMine: false },
      { id: "claim-2", guestName: "", quantity: 2, isMine: false },
    ]);
    expect(redacted.activityEvents.map((a) => a.type)).toEqual(["poll_create"]);

    const allowed = stripHostOnlyEventData(samplePotluckEvent("GUESTS_ONLY"), tokenViewer);
    expect(allowed.potluckItems[0].claims.map((c) => c.guestName)).toEqual(["Alice", "Bob"]);
    expect(allowed.activityEvents.map((a) => a.type)).toEqual([
      "potluck_claim",
      "potluck_unclaim",
      "poll_create",
    ]);
  });

  it("HOST_ONLY: strips other guests' claim names while keeping isMine name + all quantities and strips potluck activity for token holder; keeps everything for host", () => {
    const nonHostOut = stripHostOnlyEventData(samplePotluckEvent("HOST_ONLY"), tokenViewer);
    expect(nonHostOut.potluckItems[0].claims).toEqual([
      { id: "claim-1", guestName: "Alice", quantity: 1, isMine: true },
      { id: "claim-2", guestName: "", quantity: 1, isMine: false },
    ]);
    expect(nonHostOut.activityEvents.map((a) => a.type)).toEqual(["poll_create"]);

    const hostOut = stripHostOnlyEventData(samplePotluckEvent("HOST_ONLY"), hostViewer);
    expect(hostOut.potluckItems[0].claims.map((c) => c.guestName)).toEqual(["Alice", "Bob"]);
    expect(hostOut.activityEvents.map((a) => a.type)).toEqual([
      "potluck_claim",
      "potluck_unclaim",
      "poll_create",
    ]);
  });
});

// ── b) lib/poll-voter-token.ts ───────────────────────────────────────────────

describe("lib/poll-voter-token.ts", () => {
  it("readPollVoterTokenHash returns null for missing, short, and >128-char cookies", async () => {
    mockCookieGet.mockReturnValueOnce(undefined);
    expect(await readPollVoterTokenHash()).toBeNull();

    mockCookieGet.mockReturnValueOnce({ value: "short" });
    expect(await readPollVoterTokenHash()).toBeNull();

    mockCookieGet.mockReturnValueOnce({ value: "a".repeat(129) });
    expect(await readPollVoterTokenHash()).toBeNull();
  });

  it("readPollVoterTokenHash returns null when cookies() is called outside a request scope", async () => {
    const { cookies } = await import("next/headers");
    vi.mocked(cookies).mockRejectedValueOnce(
      new Error("`cookies` was called outside a request scope.")
    );
    expect(await readPollVoterTokenHash()).toBeNull();
  });

  it("readPollVoterTokenHash returns hashToken(token) for a valid UUID", async () => {
    mockCookieGet.mockReturnValueOnce({ value: VALID_COOKIE_TOKEN });
    expect(await readPollVoterTokenHash()).toBe(hashToken(VALID_COOKIE_TOKEN));
  });

  it("getOrCreatePollVoterTokenHash reuses an existing valid cookie without calling set", async () => {
    mockCookieGet.mockReturnValueOnce({ value: VALID_COOKIE_TOKEN });
    const result = await getOrCreatePollVoterTokenHash();
    expect(result).toBe(hashToken(VALID_COOKIE_TOKEN));
    expect(mockCookieSet).not.toHaveBeenCalled();
  });

  it("getOrCreatePollVoterTokenHash mints a fresh httpOnly sameSite=lax cookie when missing", async () => {
    mockCookieGet.mockReturnValueOnce(undefined);
    const result = await getOrCreatePollVoterTokenHash();

    expect(mockCookieSet).toHaveBeenCalledTimes(1);
    const [cookieName, mintedToken, options] = mockCookieSet.mock.calls[0];
    expect(cookieName).toBe(POLL_VOTER_COOKIE);
    expect(typeof mintedToken).toBe("string");
    expect(mintedToken.length).toBeGreaterThanOrEqual(16);
    expect(options).toEqual(
      expect.objectContaining({
        httpOnly: true,
        sameSite: "lax",
        path: "/",
      })
    );
    expect(result).toBe(hashToken(mintedToken));
  });
});

// ── c) claimPotluckItem & unclaimPotluckItem ─────────────────────────────────

describe("claimPotluckItem & unclaimPotluckItem (#879)", () => {
  const potluckItemRow = {
    id: "item-1",
    eventId: EVENT_ID,
    label: "Pasta Salad",
    quantity: 3,
    claims: [],
    event: { slug: EVENT_SLUG, hostId: HOST_ID, coHosts: [] },
  };

  beforeEach(() => {
    mockPotluckItemFindUnique.mockResolvedValue(potluckItemRow);
  });

  it.each([
    {
      label: "MAYBE",
      rsvp: { id: "rsvp-1", guestName: "Alice", status: "MAYBE", responded: true },
    },
    { label: "NO", rsvp: { id: "rsvp-1", guestName: "Alice", status: "NO", responded: true } },
    {
      label: "unresponded",
      rsvp: { id: "rsvp-1", guestName: "Alice", status: "GOING", responded: false },
    },
  ])("rejects $label RSVP on claimPotluckItem", async ({ rsvp }) => {
    mockRsvpFindFirst.mockResolvedValueOnce(rsvp);

    const res = await claimPotluckItem("item-1", "Alice", 1, "tok-alice");
    expect(res).toEqual({
      success: false,
      error: "Only approved Going guests can claim potluck items.",
    });
    expect(mockPotluckClaimCreate).not.toHaveBeenCalled();
  });

  it("accepts approved responded GOING RSVP on claimPotluckItem", async () => {
    mockRsvpFindFirst.mockResolvedValueOnce({
      id: "rsvp-1",
      guestName: "Alice",
      status: "GOING",
      responded: true,
    });
    mockPotluckClaimCreate.mockResolvedValueOnce({
      id: "claim-1",
      potluckItemId: "item-1",
      guestName: "Alice",
      quantity: 1,
      rsvpId: "rsvp-1",
    });

    const res = await claimPotluckItem("item-1", "Spoofed Name", 1, "tok-alice");
    expect(res.success).toBe(true);
    expect(mockPotluckClaimCreate).toHaveBeenCalledWith({
      data: {
        potluckItemId: "item-1",
        guestName: "Alice",
        quantity: 1,
        rsvpId: "rsvp-1",
        userId: null,
      },
    });
  });

  it.each(["MAYBE", "NO"] as const)(
    "allows a guest who owns claim.rsvpId to unclaimPotluckItem even if status is now %s",
    async (status) => {
      mockPotluckItemFindUnique.mockResolvedValueOnce({
        ...potluckItemRow,
        claims: [{ id: "claim-1", potluckItemId: "item-1", rsvpId: "rsvp-1", guestName: "Alice" }],
      });
      mockRsvpFindFirst.mockResolvedValueOnce({
        id: "rsvp-1",
        guestName: "Alice",
        status,
        responded: true,
      });
      mockPotluckClaimDelete.mockResolvedValueOnce({ id: "claim-1" });

      const res = await unclaimPotluckItem("item-1", "claim-1", "tok-alice");
      expect(res.success).toBe(true);
      expect(mockPotluckClaimDelete).toHaveBeenCalledWith({ where: { id: "claim-1" } });
    }
  );
});

// ── d) Polls requireRsvp & open-poll voting + addRSVP vote linking ───────────

describe("polls requireRsvp, open-poll voting, and addRSVP vote linking (#879)", () => {
  it("createPoll and updatePollSettings persist requireRsvp: false", async () => {
    mockGetSession.mockResolvedValue({ userId: HOST_ID, email: "host@example.com" });
    mockEventFindUnique.mockResolvedValue({ hostId: HOST_ID, slug: EVENT_SLUG, coHosts: [] });
    mockUserFindUnique.mockResolvedValue({ name: "Hank Host", email: "host@example.com" });
    mockPollCreate.mockResolvedValue({ id: "poll-new" });
    mockPollFindUnique.mockResolvedValue({
      id: "poll-new",
      eventId: EVENT_ID,
      question: "What drinks?",
    });
    mockPollUpdate.mockResolvedValue({ id: "poll-new" });

    const created = await createPoll(
      EVENT_ID,
      "What drinks?",
      ["Sparkling Water", "Juice"],
      false,
      true,
      false,
      null,
      false
    );
    expect(created).toEqual({ success: true, id: "poll-new" });
    expect(mockPollCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          requireRsvp: false,
        }),
      })
    );

    const updated = await updatePollSettings("poll-new", { requireRsvp: false });
    expect(updated).toEqual({ success: true });
    expect(mockPollUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "poll-new" },
        data: expect.objectContaining({ requireRsvp: false }),
      })
    );
  });

  describe("when poll.requireRsvp === true", () => {
    beforeEach(() => {
      mockPollFindUnique.mockResolvedValue(baseOpenPoll({ requireRsvp: true }));
      mockPollOptionFindUnique.mockResolvedValue({ id: "opt-1", text: "Sparkling Water" });
    });

    it("rejects NO RSVP and unresponded INVITED RSVP", async () => {
      mockRsvpFindFirst.mockResolvedValueOnce({
        id: "rsvp-no",
        guestName: "Bob",
        status: "NO",
        responded: true,
      });
      await expect(castVote("poll-1", "opt-1", "Bob", true, "tok-bob")).rejects.toThrow(
        "Unauthorized: a valid approved RSVP is required to vote"
      );

      mockRsvpFindFirst.mockResolvedValueOnce({
        id: "rsvp-inv",
        guestName: "Carol",
        status: "INVITED",
        responded: false,
      });
      await expect(castVote("poll-1", "opt-1", "Carol", true, "tok-carol")).rejects.toThrow(
        "Unauthorized: a valid approved RSVP is required to vote"
      );
      expect(mockPollVoteCreate).not.toHaveBeenCalled();
    });

    it.each(["GOING", "MAYBE"] as const)("accepts responded %s RSVP", async (status) => {
      mockRsvpFindFirst.mockResolvedValueOnce({
        id: `rsvp-${status}`,
        guestName: "Alice",
        status,
        responded: true,
      });

      const res = await castVote("poll-1", "opt-1", "Spoofed", true, "tok-alice");
      expect(res).toEqual({ success: true });
      expect(mockPollVoteCreate).toHaveBeenCalledWith({
        data: {
          pollId: "poll-1",
          pollOptionId: "opt-1",
          voterName: "Alice",
          rsvpId: `rsvp-${status}`,
          userId: null,
          voterTokenHash: null,
        },
      });
    });
  });

  describe("when poll.requireRsvp === false", () => {
    beforeEach(() => {
      mockPollFindUnique.mockResolvedValue(baseOpenPoll({ requireRsvp: false }));
      mockPollOptionFindUnique.mockResolvedValue({ id: "opt-1", text: "Sparkling Water" });
    });

    it.each(["private-blocked", "password"] as const)(
      "rejects anonymous caller when resolveEventAccess returns %s",
      async (decision) => {
        mockResolveEventAccess.mockResolvedValueOnce({ decision });
        await expect(
          castVote("poll-1", "opt-1", "Sam", true, undefined, "cap-tok")
        ).rejects.toThrow("Forbidden");
        expect(mockPollVoteCreate).not.toHaveBeenCalled();
      }
    );

    it("rejects anonymous caller when event.status !== PUBLISHED", async () => {
      mockPollFindUnique.mockResolvedValueOnce(
        baseOpenPoll({
          requireRsvp: false,
          event: {
            id: EVENT_ID,
            hostId: HOST_ID,
            slug: EVENT_SLUG,
            status: "DRAFT",
            visibility: "PUBLIC",
            passwordHash: null,
            coHosts: [],
          },
        })
      );
      await expect(castVote("poll-1", "opt-1", "Sam", true, undefined, "cap-tok")).rejects.toThrow(
        "Forbidden"
      );
      expect(mockPollVoteCreate).not.toHaveBeenCalled();
    });

    it("rejects empty voterName and rate-limited requests", async () => {
      await expect(castVote("poll-1", "opt-1", "   ", true, undefined, "cap-tok")).rejects.toThrow(
        "Enter your name to vote."
      );

      mockRateLimit.mockResolvedValueOnce({ success: false });
      await expect(castVote("poll-1", "opt-1", "Sam", true, undefined, "cap-tok")).rejects.toThrow(
        "Too many poll actions. Please try again later."
      );
      expect(mockPollVoteCreate).not.toHaveBeenCalled();
    });

    it("verifies assertCaptcha('poll_vote', captchaToken) and replaces only that voterTokenHash in single-choice polls", async () => {
      mockCookieGet.mockReturnValueOnce({ value: VALID_COOKIE_TOKEN });
      const expectedHash = hashToken(VALID_COOKIE_TOKEN);

      const res = await castVote("poll-1", "opt-1", "Sam", true, undefined, "turnstile-token");
      expect(res).toEqual({ success: true });

      expect(mockAssertCaptcha).toHaveBeenCalledWith("poll_vote", "turnstile-token");
      expect(mockPollVoteDeleteMany).toHaveBeenCalledWith({
        where: {
          pollId: "poll-1",
          voterTokenHash: expectedHash,
          rsvpId: null,
          userId: null,
        },
      });
      // Scope is strictly by voterTokenHash, never voterName, so another voter
      // sharing the name "Sam" is untouched.
      expect(mockPollVoteDeleteMany.mock.calls[0][0].where).not.toHaveProperty("voterName");
      expect(mockPollVoteCreate).toHaveBeenCalledWith({
        data: {
          pollId: "poll-1",
          pollOptionId: "opt-1",
          voterName: "Sam",
          rsvpId: null,
          userId: null,
          voterTokenHash: expectedHash,
        },
      });
    });

    it("retracting without a voter cookie returns { success: true } without deleting anyone else's vote", async () => {
      mockCookieGet.mockReturnValueOnce(undefined);
      const res = await castVote("poll-1", "opt-1", "Sam", false, undefined, "turnstile-token");
      expect(res).toEqual({ success: true });
      expect(mockPollVoteDeleteMany).not.toHaveBeenCalled();
    });

    it("retracting with a valid voter cookie deletes only { pollId, pollOptionId, voterTokenHash, rsvpId: null, userId: null }", async () => {
      mockCookieGet.mockReturnValueOnce({ value: VALID_COOKIE_TOKEN });
      const expectedHash = hashToken(VALID_COOKIE_TOKEN);

      const res = await castVote("poll-1", "opt-1", "Sam", false, undefined, "turnstile-token");
      expect(res).toEqual({ success: true });
      expect(mockPollVoteDeleteMany).toHaveBeenCalledWith({
        where: {
          pollId: "poll-1",
          pollOptionId: "opt-1",
          voterTokenHash: expectedHash,
          rsvpId: null,
          userId: null,
        },
      });
    });

    it("allows signed-in non-RSVP viewer to vote with userId on an open poll", async () => {
      mockGetSession.mockResolvedValue({ userId: "user-9", email: "user9@example.com" });
      mockUserFindUnique.mockResolvedValue({ name: "Signed In User" });

      const res = await castVote("poll-1", "opt-1", "Ignored", true, undefined, "turnstile-token");
      expect(res).toEqual({ success: true });
      expect(mockPollVoteCreate).toHaveBeenCalledWith({
        data: {
          pollId: "poll-1",
          pollOptionId: "opt-1",
          voterName: "Signed In User",
          rsvpId: null,
          userId: "user-9",
          voterTokenHash: null,
        },
      });
    });

    it("allows anonymous voter with valid name to addPollOption on open poll when allowGuestsToAdd is true", async () => {
      mockPollOptionFindFirst.mockResolvedValueOnce(null);
      mockPollOptionCreate.mockResolvedValueOnce({ id: "opt-new" });

      const res = await addPollOption("poll-1", "Kombucha", "Sam", undefined, "cap-opt-token");
      expect(res).toEqual({ success: true, id: "opt-new" });
      expect(mockAssertCaptcha).toHaveBeenCalledWith("poll_option", "cap-opt-token");
      expect(mockPollOptionCreate).toHaveBeenCalledWith({
        data: {
          pollId: "poll-1",
          text: "Kombucha",
          creatorName: "Sam",
        },
      });
      expect(mockCookieSet).toHaveBeenCalledTimes(1);
    });
  });

  describe("addRSVP open-poll vote linking", () => {
    it("links matching voterTokenHash PollVote rows on that event to the new rsvpId, deleting duplicate options already voted by rsvpId first", async () => {
      const voterHash = hashToken(VALID_COOKIE_TOKEN);
      mockCookieGet.mockReturnValueOnce({ value: VALID_COOKIE_TOKEN });
      mockCreateGuestRsvp.mockResolvedValueOnce({
        success: true,
        id: "rsvp-new",
        editToken: "edit-tok-new",
        slug: EVENT_SLUG,
      });
      mockPollVoteFindMany.mockResolvedValueOnce([{ pollOptionId: "opt-already-voted" }]);
      mockPollVoteDeleteMany.mockResolvedValueOnce({ count: 1 });
      mockPollVoteUpdateMany.mockResolvedValueOnce({ count: 2 });

      const res = await addRSVP(
        {
          eventId: EVENT_ID,
          guestName: "Sam Smith",
          status: "GOING",
          plusOneCount: 0,
        },
        "cap-rsvp-token"
      );

      expect(res).toEqual({
        success: true,
        id: "rsvp-new",
        editToken: "edit-tok-new",
      });
      expect(mockPollVoteFindMany).toHaveBeenCalledWith({
        where: { rsvpId: "rsvp-new", poll: { eventId: EVENT_ID } },
        select: { pollOptionId: true },
      });
      expect(mockPollVoteDeleteMany).toHaveBeenCalledWith({
        where: {
          voterTokenHash: voterHash,
          rsvpId: null,
          pollOptionId: { in: ["opt-already-voted"] },
        },
      });
      expect(mockPollVoteUpdateMany).toHaveBeenCalledWith({
        where: {
          voterTokenHash: voterHash,
          rsvpId: null,
          poll: { eventId: EVENT_ID },
        },
        data: {
          rsvpId: "rsvp-new",
          voterTokenHash: null,
          voterName: "Sam Smith",
        },
      });
      const deleteOrder = mockPollVoteDeleteMany.mock.invocationCallOrder[0];
      const updateOrder = mockPollVoteUpdateMany.mock.invocationCallOrder[0];
      expect(deleteOrder).toBeLessThan(updateOrder);
    });
  });
});
