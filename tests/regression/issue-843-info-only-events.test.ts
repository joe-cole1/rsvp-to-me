// Issue #843 (task [6d5da989]) — Info-only events without RSVPs (`Event.rsvpEnabled = false`).
//
// Coverage:
//   1. `createEvent` & `saveEventSettings`: creating an info-only event persists `rsvpEnabled: false`
//      and skips default `notificationSchedule` rows; enabling `rsvpEnabled: true` later seeds
//      default schedules once and marks already-elapsed offsets consumed.
//   2. `resolveEventAccess`: when `rsvpEnabled === false`, dormant RSVP `editToken`s and
//      `loggedInUserRsvp` rows never bypass a `PRIVATE` gate — only host/co-host sessions or the
//      signed password unlock cookie admit visitors.
//   3. RSVP/invite/check-in/blast/reminder/CSV guards when `rsvpEnabled === false`:
//      - `createGuestRsvp` / `updateGuestRsvp` return `rsvpsDisabled`
//      - `requestRsvpContactProof` returns `rsvpsDisabled`
//      - `checkInRsvp` / `addWalkIn` reject with `rsvpsDisabled`
//      - `previewGuestInvitations`, `sendGuestInvitations`, `inviteFriendAsGuest` reject
//      - `sendBlast` returns `{ success: false, sent: 0 }` and `addEventUpdate` skips `notifyEventUpdate`
//      - `guests.csv` returns 404; `next.config.ts` sets `private, no-store` on `questionnaire.csv`
//   4. Standalone questionnaires (`submitQuestionnaireResponse` + `/e/[slug]/questionnaire.csv`):
//      enforces `rsvpEnabled === false`, `resolveEventAccess`, CAPTCHA, rate limiting, required &
//      option validation, creates/updates per `userId` or `HttpOnly` `voterTokenHash`, and exports
//      standalone + RSVP answers with `SEC-16` formula-injection escaping.
//   5. Open polls & comments and disabled potluck on info-only events:
//      - `castVote` & `addPollOption` ignore `poll.requireRsvp: true` when `event.rsvpEnabled === false`
//      - `addComment` allows signed-in and anonymous visitors (with validated display name, CAPTCHA,
//        rate limit, and `voterTokenHash`) across `PUBLIC`, `UNLISTED`, and password-unlocked `PRIVATE`
//      - `claimPotluckItem` & `addPotluckItem` reject with `rsvpsDisabled`

import "@/tests/helpers/english-request-locale";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { unstable_getResponseFromNextConfig } from "next/experimental/testing/server";
import nextConfig from "../../next.config";

const {
  mockCookieGet,
  mockCookieSet,
  mockHeadersGet,
  mockRedirect,
  mockGetSession,
  mockGetSessionUser,
  mockAssertCaptcha,
  mockRateLimit,
  mockNotifyEventUpdate,
  mockEventCreate,
  mockEventFindUnique,
  mockEventUpdate,
  mockEventUpdateCreate,
  mockUserFindUnique,
  mockRsvpFindFirst,
  mockRsvpFindUnique,
  mockRsvpFindMany,
  mockNotificationScheduleCount,
  mockNotificationScheduleCreateMany,
  mockQuestionnaireFindUnique,
  mockQuestionnaireCreate,
  mockQuestionnaireUpdate,
  mockQuestionnaireFindMany,
  mockQuestionnaireAnswerDeleteMany,
  mockQuestionnaireAnswerCreateMany,
  mockPollCreate,
  mockPollFindUnique,
  mockPollOptionCreateMany,
  mockPollOptionCreate,
  mockPollOptionFindFirst,
  mockPollOptionFindUnique,
  mockPollVoteDeleteMany,
  mockPollVoteCreate,
  mockCommentFindFirst,
  mockCommentCreate,
  mockPotluckItemCreate,
  mockPotluckItemFindUnique,
  mockActivityEventCreate,
  mockExecuteRaw,
  dbMock,
} = vi.hoisted(() => {
  const mockCookieGet = vi.fn();
  const mockCookieSet = vi.fn();
  const mockHeadersGet = vi.fn();
  const mockRedirect = vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  });
  const mockGetSession = vi.fn();
  const mockGetSessionUser = vi.fn();
  const mockAssertCaptcha = vi.fn();
  const mockRateLimit = vi.fn();
  const mockNotifyEventUpdate = vi.fn();
  const mockEventCreate = vi.fn();
  const mockEventFindUnique = vi.fn();
  const mockEventUpdate = vi.fn();
  const mockEventUpdateCreate = vi.fn();
  const mockUserFindUnique = vi.fn();
  const mockRsvpFindFirst = vi.fn();
  const mockRsvpFindUnique = vi.fn();
  const mockRsvpFindMany = vi.fn();
  const mockNotificationScheduleCount = vi.fn();
  const mockNotificationScheduleCreateMany = vi.fn();
  const mockQuestionnaireFindUnique = vi.fn();
  const mockQuestionnaireCreate = vi.fn();
  const mockQuestionnaireUpdate = vi.fn();
  const mockQuestionnaireFindMany = vi.fn();
  const mockQuestionnaireAnswerDeleteMany = vi.fn();
  const mockQuestionnaireAnswerCreateMany = vi.fn();
  const mockPollCreate = vi.fn();
  const mockPollFindUnique = vi.fn();
  const mockPollOptionCreateMany = vi.fn();
  const mockPollOptionCreate = vi.fn();
  const mockPollOptionFindFirst = vi.fn();
  const mockPollOptionFindUnique = vi.fn();
  const mockPollVoteDeleteMany = vi.fn();
  const mockPollVoteCreate = vi.fn();
  const mockCommentFindFirst = vi.fn();
  const mockCommentCreate = vi.fn();
  const mockPotluckItemCreate = vi.fn();
  const mockPotluckItemFindUnique = vi.fn();
  const mockActivityEventCreate = vi.fn().mockResolvedValue({ id: "act-1" });
  const mockExecuteRaw = vi.fn().mockResolvedValue(1);

  const dbMock = {
    event: {
      create: mockEventCreate,
      findUnique: mockEventFindUnique,
      update: mockEventUpdate,
    },
    eventUpdate: {
      create: mockEventUpdateCreate,
    },
    user: {
      findUnique: mockUserFindUnique,
    },
    rSVP: {
      findFirst: mockRsvpFindFirst,
      findUnique: mockRsvpFindUnique,
      findMany: mockRsvpFindMany,
    },
    notificationSchedule: {
      count: mockNotificationScheduleCount,
      createMany: mockNotificationScheduleCreateMany,
    },
    questionnaireSubmission: {
      findUnique: mockQuestionnaireFindUnique,
      create: mockQuestionnaireCreate,
      update: mockQuestionnaireUpdate,
      findMany: mockQuestionnaireFindMany,
    },
    questionnaireAnswer: {
      deleteMany: mockQuestionnaireAnswerDeleteMany,
      createMany: mockQuestionnaireAnswerCreateMany,
    },
    poll: {
      create: mockPollCreate,
      findUnique: mockPollFindUnique,
    },
    pollOption: {
      createMany: mockPollOptionCreateMany,
      create: mockPollOptionCreate,
      findFirst: mockPollOptionFindFirst,
      findUnique: mockPollOptionFindUnique,
    },
    pollVote: {
      deleteMany: mockPollVoteDeleteMany,
      create: mockPollVoteCreate,
    },
    comment: {
      findFirst: mockCommentFindFirst,
      create: mockCommentCreate,
    },
    potluckItem: {
      create: mockPotluckItemCreate,
      findUnique: mockPotluckItemFindUnique,
    },
    activityEvent: {
      create: mockActivityEventCreate,
    },
    $executeRaw: mockExecuteRaw,
    $transaction: vi.fn(async (arg: unknown) => {
      if (typeof arg === "function") {
        return (arg as (tx: typeof dbMock) => Promise<unknown>)(dbMock);
      }
      return Promise.all(arg as Promise<unknown>[]);
    }),
  };

  return {
    mockCookieGet,
    mockCookieSet,
    mockHeadersGet,
    mockRedirect,
    mockGetSession,
    mockGetSessionUser,
    mockAssertCaptcha,
    mockRateLimit,
    mockNotifyEventUpdate,
    mockEventCreate,
    mockEventFindUnique,
    mockEventUpdate,
    mockEventUpdateCreate,
    mockUserFindUnique,
    mockRsvpFindFirst,
    mockRsvpFindUnique,
    mockRsvpFindMany,
    mockNotificationScheduleCount,
    mockNotificationScheduleCreateMany,
    mockQuestionnaireFindUnique,
    mockQuestionnaireCreate,
    mockQuestionnaireUpdate,
    mockQuestionnaireFindMany,
    mockQuestionnaireAnswerDeleteMany,
    mockQuestionnaireAnswerCreateMany,
    mockPollCreate,
    mockPollFindUnique,
    mockPollOptionCreateMany,
    mockPollOptionCreate,
    mockPollOptionFindFirst,
    mockPollOptionFindUnique,
    mockPollVoteDeleteMany,
    mockPollVoteCreate,
    mockCommentFindFirst,
    mockCommentCreate,
    mockPotluckItemCreate,
    mockPotluckItemFindUnique,
    mockActivityEventCreate,
    mockExecuteRaw,
    dbMock,
  };
});

vi.mock("next/navigation", () => ({
  redirect: mockRedirect,
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
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

vi.mock("@/lib/session", () => ({
  getSession: mockGetSession,
  destroySession: vi.fn(),
}));

vi.mock("@/lib/session-user", () => ({
  getSessionUser: mockGetSessionUser,
}));

vi.mock("@/lib/captcha", () => ({
  assertCaptcha: mockAssertCaptcha,
}));

vi.mock("@/lib/rateLimit", () => ({
  rateLimit: mockRateLimit,
}));

vi.mock("@/lib/clientIp", () => ({
  getClientIp: vi.fn().mockResolvedValue("127.0.0.1"),
  isTrustedIpConfigured: vi.fn().mockReturnValue(false),
}));

vi.mock("@/lib/slug", () => ({
  generateUniqueSlug: vi.fn().mockResolvedValue("flyer-slug"),
}));

vi.mock("@/lib/notifications/event-update", () => ({
  notifyEventUpdate: mockNotifyEventUpdate,
}));

vi.mock("@/lib/notifications/service", () => ({
  deliver: vi.fn(),
  offeredChannels: vi.fn().mockResolvedValue(["email"]),
  notifyRsvp: vi.fn(),
  notifyHostAlert: vi.fn(),
}));

vi.mock("@/lib/capacityLock", () => ({
  withEventCapacityLock: vi.fn(async (_eventId: string, fn: (tx: unknown) => Promise<unknown>) =>
    fn({
      event: { findUnique: mockEventFindUnique },
      rSVP: {
        findUnique: mockRsvpFindUnique,
        findFirst: mockRsvpFindFirst,
        count: vi.fn().mockResolvedValue(0),
      },
      $executeRaw: mockExecuteRaw,
    })
  ),
}));

vi.mock("@/lib/db", () => ({ db: dbMock }));

import { createEvent } from "@/app/actions/createEvent";
import { saveEventSettings } from "@/app/actions/event/settings";
import { resolveEventAccess } from "@/lib/eventAccess";
import { createGuestRsvp, updateGuestRsvp } from "@/lib/rsvp-service";
import { requestRsvpContactProof } from "@/lib/rsvp-contact-proof";
import { checkInRsvp, addWalkIn } from "@/app/actions/event/checkins";
import {
  previewGuestInvitations,
  sendGuestInvitations,
  inviteFriendAsGuest,
} from "@/app/actions/event/invites";
import { sendBlast, addEventUpdate } from "@/app/actions/event/blasts";
import { submitQuestionnaireResponse } from "@/app/actions/event/rsvpFields";
import { createPoll, castVote, addPollOption } from "@/app/actions/event/polls";
import { addComment } from "@/app/actions/event/comments";
import { addPotluckItem, claimPotluckItem } from "@/app/actions/event/potluck";
import { GET as getGuestsCsv } from "@/app/e/[slug]/guests.csv/route";
import { GET as getQuestionnaireCsv } from "@/app/e/[slug]/questionnaire.csv/route";
import { getUnlockSignature } from "@/lib/crypto";

describe("Issue #843: info-only events without RSVPs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCookieGet.mockReturnValue(undefined);
    mockGetSession.mockResolvedValue(null);
    mockGetSessionUser.mockResolvedValue(null);
    mockAssertCaptcha.mockResolvedValue(undefined);
    mockRateLimit.mockResolvedValue({ success: true });
  });

  describe("Creation & Settings lifecycle", () => {
    it("creates an info-only event with rsvpEnabled=false and omits reminder schedules", async () => {
      mockGetSession.mockResolvedValue({ userId: "host-1", role: "HOST", email: "h@test.local" });
      mockGetSessionUser.mockResolvedValue({ id: "host-1", role: "HOST", email: "h@test.local" });
      mockEventCreate.mockResolvedValue({ slug: "flyer-slug" });

      const form = new FormData();
      form.set("title", "Block Party Flyer");
      form.set("startDate", "2030-08-10");
      form.set("startTime", "18:00");
      form.set("visibility", "PUBLIC");
      form.set("rsvpEnabled", "false");

      await expect(createEvent(form)).rejects.toThrow("NEXT_REDIRECT:/e/flyer-slug");
      expect(mockEventCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            rsvpEnabled: false,
          }),
        })
      );
      const createData = mockEventCreate.mock.calls[0][0].data;
      expect(createData.notificationSchedule).toBeUndefined();
    });

    it("seeds default notification schedules once when turning RSVPs back on", async () => {
      mockGetSession.mockResolvedValue({ userId: "host-1", role: "HOST" });
      mockEventFindUnique
        .mockResolvedValueOnce({
          id: "evt-1",
          slug: "flyer",
          hostId: "host-1",
          coHosts: [],
        })
        .mockResolvedValueOnce({
          startAt: new Date(Date.now() + 48 * 3600 * 1000), // 48h out: 72h nudge elapsed, 24h reminder future
        });
      mockNotificationScheduleCount.mockResolvedValue(0);

      const res = await saveEventSettings("evt-1", { rsvpEnabled: true }, "tok");
      expect(res).toEqual({ success: true });
      expect(mockEventUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "evt-1" },
          data: expect.objectContaining({ rsvpEnabled: true }),
        })
      );
      expect(mockNotificationScheduleCreateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.arrayContaining([
            expect.objectContaining({ kind: "reminder", hoursBefore: 24, consumedAt: null }),
            expect.objectContaining({
              kind: "nudge",
              hoursBefore: 72,
              consumedAt: expect.any(Date),
            }),
          ]),
        })
      );
    });
  });

  describe("Access gate & dormant RSVP isolation", () => {
    it("ignores RSVP edit tokens and account RSVPs on PRIVATE info-only events", async () => {
      mockGetSessionUser.mockResolvedValue({ id: "guest-user", role: "GUEST" });
      const event = {
        id: "evt-priv",
        visibility: "PRIVATE",
        passwordHash: "hash-pw",
        rsvpEnabled: false,
        hostId: "host-1",
        coHosts: [],
      };

      const access = await resolveEventAccess(event, "priv-flyer", { token: "dormant-edit-token" });
      expect(access.hasValidToken).toBe(false);
      expect(access.isLoggedInGuest).toBe(false);
      expect(access.decision).toBe("password");
      expect(mockRsvpFindFirst).not.toHaveBeenCalled();
    });

    it("grants access on PRIVATE info-only event when valid password unlock cookie is present", async () => {
      const event = {
        id: "evt-priv",
        visibility: "PRIVATE",
        passwordHash: "hash-pw",
        rsvpEnabled: false,
        hostId: "host-1",
        coHosts: [],
      };
      mockCookieGet.mockReturnValue({
        value: getUnlockSignature("priv-flyer", "hash-pw"),
      });

      const access = await resolveEventAccess(event, "priv-flyer");
      expect(access.decision).toBe("granted");
    });
  });

  describe("Disabled RSVP, check-in, invite, blast & CSV guards", () => {
    it("blocks public RSVP creation, edits, and contact verification", async () => {
      mockEventFindUnique.mockResolvedValue({
        id: "evt-1",
        slug: "flyer",
        title: "Flyer",
        status: "PUBLISHED",
        rsvpEnabled: false,
        visibility: "PUBLIC",
        passwordHash: null,
        hostId: "host-1",
        coHosts: [],
        startAt: new Date(Date.now() + 86400_000),
        rsvpDeadline: null,
        allowEditAfterDeadline: false,
        maybeEnabled: true,
        plusOneAllowed: false,
        plusOneMax: 0,
        plusOneNamesRequired: false,
        capacity: null,
        approvalRequired: false,
        rsvpFields: [],
        host: { name: "Host", email: "h@test.local", phone: null, preferredLocale: "en-US" },
        theme: null,
        hostAlertEmail: false,
        hostAlertSms: false,
      });

      const addRes = await createGuestRsvp({
        eventId: "evt-1",
        guestName: "Pat",
        status: "GOING",
        plusOneCount: 0,
      });
      expect(addRes).toEqual({ success: false, reason: "rsvpsDisabled" });

      mockRsvpFindUnique.mockResolvedValueOnce({ eventId: "evt-1" }).mockResolvedValueOnce({
        id: "rsvp-1",
        eventId: "evt-1",
        status: "INVITED",
        responded: false,
        plusOneGuests: [],
        event: {
          id: "evt-1",
          slug: "flyer",
          status: "PUBLISHED",
          rsvpEnabled: false,
          startAt: new Date(Date.now() + 86400_000),
          rsvpDeadline: null,
          allowEditAfterDeadline: false,
          maybeEnabled: true,
          plusOneAllowed: false,
          plusOneMax: 0,
          plusOneNamesRequired: false,
        },
      });

      const editRes = await updateGuestRsvp("edit-tok", { status: "GOING", plusOneCount: 0 });
      expect(editRes).toEqual({ success: false, reason: "rsvpsDisabled" });

      const proofRes = await requestRsvpContactProof({
        eventId: "evt-1",
        channel: "email",
        destination: "pat@example.test",
      });
      expect(proofRes).toEqual({ success: false, reason: "rsvpsDisabled" });
    });

    it("blocks check-ins, walk-ins, invitations, blasts, and guest notifications on updates", async () => {
      mockGetSession.mockResolvedValue({ userId: "host-1", role: "HOST", email: "h@test.local" });
      mockRsvpFindUnique.mockResolvedValue({
        id: "rsvp-1",
        eventId: "evt-1",
        guestName: "Pat",
        approved: true,
        status: "GOING",
        event: { slug: "flyer", rsvpEnabled: false },
      });
      mockEventFindUnique.mockResolvedValue({
        id: "evt-1",
        slug: "flyer",
        title: "Flyer",
        hostId: "host-1",
        rsvpEnabled: false,
        coHosts: [],
        theme: null,
        hostDisplayName: null,
        host: { name: "Host", email: "h@test.local" },
      });

      await expect(checkInRsvp("rsvp-1")).rejects.toThrow("RSVPs are disabled for this event.");
      const walkInRes = await addWalkIn({ eventId: "evt-1", guestName: "Pat", totalPartySize: 1 });
      expect(walkInRes).toEqual({
        success: false,
        error: "RSVPs are disabled for this event.",
      });

      await expect(
        previewGuestInvitations("evt-1", [{ contact: "a@example.test", name: "Alex" }])
      ).rejects.toThrow("RSVPs are disabled for this event.");
      await expect(
        sendGuestInvitations("evt-1", [
          {
            contact: "a@example.test",
            name: "Alex",
            expectedDisposition: "send",
            expectedGuestName: "Alex",
          },
        ])
      ).rejects.toThrow("RSVPs are disabled for this event.");

      mockRsvpFindUnique.mockResolvedValueOnce({
        id: "rsvp-1",
        eventId: "evt-1",
        status: "GOING",
        guestName: "Pat",
        event: { id: "evt-1", visibility: "PRIVATE", rsvpEnabled: false, guestsCanInvite: true },
      });
      const friendInvite = await inviteFriendAsGuest("evt-1", "tok-1", "a@example.test");
      expect(friendInvite).toEqual({
        success: false,
        error: "RSVPs are disabled for this event.",
      });

      const blastRes = await sendBlast("evt-1", "Hello", ["ALL"]);
      expect(blastRes.success).toBe(false);
      expect(blastRes.sent).toBe(0);

      mockEventUpdateCreate.mockResolvedValue({ id: "upd-1", createdAt: new Date() });
      const updateRes = await addEventUpdate("evt-1", "Parking moved", true);
      expect(updateRes.success).toBe(true);
      expect(mockNotifyEventUpdate).not.toHaveBeenCalled();
    });

    it("returns 404 for guests.csv on info-only events and no-store headers for questionnaire.csv", async () => {
      mockGetSession.mockResolvedValue({ userId: "host-1", role: "HOST" });
      mockEventFindUnique
        .mockResolvedValueOnce({ id: "evt-1", hostId: "host-1", coHosts: [] })
        .mockResolvedValueOnce({ rsvpEnabled: false, timezone: "UTC", rsvpFields: [] });

      const csvRes = await getGuestsCsv(new Request("https://example.com/e/flyer/guests.csv"), {
        params: Promise.resolve({ slug: "flyer" }),
      });
      expect(csvRes.status).toBe(404);

      const cfgRes = await unstable_getResponseFromNextConfig({
        url: "https://example.com/e/flyer/questionnaire.csv",
        nextConfig,
      });
      expect(cfgRes.headers.get("cache-control")).toBe("private, no-store");
    });
  });

  describe("Standalone questionnaire & CSV export", () => {
    it("allows anonymous visitors on info-only events to submit and update answers with CAPTCHA + HttpOnly cookie", async () => {
      mockEventFindUnique.mockResolvedValue({
        id: "evt-1",
        slug: "flyer",
        status: "PUBLISHED",
        visibility: "PUBLIC",
        passwordHash: null,
        hostId: "host-1",
        rsvpEnabled: false,
        coHosts: [],
        rsvpFields: [
          { id: "q1", label: "Topic", fieldType: "TEXT", required: true, options: null, order: 0 },
          {
            id: "q2",
            label: "Session",
            fieldType: "SELECT",
            required: false,
            options: JSON.stringify(["Morning", "Afternoon"]),
            order: 1,
          },
          {
            id: "q3",
            label: "Days",
            fieldType: "CHECKBOX",
            required: true,
            options: JSON.stringify(["Sat", "Sun"]),
            order: 2,
          },
        ],
      });
      mockQuestionnaireFindUnique.mockResolvedValue(null);
      mockQuestionnaireCreate.mockResolvedValue({
        id: "sub-1",
        respondentName: "Jordan",
        updatedAt: new Date("2030-05-01T10:00:00Z"),
      });

      const res = await submitQuestionnaireResponse(
        {
          eventId: "evt-1",
          respondentName: "Jordan",
          answers: { q1: "AI", q2: "Morning", q3: "Sat,Sun" },
        },
        "captcha-ok"
      );

      expect(mockAssertCaptcha).toHaveBeenCalledWith("questionnaire_submit", "captcha-ok");
      expect(mockCookieSet).toHaveBeenCalledWith(
        "rsvp_poll_voter",
        expect.any(String),
        expect.objectContaining({ httpOnly: true, sameSite: "lax" })
      );
      expect(res).toEqual({
        success: true,
        respondentName: "Jordan",
        updatedAt: "2030-05-01T10:00:00.000Z",
        answers: { q1: "AI", q2: "Morning", q3: "Sat,Sun" },
      });
    });

    it("rejects invalid options, missing required fields, and RSVP-enabled events", async () => {
      mockEventFindUnique.mockResolvedValue({
        id: "evt-1",
        slug: "flyer",
        status: "PUBLISHED",
        visibility: "PUBLIC",
        passwordHash: null,
        hostId: "host-1",
        rsvpEnabled: false,
        coHosts: [],
        rsvpFields: [
          { id: "q1", label: "Topic", fieldType: "TEXT", required: true, options: null, order: 0 },
          {
            id: "q2",
            label: "Session",
            fieldType: "SELECT",
            required: false,
            options: JSON.stringify(["Morning"]),
            order: 1,
          },
        ],
      });

      const bad = await submitQuestionnaireResponse({
        eventId: "evt-1",
        respondentName: "Jordan",
        answers: { q1: "", q2: "Evening" },
      });
      expect(bad.success).toBe(false);
      expect(bad.fieldErrors).toEqual({
        q1: "Complete this required field.",
        q2: "Choose one of the listed options.",
      });

      mockEventFindUnique.mockResolvedValueOnce({
        id: "evt-rsvp",
        slug: "party",
        status: "PUBLISHED",
        visibility: "PUBLIC",
        passwordHash: null,
        hostId: "host-1",
        rsvpEnabled: true,
        coHosts: [],
        rsvpFields: [
          { id: "q1", label: "Topic", fieldType: "TEXT", required: true, options: null },
        ],
      });
      const blocked = await submitQuestionnaireResponse({
        eventId: "evt-rsvp",
        respondentName: "Jordan",
        answers: { q1: "AI" },
      });
      expect(blocked).toEqual({ success: false, error: "Forbidden" });
    });

    it("exports questionnaire.csv with formula-injection neutralization", async () => {
      mockGetSession.mockResolvedValue({ userId: "host-1", role: "HOST" });
      mockEventFindUnique
        .mockResolvedValueOnce({ id: "evt-1", hostId: "host-1", coHosts: [] })
        .mockResolvedValueOnce({
          timezone: "UTC",
          rsvpFields: [{ id: "q1", label: "Notes" }],
        });
      mockQuestionnaireFindMany.mockResolvedValue([
        {
          respondentName: "=SUM(A1:A2)",
          updatedAt: new Date("2030-05-01T12:00:00Z"),
          answers: [{ rsvpFieldId: "q1", value: "+cmd|'/c calc'!A0" }],
        },
      ]);
      mockRsvpFindMany.mockResolvedValue([]);

      const res = await getQuestionnaireCsv(
        new Request("https://example.com/e/flyer/questionnaire.csv"),
        { params: Promise.resolve({ slug: "flyer" }) }
      );
      expect(res.status).toBe(200);
      const csv = await res.text();
      expect(csv).toContain('"\'=SUM(A1:A2)"');
      expect(csv).toContain("\"'+cmd|'/c calc'!A0\"");
      expect(csv).toContain('"Event page"');
    });
  });

  describe("Open polls, open comments & disabled potluck on info-only events", () => {
    it("allows voting and option creation on polls even if requireRsvp=true when event.rsvpEnabled=false", async () => {
      mockGetSession.mockResolvedValueOnce({ userId: "host-1", role: "HOST" });
      mockEventFindUnique
        .mockResolvedValueOnce({ id: "evt-1", slug: "flyer", hostId: "host-1", coHosts: [] })
        .mockResolvedValueOnce({ rsvpEnabled: false });
      mockPollCreate.mockResolvedValue({ id: "poll-1" });
      await createPoll("evt-1", "Best time?", ["1pm", "3pm"], false, true, false, "tok", true);
      expect(mockPollCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ requireRsvp: false }),
        })
      );

      mockGetSession.mockResolvedValue(null);

      mockPollFindUnique
        .mockResolvedValueOnce({
          id: "poll-1",
          eventId: "evt-1",
          locked: false,
          multiChoice: false,
          requireRsvp: true,
          hideVoters: false,
          question: "Best time?",
          event: {
            id: "evt-1",
            hostId: "host-1",
            slug: "flyer",
            status: "PUBLISHED",
            visibility: "PUBLIC",
            passwordHash: null,
            rsvpEnabled: false,
            coHosts: [],
          },
        })
        .mockResolvedValueOnce({
          id: "poll-1",
          locked: false,
          multiChoice: false,
        });
      mockPollOptionFindUnique.mockResolvedValue({ id: "opt-1", text: "1pm" });

      const voteRes = await castVote("poll-1", "opt-1", "Taylor", true, undefined, "cap");
      expect(voteRes).toEqual({ success: true });
      expect(mockPollVoteCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ voterName: "Taylor", rsvpId: null }),
        })
      );

      mockPollFindUnique.mockResolvedValueOnce({
        id: "poll-1",
        eventId: "evt-1",
        locked: false,
        allowGuestsToAdd: true,
        requireRsvp: true,
        event: {
          id: "evt-1",
          hostId: "host-1",
          slug: "flyer",
          status: "PUBLISHED",
          visibility: "PUBLIC",
          passwordHash: null,
          rsvpEnabled: false,
          coHosts: [],
        },
      });
      mockPollOptionFindFirst.mockResolvedValue(null);
      mockPollOptionCreate.mockResolvedValue({ id: "opt-3" });

      const optRes = await addPollOption("poll-1", "5pm", "Taylor", undefined, "cap");
      expect(optRes).toEqual({ success: true, id: "opt-3" });
    });

    it("allows anonymous and signed-in comments on password-unlocked PRIVATE info-only events", async () => {
      mockEventFindUnique.mockResolvedValue({
        id: "evt-priv",
        status: "PUBLISHED",
        passwordHash: "pw-hash",
        slug: "priv-flyer",
        rsvpEnabled: false,
        commentsEnabled: true,
        hostId: "host-1",
        visibility: "PRIVATE",
        coHosts: [],
      });
      mockCookieGet.mockReturnValue({
        value: getUnlockSignature("priv-flyer", "pw-hash"),
      });
      mockCommentCreate.mockResolvedValue({ id: "cmt-1" });

      const anonRes = await addComment(
        { eventId: "evt-priv", guestName: "Sam", body: "Excited for this!" },
        "cap-tok"
      );
      expect(anonRes).toEqual({ success: true, id: "cmt-1" });
      expect(mockCommentCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            guestName: "Sam",
            rsvpId: null,
            voterTokenHash: expect.any(String),
          }),
        })
      );
    });

    it("rejects potluck adds and claims when rsvpEnabled=false", async () => {
      mockGetSession.mockResolvedValue({ userId: "host-1", role: "HOST" });
      mockEventFindUnique.mockResolvedValue({
        id: "evt-1",
        slug: "flyer",
        hostId: "host-1",
        rsvpEnabled: false,
        coHosts: [],
      });
      await expect(addPotluckItem("evt-1", "Chips", 2)).rejects.toThrow(
        "RSVPs are disabled for this event."
      );

      mockGetSession.mockResolvedValue(null);
      mockPotluckItemFindUnique.mockResolvedValue({
        id: "item-1",
        eventId: "evt-1",
        claims: [],
        event: { slug: "flyer", rsvpEnabled: false, hostId: "host-1", coHosts: [] },
      });
      const claimRes = await claimPotluckItem("item-1", "Sam", 1, "tok");
      expect(claimRes).toEqual({
        success: false,
        error: "RSVPs are disabled for this event.",
      });
    });
  });
});
