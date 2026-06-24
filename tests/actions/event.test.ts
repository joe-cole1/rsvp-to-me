import { describe, it, expect, vi, beforeEach } from "vitest";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";

// ── Hoist all mock functions so vi.mock factories can reference them ──────────

const {
  mockEventFindUnique,
  mockEventUpdate,
  mockRsvpCreate,
  mockRsvpCount,
  mockRsvpFindMany,
  mockRsvpFindUnique,
  mockRsvpUpdate,
  mockRsvpDelete,
  mockCommentCreate,
  mockInfoSectionCreate,
  mockInfoSectionFindUnique,
  mockInfoSectionDelete,
  mockEventThemeUpsert,
  mockReminderSettingsUpsert,
  mockEventUpdateCreate,
  mockEventUpdateFindUnique,
  mockEventUpdateDelete,
  mockPotluckItemCreate,
  mockPotluckItemFindUnique,
  mockPotluckItemUpdate,
  mockPotluckItemDelete,
  mockPotluckClaimCreate,
  mockPotluckClaimDelete,
  mockInvitationCreateMany,
  mockGetSession,
  mockUserFindFirst,
  mockUserCreate,
  mockInvitationCreate,
  mockRsvpFindFirst,
  mockInvitationFindFirst,
  mockSendApprovalEmail,
  mockSendApprovalSms,
  mockInfoSectionUpdate,
  mockRsvpAnswerCreateMany,
  mockPlusOneGuestCreateMany,
  mockCookiesGet,
  mockCookiesSet,
  mockEventThemeFindUnique,
  mockEventThemeCreate,
  mockEventThemeUpdate,
  mockRsvpAnswerUpsert,
  mockPlusOneGuestDeleteMany,
  mockThemePresetFindMany,
} = vi.hoisted(() => ({
  mockEventFindUnique: vi.fn(),
  mockEventUpdate: vi.fn(),
  mockRsvpCreate: vi.fn(),
  mockRsvpCount: vi.fn(),
  mockRsvpFindMany: vi.fn(),
  mockRsvpFindUnique: vi.fn(),
  mockRsvpUpdate: vi.fn(),
  mockRsvpDelete: vi.fn(),
  mockCommentCreate: vi.fn(),
  mockInfoSectionCreate: vi.fn(),
  mockInfoSectionFindUnique: vi.fn(),
  mockInfoSectionDelete: vi.fn(),
  mockEventThemeUpsert: vi.fn(),
  mockReminderSettingsUpsert: vi.fn(),
  mockEventUpdateCreate: vi.fn(),
  mockEventUpdateFindUnique: vi.fn(),
  mockEventUpdateDelete: vi.fn(),
  mockPotluckItemCreate: vi.fn(),
  mockPotluckItemFindUnique: vi.fn(),
  mockPotluckItemUpdate: vi.fn(),
  mockPotluckItemDelete: vi.fn(),
  mockPotluckClaimCreate: vi.fn(),
  mockPotluckClaimDelete: vi.fn(),
  mockInvitationCreateMany: vi.fn().mockResolvedValue({ count: 0 }),
  mockGetSession: vi.fn(),
  mockUserFindFirst: vi.fn(),
  mockUserCreate: vi.fn(),
  mockInvitationCreate: vi.fn(),
  mockRsvpFindFirst: vi.fn(),
  mockInvitationFindFirst: vi.fn(),
  mockSendApprovalEmail: vi.fn().mockResolvedValue(undefined),
  mockSendApprovalSms: vi.fn().mockResolvedValue(undefined),
  mockInfoSectionUpdate: vi.fn(),
  mockRsvpAnswerCreateMany: vi.fn(),
  mockPlusOneGuestCreateMany: vi.fn(),
  mockCookiesGet: vi.fn(),
  mockCookiesSet: vi.fn(),
  mockEventThemeFindUnique: vi.fn(),
  mockEventThemeCreate: vi.fn(),
  mockEventThemeUpdate: vi.fn(),
  mockRsvpAnswerUpsert: vi.fn(),
  mockPlusOneGuestDeleteMany: vi.fn(),
  mockThemePresetFindMany: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    event: { findUnique: mockEventFindUnique, update: mockEventUpdate },
    user: { findFirst: mockUserFindFirst, create: mockUserCreate },
    rSVP: {
      create: mockRsvpCreate,
      count: mockRsvpCount,
      findMany: mockRsvpFindMany,
      findUnique: mockRsvpFindUnique,
      findFirst: mockRsvpFindFirst,
      update: mockRsvpUpdate,
      delete: mockRsvpDelete,
    },
    comment: { create: mockCommentCreate },
    eventInfoSection: {
      create: mockInfoSectionCreate,
      findUnique: mockInfoSectionFindUnique,
      delete: mockInfoSectionDelete,
      update: mockInfoSectionUpdate,
    },
    eventTheme: { upsert: mockEventThemeUpsert, findUnique: mockEventThemeFindUnique, create: mockEventThemeCreate, update: mockEventThemeUpdate },
    eventReminderSettings: { upsert: mockReminderSettingsUpsert },
    eventUpdate: {
      create: mockEventUpdateCreate,
      findUnique: mockEventUpdateFindUnique,
      delete: mockEventUpdateDelete,
    },
    potluckItem: {
      create: mockPotluckItemCreate,
      findUnique: mockPotluckItemFindUnique,
      update: mockPotluckItemUpdate,
      delete: mockPotluckItemDelete,
    },
    potluckClaim: {
      create: mockPotluckClaimCreate,
      delete: mockPotluckClaimDelete,
    },
    invitation: { createMany: mockInvitationCreateMany, create: mockInvitationCreate, findFirst: mockInvitationFindFirst },
    activityEvent: { create: vi.fn().mockResolvedValue({}) },
    rSVPAnswer: { createMany: mockRsvpAnswerCreateMany, upsert: mockRsvpAnswerUpsert },
    plusOneGuest: { createMany: mockPlusOneGuestCreateMany, deleteMany: mockPlusOneGuestDeleteMany },
    themePreset: { findMany: mockThemePresetFindMany },
  },
}));

vi.mock("@/lib/session", () => ({ getSession: mockGetSession }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/email", () => ({
  sendRsvpConfirmationEmail: vi.fn().mockResolvedValue(undefined),
  sendBlastEmail: vi.fn().mockResolvedValue(undefined),
  sendEventInviteEmail: vi.fn().mockResolvedValue(undefined),
  sendApprovalEmail: mockSendApprovalEmail,
}));
vi.mock("@/lib/sms", () => ({
  sendRsvpConfirmationSms: vi.fn().mockResolvedValue(undefined),
  sendSmsBlast: vi.fn().mockResolvedValue(2),
  sendMagicLinkSms: vi.fn().mockResolvedValue(undefined),
  sendEventInviteSms: vi.fn().mockResolvedValue(undefined),
  sendApprovalSms: mockSendApprovalSms,
}));
vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({
    get: mockCookiesGet,
    set: mockCookiesSet,
    delete: vi.fn(),
  }),
}));


import {
  saveEventField,
  saveEventLocation,
  addRSVP,
  updateRSVP,
  addComment,
  saveEventSettings,
  approveRsvp,
  declineRsvp,
  sendBlast,
  sendSmsBlast,
  addInfoSection,
  removeInfoSection,
  saveEventDates,
  saveReminderSettings,
  addEventUpdate,
  deleteEventUpdate,
  addPotluckItem,
  removePotluckItem,
  claimPotluckItem,
  unclaimPotluckItem,
  inviteGuest,
  verifyEventPassword,
  saveEventTheme,
  saveCoverImage,
  updateInfoSection,
  deleteRsvpAsHost,
  deleteActivityEvent,
  inviteFriendAsGuest,
  getActiveThemePresets,
} from "@/app/actions/event";

// ── Shared fixtures ───────────────────────────────────────────────────────────

const HOST_ID = "host-1";
const OTHER_ID = "other-user";
const EVENT_ID = "event-1";
const EVENT_SLUG = "test-event";

function asHost() {
  mockGetSession.mockResolvedValue({ userId: HOST_ID, email: "host@example.com" });
}

function hostEventRow(overrides = {}) {
  return { hostId: HOST_ID, slug: EVENT_SLUG, ...overrides };
}

const BASE_EVENT = {
  id: EVENT_ID,
  slug: EVENT_SLUG,
  title: "Test Party",
  approvalRequired: false,
  rsvpDeadline: null,
  capacity: null,
  startAt: new Date("2026-12-01T20:00:00Z"),
  locationName: "My House",
  host: { name: "Joe" },
};

beforeEach(() => {
  vi.clearAllMocks();
});

// ── assertHost (exercised via saveEventField) ─────────────────────────────────

describe("assertHost", () => {
  it("throws Unauthorized when there is no session", async () => {
    mockGetSession.mockResolvedValue(null);
    await expect(saveEventField(EVENT_ID, "title", "X")).rejects.toThrow("Unauthorized");
  });

  it("throws Forbidden when the session user is not the event host", async () => {
    mockGetSession.mockResolvedValue({ userId: OTHER_ID, email: "other@example.com" });
    mockEventFindUnique.mockResolvedValue(hostEventRow());
    await expect(saveEventField(EVENT_ID, "title", "X")).rejects.toThrow("Forbidden");
  });

  it("throws Forbidden when the event does not exist", async () => {
    asHost();
    mockEventFindUnique.mockResolvedValue(null);
    await expect(saveEventField(EVENT_ID, "title", "X")).rejects.toThrow("Forbidden");
  });
});

// ── saveEventField ────────────────────────────────────────────────────────────

describe("saveEventField", () => {
  beforeEach(() => {
    asHost();
    mockEventFindUnique.mockResolvedValue(hostEventRow());
    mockEventUpdate.mockResolvedValue({});
  });

  it("updates a valid field", async () => {
    await saveEventField(EVENT_ID, "title", "Summer Bash");
    expect(mockEventUpdate).toHaveBeenCalledWith({
      where: { id: EVENT_ID },
      data: { title: "Summer Bash" },
    });
  });

  it("stores null when value is an empty string", async () => {
    await saveEventField(EVENT_ID, "description", "");
    expect(mockEventUpdate).toHaveBeenCalledWith({
      where: { id: EVENT_ID },
      data: { description: null },
    });
  });

  it("throws for a disallowed field name", async () => {
    await expect(saveEventField(EVENT_ID, "hostId", "evil")).rejects.toThrow("Field not allowed");
    expect(mockEventUpdate).not.toHaveBeenCalled();
  });

  it("revalidates the event page", async () => {
    await saveEventField(EVENT_ID, "title", "New Title");
    expect(revalidatePath).toHaveBeenCalledWith(`/e/${EVENT_SLUG}`);
  });
});

// ── saveEventLocation ─────────────────────────────────────────────────────────

describe("saveEventLocation", () => {
  beforeEach(() => {
    asHost();
    mockEventFindUnique.mockResolvedValue(hostEventRow());
    mockEventUpdate.mockResolvedValue({});
  });

  it("updates location fields", async () => {
    await saveEventLocation(EVENT_ID, {
      locationType: "PHYSICAL",
      locationName: "The Backyard",
      locationAddress: "123 Main St",
      virtualUrl: null,
    });
    expect(mockEventUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ locationType: "PHYSICAL", locationName: "The Backyard" }),
    }));
  });

  it("coerces empty strings to null", async () => {
    await saveEventLocation(EVENT_ID, {
      locationType: "TBD",
      locationName: "",
      locationAddress: "",
      virtualUrl: "",
    });
    const data = mockEventUpdate.mock.calls[0][0].data;
    expect(data.locationName).toBeNull();
    expect(data.locationAddress).toBeNull();
    expect(data.virtualUrl).toBeNull();
  });
});

// ── addRSVP ───────────────────────────────────────────────────────────────────

describe("addRSVP", () => {
  beforeEach(() => {
    mockEventFindUnique.mockResolvedValue(BASE_EVENT);
    mockRsvpCreate.mockResolvedValue({ id: "rsvp-1", editToken: "tok-abc" });
  });

  it("creates an RSVP and returns success with the editToken", async () => {
    const result = await addRSVP({ eventId: EVENT_ID, guestName: "Alice", status: "GOING", plusOneCount: 0 });
    expect(result).toEqual({ success: true, id: "rsvp-1", editToken: "tok-abc" });
  });

  it("sets approved: true when approval is not required", async () => {
    await addRSVP({ eventId: EVENT_ID, guestName: "Alice", status: "GOING", plusOneCount: 0 });
    expect(mockRsvpCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ approved: true }),
    }));
  });

  it("sets approved: false when approval is required", async () => {
    mockEventFindUnique.mockResolvedValue({ ...BASE_EVENT, approvalRequired: true });
    await addRSVP({ eventId: EVENT_ID, guestName: "Alice", status: "GOING", plusOneCount: 0 });
    expect(mockRsvpCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ approved: false }),
    }));
  });

  it("returns error when event does not exist", async () => {
    mockEventFindUnique.mockResolvedValue(null);
    const result = await addRSVP({ eventId: EVENT_ID, guestName: "Alice", status: "GOING", plusOneCount: 0 });
    expect(result).toEqual({ success: false, error: "Event not found" });
  });

  it("returns error when RSVP deadline has passed", async () => {
    mockEventFindUnique.mockResolvedValue({ ...BASE_EVENT, rsvpDeadline: new Date("2020-01-01") });
    const result = await addRSVP({ eventId: EVENT_ID, guestName: "Alice", status: "GOING", plusOneCount: 0 });
    expect(result).toEqual({ success: false, error: "RSVP deadline has passed" });
  });

  it("allows RSVP when deadline is in the future", async () => {
    mockEventFindUnique.mockResolvedValue({ ...BASE_EVENT, rsvpDeadline: new Date(Date.now() + 86400_000) });
    const result = await addRSVP({ eventId: EVENT_ID, guestName: "Alice", status: "GOING", plusOneCount: 0 });
    expect(result.success).toBe(true);
  });

  it("returns error when event is at capacity for GOING", async () => {
    mockEventFindUnique.mockResolvedValue({ ...BASE_EVENT, capacity: 10 });
    mockRsvpCount.mockResolvedValue(10);
    const result = await addRSVP({ eventId: EVENT_ID, guestName: "Alice", status: "GOING", plusOneCount: 0 });
    expect(result).toEqual({ success: false, error: "Event is at capacity" });
  });

  it("allows GOING RSVP when under capacity", async () => {
    mockEventFindUnique.mockResolvedValue({ ...BASE_EVENT, capacity: 10 });
    mockRsvpCount.mockResolvedValue(9);
    const result = await addRSVP({ eventId: EVENT_ID, guestName: "Alice", status: "GOING", plusOneCount: 0 });
    expect(result.success).toBe(true);
  });

  it("skips the capacity check entirely for MAYBE status", async () => {
    mockEventFindUnique.mockResolvedValue({ ...BASE_EVENT, capacity: 10 });
    await addRSVP({ eventId: EVENT_ID, guestName: "Alice", status: "MAYBE", plusOneCount: 0 });
    expect(mockRsvpCount).not.toHaveBeenCalled();
  });

  it("revalidates the event page", async () => {
    await addRSVP({ eventId: EVENT_ID, guestName: "Alice", status: "GOING", plusOneCount: 0 });
    expect(revalidatePath).toHaveBeenCalledWith(`/e/${EVENT_SLUG}`);
  });
});

// ── updateRSVP ────────────────────────────────────────────────────────────────

describe("updateRSVP", () => {
  const EDIT_TOKEN = "tok-edit-1";

  beforeEach(() => {
    mockRsvpFindUnique.mockResolvedValue({ editToken: EDIT_TOKEN, event: { slug: EVENT_SLUG } });
    mockRsvpUpdate.mockResolvedValue({});
  });

  it("updates status and plusOneCount and returns success", async () => {
    const result = await updateRSVP(EDIT_TOKEN, { status: "MAYBE", plusOneCount: 1 });
    expect(result).toEqual({ success: true });
    expect(mockRsvpUpdate).toHaveBeenCalledWith({
      where: { editToken: EDIT_TOKEN },
      data: { status: "MAYBE", plusOneCount: 1, responded: true },
    });
  });

  it("returns error when RSVP is not found", async () => {
    mockRsvpFindUnique.mockResolvedValue(null);
    const result = await updateRSVP("bad-token", { status: "NO", plusOneCount: 0 });
    expect(result).toEqual({ success: false, error: "RSVP not found" });
  });

  it("revalidates the event page", async () => {
    await updateRSVP(EDIT_TOKEN, { status: "GOING", plusOneCount: 0 });
    expect(revalidatePath).toHaveBeenCalledWith(`/e/${EVENT_SLUG}`);
  });
});

// ── approveRsvp ───────────────────────────────────────────────────────────────

describe("approveRsvp", () => {
  const RSVP_ID = "rsvp-1";

  beforeEach(() => {
    asHost();
    mockRsvpFindUnique.mockResolvedValue({ id: RSVP_ID, event: { hostId: HOST_ID, slug: EVENT_SLUG, coHosts: [] } });
    mockRsvpUpdate.mockResolvedValue({});
  });

  it("sets approved: true and returns success", async () => {
    const result = await approveRsvp(RSVP_ID);
    expect(result).toEqual({ success: true });
    expect(mockRsvpUpdate).toHaveBeenCalledWith({
      where: { id: RSVP_ID },
      data: { approved: true },
    });
  });

  it("allows a co-host to approve RSVPs", async () => {
    mockGetSession.mockResolvedValue({ userId: OTHER_ID, email: "cohost@example.com" });
    mockRsvpFindUnique.mockResolvedValue({
      id: RSVP_ID,
      event: { hostId: HOST_ID, slug: EVENT_SLUG, coHosts: [{ userId: OTHER_ID }] }
    });
    const result = await approveRsvp(RSVP_ID);
    expect(result).toEqual({ success: true });
    expect(mockRsvpUpdate).toHaveBeenCalledWith({
      where: { id: RSVP_ID },
      data: { approved: true },
    });
  });

  it("throws Unauthorized when there is no session", async () => {
    mockGetSession.mockResolvedValue(null);
    await expect(approveRsvp(RSVP_ID)).rejects.toThrow("Unauthorized");
  });

  it("throws Forbidden when the session user is not the host or co-host", async () => {
    mockGetSession.mockResolvedValue({ userId: OTHER_ID, email: "other@example.com" });
    await expect(approveRsvp(RSVP_ID)).rejects.toThrow("Forbidden");
  });

  it("revalidates the event page", async () => {
    await approveRsvp(RSVP_ID);
    expect(revalidatePath).toHaveBeenCalledWith(`/e/${EVENT_SLUG}`);
  });
});

// ── declineRsvp ───────────────────────────────────────────────────────────────

describe("declineRsvp", () => {
  const RSVP_ID = "rsvp-1";

  beforeEach(() => {
    asHost();
    mockRsvpFindUnique.mockResolvedValue({ id: RSVP_ID, event: { hostId: HOST_ID, slug: EVENT_SLUG, coHosts: [] } });
    mockRsvpDelete.mockResolvedValue({});
  });

  it("deletes the RSVP and returns success", async () => {
    const result = await declineRsvp(RSVP_ID);
    expect(result).toEqual({ success: true });
    expect(mockRsvpDelete).toHaveBeenCalledWith({ where: { id: RSVP_ID } });
  });

  it("allows a co-host to decline RSVPs", async () => {
    mockGetSession.mockResolvedValue({ userId: OTHER_ID, email: "cohost@example.com" });
    mockRsvpFindUnique.mockResolvedValue({
      id: RSVP_ID,
      event: { hostId: HOST_ID, slug: EVENT_SLUG, coHosts: [{ userId: OTHER_ID }] }
    });
    const result = await declineRsvp(RSVP_ID);
    expect(result).toEqual({ success: true });
    expect(mockRsvpDelete).toHaveBeenCalledWith({ where: { id: RSVP_ID } });
  });

  it("throws Unauthorized when there is no session", async () => {
    mockGetSession.mockResolvedValue(null);
    await expect(declineRsvp(RSVP_ID)).rejects.toThrow("Unauthorized");
  });

  it("throws Forbidden when the session user is not the host or co-host", async () => {
    mockGetSession.mockResolvedValue({ userId: OTHER_ID, email: "other@example.com" });
    await expect(declineRsvp(RSVP_ID)).rejects.toThrow("Forbidden");
  });

  it("revalidates the event page", async () => {
    await declineRsvp(RSVP_ID);
    expect(revalidatePath).toHaveBeenCalledWith(`/e/${EVENT_SLUG}`);
  });
});

// ── addComment ────────────────────────────────────────────────────────────────

describe("addComment", () => {
  beforeEach(() => {
    mockEventFindUnique.mockResolvedValue({ slug: EVENT_SLUG, commentsEnabled: true });
    mockCommentCreate.mockResolvedValue({ id: "comment-1" });
  });

  it("creates a comment and returns success with its id", async () => {
    const result = await addComment({ eventId: EVENT_ID, guestName: "Alice", body: "See you there!" });
    expect(result).toEqual({ success: true, id: "comment-1" });
  });

  it("returns error when comments are disabled", async () => {
    mockEventFindUnique.mockResolvedValue({ slug: EVENT_SLUG, commentsEnabled: false });
    const result = await addComment({ eventId: EVENT_ID, guestName: "Alice", body: "Hi" });
    expect(result).toEqual({ success: false, error: "Comments disabled" });
    expect(mockCommentCreate).not.toHaveBeenCalled();
  });

  it("returns error when event is not found", async () => {
    mockEventFindUnique.mockResolvedValue(null);
    const result = await addComment({ eventId: EVENT_ID, guestName: "Alice", body: "Hi" });
    expect(result).toEqual({ success: false, error: "Comments disabled" });
  });

  it("passes parentId when creating a reply", async () => {
    await addComment({ eventId: EVENT_ID, guestName: "Bob", body: "Same!", parentId: "comment-1" });
    expect(mockCommentCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ parentId: "comment-1" }),
    }));
  });
});

// ── saveEventSettings ─────────────────────────────────────────────────────────

describe("saveEventSettings", () => {
  beforeEach(() => {
    asHost();
    mockEventFindUnique.mockResolvedValue(hostEventRow());
    mockEventUpdate.mockResolvedValue({});
  });

  it("updates arbitrary settings fields", async () => {
    await saveEventSettings(EVENT_ID, { commentsEnabled: false, plusOneAllowed: true });
    expect(mockEventUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ commentsEnabled: false, plusOneAllowed: true }),
    }));
  });

  it("updates visibility", async () => {
    await saveEventSettings(EVENT_ID, { visibility: "PUBLIC" });
    expect(mockEventUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ visibility: "PUBLIC" }),
    }));
  });

  it("converts rsvpDeadline string to a Date", async () => {
    await saveEventSettings(EVENT_ID, { rsvpDeadline: "2026-12-01T00:00" });
    const data = mockEventUpdate.mock.calls[0][0].data;
    expect(data.rsvpDeadline).toBeInstanceOf(Date);
  });

  it("sets rsvpDeadline to null when explicitly null", async () => {
    await saveEventSettings(EVENT_ID, { rsvpDeadline: null });
    const data = mockEventUpdate.mock.calls[0][0].data;
    expect(data.rsvpDeadline).toBeNull();
  });

  it("omits rsvpDeadline from the update when not provided", async () => {
    await saveEventSettings(EVENT_ID, { commentsEnabled: false });
    const data = mockEventUpdate.mock.calls[0][0].data;
    expect(data.rsvpDeadline).toBeUndefined();
  });

  it("revalidates both the event page and the settings page", async () => {
    await saveEventSettings(EVENT_ID, { commentsEnabled: true });
    expect(revalidatePath).toHaveBeenCalledWith(`/e/${EVENT_SLUG}`);
    expect(revalidatePath).toHaveBeenCalledWith(`/e/${EVENT_SLUG}/settings`);
  });
});

// ── sendBlast ─────────────────────────────────────────────────────────────────

describe("sendBlast", () => {
  beforeEach(() => {
    asHost();
    // assertHost calls findUnique first, then sendBlast body calls it again
    mockEventFindUnique
      .mockResolvedValueOnce(hostEventRow())
      .mockResolvedValueOnce({ title: "Test Party", slug: EVENT_SLUG, host: { name: "Joe" } });
    mockRsvpFindMany.mockResolvedValue([
      { guestEmail: "alice@example.com" },
      { guestEmail: "bob@example.com" },
    ]);
  });

  it("returns the count of emails sent", async () => {
    const result = await sendBlast(EVENT_ID, "Party tonight!", ["ALL"]);
    expect(result).toEqual({ success: true, sent: 2 });
  });

  it("returns sent: 0 when no guests have email addresses", async () => {
    mockRsvpFindMany.mockResolvedValue([]);
    const result = await sendBlast(EVENT_ID, "Party!", ["ALL"]);
    expect(result).toEqual({ success: true, sent: 0 });
  });

  it("passes the GOING status filter to the RSVP query", async () => {
    await sendBlast(EVENT_ID, "Hey!", ["GOING"]);
    expect(mockRsvpFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        OR: expect.arrayContaining([
          expect.objectContaining({ status: "GOING", responded: true })
        ])
      }),
    }));
  });

  it("passes the INVITED status filter to the RSVP query", async () => {
    await sendBlast(EVENT_ID, "Hey!", ["INVITED"]);
    expect(mockRsvpFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        OR: expect.arrayContaining([
          expect.objectContaining({ status: "INVITED" })
        ])
      }),
    }));
  });

  it("passes the MAYBE status filter to the RSVP query", async () => {
    await sendBlast(EVENT_ID, "Hey!", ["MAYBE"]);
    expect(mockRsvpFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        OR: expect.arrayContaining([
          expect.objectContaining({ status: "MAYBE", responded: true })
        ])
      }),
    }));
  });

  it("passes the NO status filter to the RSVP query", async () => {
    await sendBlast(EVENT_ID, "Hey!", ["NO"]);
    expect(mockRsvpFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        OR: expect.arrayContaining([
          expect.objectContaining({ status: "NO", responded: true })
        ])
      }),
    }));
  });

  it("does not filter by status when filter is ALL", async () => {
    await sendBlast(EVENT_ID, "Hey!", ["ALL"]);
    const where = mockRsvpFindMany.mock.calls[0][0].where;
    expect(where.status).toBeUndefined();
    expect(where.responded).toBeUndefined();
  });
});

// ── sendSmsBlast ──────────────────────────────────────────────────────────────

describe("sendSmsBlast", () => {
  beforeEach(() => {
    asHost();
    mockEventFindUnique
      .mockResolvedValueOnce(hostEventRow())
      .mockResolvedValueOnce({ title: "Test Party", slug: EVENT_SLUG, host: { name: "Joe" } });
    mockRsvpFindMany.mockResolvedValue([
      { guestPhone: "+15551234567" },
      { guestPhone: "+15559876543" },
    ]);
  });

  it("returns the count of messages sent from the SMS library", async () => {
    const result = await sendSmsBlast(EVENT_ID, "Party!", ["ALL"]);
    expect(result).toEqual({ success: true, sent: 2 });
  });

  it("returns sent: 0 without calling the SMS library when no phone numbers exist", async () => {
    const { sendSmsBlast: smsSendBlast } = await import("@/lib/sms");
    mockRsvpFindMany.mockResolvedValue([]);
    const result = await sendSmsBlast(EVENT_ID, "Party!", ["ALL"]);
    expect(result).toEqual({ success: true, sent: 0 });
    expect(smsSendBlast).not.toHaveBeenCalled();
  });

  it("passes the GOING status filter to the RSVP query", async () => {
    await sendSmsBlast(EVENT_ID, "Hey!", ["GOING"]);
    expect(mockRsvpFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        OR: expect.arrayContaining([
          expect.objectContaining({ status: "GOING", responded: true })
        ])
      }),
    }));
  });

  it("passes the INVITED status filter to the RSVP query", async () => {
    await sendSmsBlast(EVENT_ID, "Hey!", ["INVITED"]);
    expect(mockRsvpFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        OR: expect.arrayContaining([
          expect.objectContaining({ status: "INVITED" })
        ])
      }),
    }));
  });
});

// ── addInfoSection ────────────────────────────────────────────────────────────

describe("addInfoSection", () => {
  beforeEach(() => {
    asHost();
    mockEventFindUnique.mockResolvedValue(hostEventRow());
    mockInfoSectionCreate.mockResolvedValue({ id: "section-1" });
  });

  it("creates a section and returns its id", async () => {
    const result = await addInfoSection({
      eventId: EVENT_ID, type: "DRESS_CODE", title: "Attire",
      content: "Smart casual", url: null, order: 0,
    });
    expect(result).toMatchObject({ success: true, id: "section-1" });
  });

  it("passes all fields to the database", async () => {
    await addInfoSection({
      eventId: EVENT_ID, type: "LINK", title: "Directions",
      content: "See link", url: "https://maps.example.com", order: 1,
    });
    expect(mockInfoSectionCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ url: "https://maps.example.com", order: 1 }),
    }));
  });
});

// ── removeInfoSection ─────────────────────────────────────────────────────────

describe("removeInfoSection", () => {
  const SECTION_ID = "section-1";

  beforeEach(() => {
    asHost();
    mockInfoSectionFindUnique.mockResolvedValue({
      id: SECTION_ID,
      event: { hostId: HOST_ID, slug: EVENT_SLUG },
    });
    mockInfoSectionDelete.mockResolvedValue({});
  });

  it("deletes the section", async () => {
    await removeInfoSection(SECTION_ID);
    expect(mockInfoSectionDelete).toHaveBeenCalledWith({ where: { id: SECTION_ID } });
  });

  it("throws Forbidden when the session user is not the host", async () => {
    mockGetSession.mockResolvedValue({ userId: OTHER_ID, email: "other@example.com" });
    await expect(removeInfoSection(SECTION_ID)).rejects.toThrow("Forbidden");
  });

  it("revalidates the event page", async () => {
    await removeInfoSection(SECTION_ID);
    expect(revalidatePath).toHaveBeenCalledWith(`/e/${EVENT_SLUG}`);
  });
});

// ── saveEventDates ────────────────────────────────────────────────────────────

describe("saveEventDates", () => {
  beforeEach(() => {
    asHost();
    // assertHost → first findUnique; saveEventDates body → second findUnique
    mockEventFindUnique
      .mockResolvedValueOnce(hostEventRow())
      .mockResolvedValueOnce({ timezone: "America/New_York" });
    mockEventUpdate.mockResolvedValue({});
  });

  it("converts the local start time to a UTC Date and sets endAt to null", async () => {
    await saveEventDates(EVENT_ID, "2026-12-01T19:00", null);
    const { startAt, endAt } = mockEventUpdate.mock.calls[0][0].data;
    expect(startAt).toBeInstanceOf(Date);
    expect(endAt).toBeNull();
  });

  it("converts endAt when provided", async () => {
    await saveEventDates(EVENT_ID, "2026-12-01T19:00", "2026-12-01T23:00");
    const { endAt } = mockEventUpdate.mock.calls[0][0].data;
    expect(endAt).toBeInstanceOf(Date);
  });

  it("produces the correct UTC time for a known America/New_York input", async () => {
    // 19:00 EST (UTC-5 in December) → 00:00 UTC next day
    await saveEventDates(EVENT_ID, "2026-12-01T19:00", null);
    const { startAt } = mockEventUpdate.mock.calls[0][0].data;
    expect(startAt.toISOString()).toBe("2026-12-02T00:00:00.000Z");
  });
});

// ── saveReminderSettings ──────────────────────────────────────────────────────

describe("saveReminderSettings", () => {
  const SETTINGS = {
    emailWeekBefore: true,  emailDayBefore: true,  emailHoursBefore: 2,
    smsWeekBefore: false,   smsDayBefore: false,   smsHoursBefore: 0,
    nudgeUnresponded: false,
  };

  beforeEach(() => {
    asHost();
    mockEventFindUnique.mockResolvedValue(hostEventRow());
    mockReminderSettingsUpsert.mockResolvedValue({});
  });

  it("upserts reminder settings for the event", async () => {
    await saveReminderSettings(EVENT_ID, SETTINGS);
    expect(mockReminderSettingsUpsert).toHaveBeenCalledWith({
      where: { eventId: EVENT_ID },
      update: SETTINGS,
      create: { eventId: EVENT_ID, ...SETTINGS },
    });
  });

  it("revalidates the settings page", async () => {
    await saveReminderSettings(EVENT_ID, SETTINGS);
    expect(revalidatePath).toHaveBeenCalledWith(`/e/${EVENT_SLUG}/settings`);
  });
});

// ── addRSVP note ──────────────────────────────────────────────────────────────

describe("addRSVP — note field", () => {
  beforeEach(() => {
    mockEventFindUnique.mockResolvedValue(BASE_EVENT);
    mockRsvpCreate.mockResolvedValue({ id: "rsvp-1", editToken: "tok-abc" });
  });

  it("stores the note when provided", async () => {
    await addRSVP({ eventId: EVENT_ID, guestName: "Alice", status: "GOING", plusOneCount: 0, note: "Bringing wine!" });
    expect(mockRsvpCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ note: "Bringing wine!" }),
    }));
  });

  it("stores null when note is empty", async () => {
    await addRSVP({ eventId: EVENT_ID, guestName: "Alice", status: "GOING", plusOneCount: 0, note: "" });
    expect(mockRsvpCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ note: null }),
    }));
  });

  it("stores null when note is omitted", async () => {
    await addRSVP({ eventId: EVENT_ID, guestName: "Alice", status: "GOING", plusOneCount: 0 });
    expect(mockRsvpCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ note: null }),
    }));
  });
});

// ── updateRSVP note ───────────────────────────────────────────────────────────

describe("updateRSVP — note field", () => {
  const EDIT_TOKEN = "tok-edit-1";

  beforeEach(() => {
    mockRsvpFindUnique.mockResolvedValue({ editToken: EDIT_TOKEN, event: { slug: EVENT_SLUG } });
    mockRsvpUpdate.mockResolvedValue({});
  });

  it("includes note in the update when provided", async () => {
    await updateRSVP(EDIT_TOKEN, { status: "GOING", plusOneCount: 0, note: "Can't wait!" });
    expect(mockRsvpUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ note: "Can't wait!" }),
    }));
  });

  it("passes undefined for note when omitted, leaving the existing value intact", async () => {
    await updateRSVP(EDIT_TOKEN, { status: "GOING", plusOneCount: 0 });
    const data = mockRsvpUpdate.mock.calls[0][0].data;
    expect(data.note).toBeUndefined();
  });
});

// ── addEventUpdate ────────────────────────────────────────────────────────────

describe("addEventUpdate", () => {
  const UPDATE_BODY = "Start time moved to 7pm — see you then!";
  const CREATED_AT = new Date("2026-12-01T12:00:00Z");

  beforeEach(() => {
    asHost();
    mockEventFindUnique.mockResolvedValue(hostEventRow());
    mockEventUpdateCreate.mockResolvedValue({ id: "update-1", createdAt: CREATED_AT });
    mockRsvpFindMany.mockResolvedValue([]);
  });

  it("creates the update and returns its id and createdAt", async () => {
    const result = await addEventUpdate(EVENT_ID, UPDATE_BODY, false);
    expect(result).toEqual({ success: true, id: "update-1", createdAt: CREATED_AT });
  });

  it("persists body and notifyGuests flag", async () => {
    await addEventUpdate(EVENT_ID, UPDATE_BODY, false);
    expect(mockEventUpdateCreate).toHaveBeenCalledWith({
      data: { eventId: EVENT_ID, body: UPDATE_BODY, notifyGuests: false },
    });
  });

  it("does not query guests when notifyGuests is false", async () => {
    await addEventUpdate(EVENT_ID, UPDATE_BODY, false);
    expect(mockRsvpFindMany).not.toHaveBeenCalled();
  });

  it("queries guest emails when notifyGuests is true", async () => {
    await addEventUpdate(EVENT_ID, UPDATE_BODY, true);
    expect(mockRsvpFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ eventId: EVENT_ID, guestEmail: { not: null } }),
    }));
  });

  it("fetches event title for the email when guests exist", async () => {
    mockRsvpFindMany.mockResolvedValue([{ guestEmail: "alice@example.com" }]);
    // assertHost (1st findUnique) + full event lookup (2nd findUnique)
    mockEventFindUnique
      .mockResolvedValueOnce(hostEventRow())
      .mockResolvedValueOnce({ title: "Test Party", host: { name: "Joe" } });
    await addEventUpdate(EVENT_ID, UPDATE_BODY, true);
    expect(mockEventFindUnique).toHaveBeenCalledTimes(2);
  });

  it("skips the email fetch when no guests have email addresses", async () => {
    mockRsvpFindMany.mockResolvedValue([]);
    await addEventUpdate(EVENT_ID, UPDATE_BODY, true);
    // Only the assertHost findUnique call — no second lookup needed
    expect(mockEventFindUnique).toHaveBeenCalledTimes(1);
  });

  it("throws Unauthorized when there is no session", async () => {
    mockGetSession.mockResolvedValue(null);
    await expect(addEventUpdate(EVENT_ID, UPDATE_BODY, false)).rejects.toThrow("Unauthorized");
  });

  it("throws Forbidden when the user is not the host", async () => {
    mockGetSession.mockResolvedValue({ userId: OTHER_ID, email: "other@example.com" });
    await expect(addEventUpdate(EVENT_ID, UPDATE_BODY, false)).rejects.toThrow("Forbidden");
  });

  it("revalidates the event page", async () => {
    await addEventUpdate(EVENT_ID, UPDATE_BODY, false);
    expect(revalidatePath).toHaveBeenCalledWith(`/e/${EVENT_SLUG}`);
  });
});

// ── deleteEventUpdate ─────────────────────────────────────────────────────────

describe("deleteEventUpdate", () => {
  const UPDATE_ID = "update-1";

  beforeEach(() => {
    asHost();
    mockEventUpdateFindUnique.mockResolvedValue({
      event: { hostId: HOST_ID, slug: EVENT_SLUG },
    });
    mockEventUpdateDelete.mockResolvedValue({});
  });

  it("deletes the update", async () => {
    await deleteEventUpdate(UPDATE_ID);
    expect(mockEventUpdateDelete).toHaveBeenCalledWith({ where: { id: UPDATE_ID } });
  });

  it("throws Forbidden when the user is not the host", async () => {
    mockGetSession.mockResolvedValue({ userId: OTHER_ID, email: "other@example.com" });
    await expect(deleteEventUpdate(UPDATE_ID)).rejects.toThrow("Forbidden");
  });

  it("throws Forbidden when there is no session", async () => {
    mockGetSession.mockResolvedValue(null);
    await expect(deleteEventUpdate(UPDATE_ID)).rejects.toThrow("Forbidden");
  });

  it("revalidates the event page", async () => {
    await deleteEventUpdate(UPDATE_ID);
    expect(revalidatePath).toHaveBeenCalledWith(`/e/${EVENT_SLUG}`);
  });
});

// ── addPotluckItem ────────────────────────────────────────────────────────────

describe("addPotluckItem", () => {
  beforeEach(() => {
    asHost();
    mockEventFindUnique.mockResolvedValue(hostEventRow());
    mockPotluckItemCreate.mockResolvedValue({ id: "item-1" });
  });

  it("creates the item and returns its id", async () => {
    const result = await addPotluckItem(EVENT_ID, "Wine");
    expect(result).toEqual({ success: true, id: "item-1" });
  });

  it("persists the label", async () => {
    await addPotluckItem(EVENT_ID, "Dessert");
    expect(mockPotluckItemCreate).toHaveBeenCalledWith({
      data: { eventId: EVENT_ID, label: "Dessert", quantity: 1 },
    });
  });

  it("persists custom quantity when provided", async () => {
    await addPotluckItem(EVENT_ID, "Chairs", 5);
    expect(mockPotluckItemCreate).toHaveBeenCalledWith({
      data: { eventId: EVENT_ID, label: "Chairs", quantity: 5 },
    });
  });

  it("throws Unauthorized when there is no session", async () => {
    mockGetSession.mockResolvedValue(null);
    await expect(addPotluckItem(EVENT_ID, "Wine")).rejects.toThrow("Unauthorized");
  });

  it("revalidates the event page", async () => {
    await addPotluckItem(EVENT_ID, "Wine");
    expect(revalidatePath).toHaveBeenCalledWith(`/e/${EVENT_SLUG}`);
  });
});

// ── removePotluckItem ─────────────────────────────────────────────────────────

describe("removePotluckItem", () => {
  const ITEM_ID = "item-1";

  beforeEach(() => {
    asHost();
    mockPotluckItemFindUnique.mockResolvedValue({
      event: { hostId: HOST_ID, slug: EVENT_SLUG },
    });
    mockPotluckItemDelete.mockResolvedValue({});
  });

  it("deletes the item", async () => {
    await removePotluckItem(ITEM_ID);
    expect(mockPotluckItemDelete).toHaveBeenCalledWith({ where: { id: ITEM_ID } });
  });

  it("throws Forbidden when the user is not the host", async () => {
    mockGetSession.mockResolvedValue({ userId: OTHER_ID, email: "other@example.com" });
    await expect(removePotluckItem(ITEM_ID)).rejects.toThrow("Forbidden");
  });

  it("throws Forbidden when there is no session", async () => {
    mockGetSession.mockResolvedValue(null);
    await expect(removePotluckItem(ITEM_ID)).rejects.toThrow("Forbidden");
  });

  it("revalidates the event page", async () => {
    await removePotluckItem(ITEM_ID);
    expect(revalidatePath).toHaveBeenCalledWith(`/e/${EVENT_SLUG}`);
  });
});

// ── claimPotluckItem ──────────────────────────────────────────────────────────

describe("claimPotluckItem", () => {
  const ITEM_ID = "item-1";

  beforeEach(() => {
    vi.clearAllMocks();
    asHost();
    mockPotluckItemFindUnique.mockResolvedValue({
      id: ITEM_ID,
      label: "Soda",
      quantity: 10,
      claims: [],
      event: { slug: EVENT_SLUG, hostId: HOST_ID, coHosts: [] },
    });
    mockPotluckClaimCreate.mockResolvedValue({
      id: "claim-1",
      potluckItemId: ITEM_ID,
      guestName: "Alice",
      quantity: 1,
      createdAt: new Date(),
    });
  });

  it("creates a new PotluckClaim and returns success", async () => {
    const result = await claimPotluckItem(ITEM_ID, "Alice");
    expect(result).toMatchObject({ success: true });
    expect(mockPotluckClaimCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ guestName: "Alice", quantity: 1, potluckItemId: ITEM_ID }),
    }));
  });

  it("persists custom claimedQty when provided", async () => {
    const result = await claimPotluckItem(ITEM_ID, "Alice", 3);
    expect(result).toMatchObject({ success: true });
    expect(mockPotluckClaimCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ guestName: "Alice", quantity: 3, potluckItemId: ITEM_ID }),
    }));
  });

  it("returns error when item is not found", async () => {
    mockPotluckItemFindUnique.mockResolvedValue(null);
    const result = await claimPotluckItem(ITEM_ID, "Alice");
    expect(result).toEqual({ success: false, error: "Item not found" });
    expect(mockPotluckClaimCreate).not.toHaveBeenCalled();
  });

  it("returns error when item has no remaining quantity", async () => {
    mockPotluckItemFindUnique.mockResolvedValue({
      id: ITEM_ID,
      label: "Soda",
      quantity: 5,
      claims: [{ id: "claim-1", quantity: 5, guestName: "Bob" }],
      event: { slug: EVENT_SLUG, hostId: HOST_ID, coHosts: [] },
    });
    const result = await claimPotluckItem(ITEM_ID, "Alice", 1);
    expect(result).toEqual({ success: false, error: "Only 0 remaining" });
    expect(mockPotluckClaimCreate).not.toHaveBeenCalled();
  });

  it("revalidates the event page", async () => {
    await claimPotluckItem(ITEM_ID, "Alice");
    expect(revalidatePath).toHaveBeenCalledWith(`/e/${EVENT_SLUG}`);
  });
});

// ── unclaimPotluckItem ────────────────────────────────────────────────────────

describe("unclaimPotluckItem", () => {
  const ITEM_ID = "item-1";

  beforeEach(() => {
    vi.clearAllMocks();
    asHost();
    mockPotluckItemFindUnique.mockResolvedValue({
      id: ITEM_ID,
      label: "Soda",
      quantity: 10,
      claims: [{ id: "claim-1", guestName: "Alice", quantity: 2, createdAt: new Date() }],
      event: { hostId: HOST_ID, slug: EVENT_SLUG, coHosts: [] },
    });
    mockPotluckClaimDelete.mockResolvedValue({});
  });

  it("deletes the PotluckClaim and returns success", async () => {
    const result = await unclaimPotluckItem(ITEM_ID, "Alice");
    expect(result).toMatchObject({ success: true });
    expect(mockPotluckClaimDelete).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "claim-1" },
    }));
  });

  it("returns error when claim is not found", async () => {
    const result = await unclaimPotluckItem(ITEM_ID, "Bob");
    expect(result).toEqual({ success: false, error: "Claim not found" });
    expect(mockPotluckClaimDelete).not.toHaveBeenCalled();
  });

  it("allows host to unclaim another guest's claim", async () => {
    mockGetSession.mockResolvedValue({ userId: HOST_ID, email: "host@example.com" });
    const result = await unclaimPotluckItem(ITEM_ID, "Alice");
    expect(result).toMatchObject({ success: true });
    expect(mockPotluckClaimDelete).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "claim-1" },
    }));
  });

  it("allows co-host to unclaim another guest's claim", async () => {
    mockGetSession.mockResolvedValue({ userId: "cohost-id", email: "cohost@example.com" });
    mockPotluckItemFindUnique.mockResolvedValue({
      id: ITEM_ID,
      label: "Soda",
      quantity: 10,
      claims: [{ id: "claim-1", guestName: "Alice", quantity: 2, createdAt: new Date() }],
      event: { hostId: HOST_ID, slug: EVENT_SLUG, coHosts: [{ userId: "cohost-id" }] },
    });
    const result = await unclaimPotluckItem(ITEM_ID, "Alice");
    expect(result).toMatchObject({ success: true });
  });

  it("returns error when claim list is empty", async () => {
    mockPotluckItemFindUnique.mockResolvedValue({
      id: ITEM_ID,
      label: "Soda",
      quantity: 10,
      claims: [],
      event: { hostId: HOST_ID, slug: EVENT_SLUG, coHosts: [] }
    });
    const result = await unclaimPotluckItem(ITEM_ID, "Alice");
    expect(result).toEqual({ success: false, error: "Claim not found" });
  });

  it("revalidates the event page", async () => {
    await unclaimPotluckItem(ITEM_ID, "Alice");
    expect(revalidatePath).toHaveBeenCalledWith(`/e/${EVENT_SLUG}`);
  });
});

describe("inviteGuest", () => {
  const INVITE_EMAIL = "newguest@example.com";
  const INVITE_PHONE = "+15559876543";

  beforeEach(() => {
    vi.clearAllMocks();
    asHost();
    mockEventFindUnique.mockResolvedValue({ id: EVENT_ID, hostId: HOST_ID, slug: EVENT_SLUG });
    mockUserFindFirst.mockResolvedValue(null);
    mockUserCreate.mockResolvedValue({ id: "user-new-id" });
    mockRsvpFindFirst.mockResolvedValue(null);
    mockRsvpCreate.mockResolvedValue({ id: "rsvp-new-id", editToken: "token-new", guestName: "newguest" });
    mockInvitationFindFirst.mockResolvedValue(null);
  });

  it("throws error if unauthorized", async () => {
    mockGetSession.mockResolvedValue(null);
    await expect(inviteGuest(EVENT_ID, INVITE_EMAIL)).rejects.toThrow("Unauthorized");
  });

  it("sends an email invite for email inputs", async () => {
    const { sendEventInviteEmail } = await import("@/lib/email");
    const result = await inviteGuest(EVENT_ID, INVITE_EMAIL);

    expect(result).toEqual({ success: true, emailOrPhone: INVITE_EMAIL });
    expect(mockUserCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: { email: INVITE_EMAIL, role: "GUEST" }
    }));
    expect(mockRsvpCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        guestEmail: INVITE_EMAIL,
        userId: "user-new-id"
      })
    }));
    expect(mockInvitationCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: { eventId: EVENT_ID, sentTo: INVITE_EMAIL, channel: "EMAIL", rsvpId: "rsvp-new-id" }
    }));
    expect(sendEventInviteEmail).toHaveBeenCalled();
  });

  it("sends an SMS invite for phone inputs", async () => {
    const { sendEventInviteSms } = await import("@/lib/sms");
    const result = await inviteGuest(EVENT_ID, INVITE_PHONE);

    expect(result).toEqual({ success: true, emailOrPhone: INVITE_PHONE });
    expect(mockUserCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: { phone: INVITE_PHONE, role: "GUEST" }
    }));
    expect(mockInvitationCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: { eventId: EVENT_ID, sentTo: INVITE_PHONE, channel: "SMS", rsvpId: "rsvp-new-id" }
    }));
    expect(sendEventInviteSms).toHaveBeenCalled();
  });

  it("handles mixed comma-separated entries with some valid and some invalid", async () => {
    const { sendEventInviteEmail } = await import("@/lib/email");
    const { sendEventInviteSms } = await import("@/lib/sms");

    const result = await inviteGuest(EVENT_ID, `${INVITE_EMAIL}, invalid_entry, ${INVITE_PHONE}`);

    expect(result.success).toBe(true);
    expect(result.emailOrPhone).toContain(INVITE_EMAIL);
    expect(result.emailOrPhone).toContain(INVITE_PHONE);
    expect(result.errors).toBeDefined();
    expect(result.errors?.[0]).toContain("Invalid phone");

    expect(sendEventInviteEmail).toHaveBeenCalled();
    expect(sendEventInviteSms).toHaveBeenCalled();
  });

  it("throws error when all inputs are invalid and no guests are invited", async () => {
    await expect(inviteGuest(EVENT_ID, "invalid_entry")).rejects.toThrow("Failed to send invites:");
  });
});

describe("verifyEventPassword", () => {
  const TEST_PASSWORD_HASH = bcrypt.hashSync("password123", 10);

  beforeEach(() => {
    mockEventFindUnique.mockResolvedValue({ slug: EVENT_SLUG, passwordHash: TEST_PASSWORD_HASH });
  });

  it("returns error when event not found", async () => {
    mockEventFindUnique.mockResolvedValue(null);
    const result = await verifyEventPassword(EVENT_SLUG, "password123");
    expect(result).toEqual({ success: false, error: "Event not found." });
  });

  it("returns error when password is incorrect", async () => {
    const result = await verifyEventPassword(EVENT_SLUG, "wrong-password");
    expect(result).toEqual({ success: false, error: "Incorrect password." });
  });

  it("returns success:true and sets cookie when password matches", async () => {
    const result = await verifyEventPassword(EVENT_SLUG, "password123");
    expect(result).toEqual({ success: true });
    expect(mockCookiesSet).toHaveBeenCalledWith(`rsvp-unlocked-${EVENT_SLUG}`, expect.any(String), expect.any(Object));
  });
});

describe("saveEventTheme", () => {
  beforeEach(() => {
    asHost();
    mockEventFindUnique.mockResolvedValue(hostEventRow());
    mockEventThemeUpsert.mockResolvedValue({});
  });

  it("throws Unauthorized when no session", async () => {
    mockGetSession.mockResolvedValue(null);
    await expect(saveEventTheme(EVENT_ID, "DARK", "#7c3aed", "#1e40af", "#ff0000")).rejects.toThrow("Unauthorized");
  });

  it("calls eventTheme.upsert with baseTheme, gradients, and accentColor", async () => {
    await saveEventTheme(EVENT_ID, "DARK", "#7c3aed", "#1e40af", "#ff0000");
    expect(mockEventThemeUpsert).toHaveBeenCalledWith({
      where: { eventId: EVENT_ID },
      update: { baseTheme: "DARK", gradientFrom: "#7c3aed", gradientTo: "#1e40af", accentColor: "#ff0000" },
      create: { eventId: EVENT_ID, baseTheme: "DARK", gradientFrom: "#7c3aed", gradientTo: "#1e40af", accentColor: "#ff0000", appliedPresetId: null, cardOpacity: null },
    });
  });
});

describe("getActiveThemePresets", () => {
  it("returns only active presets ordered by sortOrder then createdAt", async () => {
    const mockPresets = [
      { id: "dark-night", name: "Dark Night", base: "DARK", active: true, sortOrder: 0 },
      { id: "sunset", name: "Sunset", base: "BOLD", active: true, sortOrder: 1 },
    ];
    mockThemePresetFindMany.mockResolvedValue(mockPresets);

    const res = await getActiveThemePresets();

    expect(res).toEqual(mockPresets);
    expect(mockThemePresetFindMany).toHaveBeenCalledWith({
      where: { active: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });
  });
});

describe("saveCoverImage", () => {
  beforeEach(() => {
    asHost();
    mockEventFindUnique.mockResolvedValue(hostEventRow());
    mockEventThemeUpsert.mockResolvedValue({});
  });

  it("calls eventTheme.upsert with coverImageUrl", async () => {
    await saveCoverImage(EVENT_ID, "http://image.jpg");
    expect(mockEventThemeUpsert).toHaveBeenCalledWith({
      where: { eventId: EVENT_ID },
      update: { coverImageUrl: "http://image.jpg" },
      create: { eventId: EVENT_ID, coverImageUrl: "http://image.jpg" },
    });
  });
});

describe("updateInfoSection", () => {
  beforeEach(() => {
    asHost();
    mockInfoSectionFindUnique.mockResolvedValue({
      eventId: EVENT_ID,
      type: "DRESS_CODE",
      event: { hostId: HOST_ID, slug: EVENT_SLUG, id: EVENT_ID },
    });
    mockInfoSectionUpdate.mockResolvedValue({});
  });

  it("calls eventInfoSection.update with updated content", async () => {
    const result = await updateInfoSection("section-1", { content: "New Content", url: null });
    expect(result.success).toBe(true);
    expect(mockInfoSectionUpdate).toHaveBeenCalledWith({
      where: { id: "section-1" },
      data: {
        title: null,
        content: "New Content",
        url: null,
      },
    });
  });
});

describe("deleteRsvpAsHost", () => {
  beforeEach(() => {
    asHost();
    mockRsvpFindUnique.mockResolvedValue({
      id: "rsvp-123",
      guestName: "Bob",
      event: { id: EVENT_ID, hostId: HOST_ID, slug: EVENT_SLUG, coHosts: [] },
    });
    mockRsvpDelete.mockResolvedValue({});
  });

  it("deletes the RSVP as host", async () => {
    const result = await deleteRsvpAsHost("rsvp-123");
    expect(result.success).toBe(true);
    expect(mockRsvpDelete).toHaveBeenCalledWith({ where: { id: "rsvp-123" } });
  });
});

describe("deleteActivityEvent", () => {
  beforeEach(() => {
    asHost();
    mockRsvpFindUnique.mockResolvedValue({
      id: "act-123",
      event: { hostId: HOST_ID, coHosts: [] },
    });
  });

  it("throws Forbidden when user is not host/co-host", async () => {
    mockGetSession.mockResolvedValue({ userId: OTHER_ID, email: "other@example.com" });
    const mockActivity = { event: { hostId: HOST_ID, coHosts: [] } };
    const { db } = await import("@/lib/db");
    db.activityEvent.findUnique = vi.fn().mockResolvedValue(mockActivity);

    await expect(deleteActivityEvent("act-123")).rejects.toThrow("Forbidden");
  });
});

describe("addRSVP questionnaire answers", () => {
  beforeEach(() => {
    mockEventFindUnique.mockResolvedValue(BASE_EVENT);
    mockRsvpCreate.mockResolvedValue({ id: "rsvp-q", editToken: "tok-q" });
    mockRsvpAnswerCreateMany.mockResolvedValue({ count: 1 });
  });

  it("stores answers when provided", async () => {
    await addRSVP({
      eventId: EVENT_ID,
      guestName: "Charlie",
      status: "GOING",
      plusOneCount: 0,
      answers: { "field-1": "answer-1" },
    });
    expect(mockRsvpAnswerCreateMany).toHaveBeenCalledWith({
      data: [{ rsvpId: "rsvp-q", rsvpFieldId: "field-1", value: "answer-1" }],
    });
  });
});

describe("approveRsvp / declineRsvp with notification messages", () => {
  beforeEach(() => {
    asHost();
    mockRsvpFindUnique.mockResolvedValue({
      id: "rsvp-1",
      guestName: "Guest",
      guestEmail: "guest@example.com",
      event: { hostId: HOST_ID, slug: EVENT_SLUG, title: "Title", host: { email: "host@example.com" }, coHosts: [] },
    });
    mockRsvpUpdate.mockResolvedValue({});
    mockRsvpDelete.mockResolvedValue({});
  });

  it("approves RSVP and passes custom message to approval email", async () => {
    await approveRsvp("rsvp-1", "Welcome to the party!");
    expect(mockSendApprovalEmail).toHaveBeenCalledWith("guest@example.com", expect.objectContaining({
      message: "Welcome to the party!",
    }));
  });

  it("declines RSVP and passes custom message to decline email", async () => {
    await declineRsvp("rsvp-1", "Sorry, we are full.");
    expect(mockSendApprovalEmail).toHaveBeenCalledWith("guest@example.com", expect.objectContaining({
      message: "Sorry, we are full.",
      approved: false,
    }));
  });
});

describe("inviteFriendAsGuest", () => {
  const INVITING_RSVP = {
    id: "inviting-rsvp",
    eventId: EVENT_ID,
    guestName: "Alice",
    guestEmail: "alice@example.com",
    status: "GOING",
    event: {
      id: EVENT_ID,
      slug: EVENT_SLUG,
      title: "Private Party",
      startAt: new Date(),
      locationName: "Alice's House",
      visibility: "PRIVATE",
      guestsCanInvite: true,
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockRsvpFindUnique.mockResolvedValue(INVITING_RSVP);
    mockUserFindFirst.mockResolvedValue(null);
    mockUserCreate.mockResolvedValue({ id: "friend-user-id" });
    mockRsvpFindFirst.mockResolvedValue(null);
    mockRsvpCreate.mockResolvedValue({ id: "friend-rsvp-id", editToken: "friend-edit-token", guestName: "bob" });
    mockInvitationFindFirst.mockResolvedValue(null);
    mockInvitationCreate.mockResolvedValue({});
  });

  it("fails if inviting RSVP does not exist", async () => {
    mockRsvpFindUnique.mockResolvedValue(null);
    const res = await inviteFriendAsGuest(EVENT_ID, "invalid-token", "bob@example.com");
    expect(res).toEqual({ success: false, error: "Invalid guest token" });
  });

  it("fails if inviting RSVP status is not GOING or MAYBE", async () => {
    mockRsvpFindUnique.mockResolvedValue({
      ...INVITING_RSVP,
      status: "NO",
    });
    const res = await inviteFriendAsGuest(EVENT_ID, "token", "bob@example.com");
    expect(res).toEqual({ success: false, error: "Only attending guests can invite friends" });
  });

  it("fails if event is not private", async () => {
    mockRsvpFindUnique.mockResolvedValue({
      ...INVITING_RSVP,
      event: {
        ...INVITING_RSVP.event,
        visibility: "PUBLIC",
      },
    });
    const res = await inviteFriendAsGuest(EVENT_ID, "token", "bob@example.com");
    expect(res).toEqual({ success: false, error: "This feature is only for private events" });
  });

  it("fails if guestsCanInvite is disabled", async () => {
    mockRsvpFindUnique.mockResolvedValue({
      ...INVITING_RSVP,
      event: {
        ...INVITING_RSVP.event,
        guestsCanInvite: false,
      },
    });
    const res = await inviteFriendAsGuest(EVENT_ID, "token", "bob@example.com");
    expect(res).toEqual({ success: false, error: "Guests are not allowed to invite others to this event" });
  });

  it("succeeds, creates user and RSVP, and sends email invite", async () => {
    const res = await inviteFriendAsGuest(EVENT_ID, "token", "bob@example.com");
    expect(res).toEqual({ success: true });
    expect(mockUserCreate).toHaveBeenCalledWith({
      data: { email: "bob@example.com", role: "GUEST" },
    });
    expect(mockRsvpCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        eventId: EVENT_ID,
        guestEmail: "bob@example.com",
        status: "INVITED",
        approved: false,
      }),
    });
    const { sendEventInviteEmail } = await import("@/lib/email");
    expect(sendEventInviteEmail).toHaveBeenCalled();
  });
});


