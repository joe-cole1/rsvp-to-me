import { describe, it, expect, vi, beforeEach } from "vitest";
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
  mockGetSession,
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
  mockGetSession: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    event: { findUnique: mockEventFindUnique, update: mockEventUpdate },
    rSVP: {
      create: mockRsvpCreate,
      count: mockRsvpCount,
      findMany: mockRsvpFindMany,
      findUnique: mockRsvpFindUnique,
      update: mockRsvpUpdate,
      delete: mockRsvpDelete,
    },
    comment: { create: mockCommentCreate },
    eventInfoSection: {
      create: mockInfoSectionCreate,
      findUnique: mockInfoSectionFindUnique,
      delete: mockInfoSectionDelete,
    },
    eventTheme: { upsert: mockEventThemeUpsert },
    eventReminderSettings: { upsert: mockReminderSettingsUpsert },
  },
}));

vi.mock("@/lib/session", () => ({ getSession: mockGetSession }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/email", () => ({
  sendRsvpConfirmationEmail: vi.fn().mockResolvedValue(undefined),
  sendBlastEmail: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/sms", () => ({
  sendRsvpConfirmationSms: vi.fn().mockResolvedValue(undefined),
  sendSmsBlast: vi.fn().mockResolvedValue(2),
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
      data: { status: "MAYBE", plusOneCount: 1 },
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
    mockRsvpFindUnique.mockResolvedValue({ id: RSVP_ID, event: { hostId: HOST_ID, slug: EVENT_SLUG } });
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

  it("throws Unauthorized when there is no session", async () => {
    mockGetSession.mockResolvedValue(null);
    await expect(approveRsvp(RSVP_ID)).rejects.toThrow("Unauthorized");
  });

  it("throws Forbidden when the session user is not the host", async () => {
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
    mockRsvpFindUnique.mockResolvedValue({ id: RSVP_ID, event: { hostId: HOST_ID, slug: EVENT_SLUG } });
    mockRsvpDelete.mockResolvedValue({});
  });

  it("deletes the RSVP and returns success", async () => {
    const result = await declineRsvp(RSVP_ID);
    expect(result).toEqual({ success: true });
    expect(mockRsvpDelete).toHaveBeenCalledWith({ where: { id: RSVP_ID } });
  });

  it("throws Unauthorized when there is no session", async () => {
    mockGetSession.mockResolvedValue(null);
    await expect(declineRsvp(RSVP_ID)).rejects.toThrow("Unauthorized");
  });

  it("throws Forbidden when the session user is not the host", async () => {
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
    const result = await sendBlast(EVENT_ID, "Party tonight!", "ALL");
    expect(result).toEqual({ success: true, sent: 2 });
  });

  it("returns sent: 0 when no guests have email addresses", async () => {
    mockRsvpFindMany.mockResolvedValue([]);
    const result = await sendBlast(EVENT_ID, "Party!", "ALL");
    expect(result).toEqual({ success: true, sent: 0 });
  });

  it("passes the GOING status filter to the RSVP query", async () => {
    await sendBlast(EVENT_ID, "Hey!", "GOING");
    expect(mockRsvpFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ status: "GOING" }),
    }));
  });

  it("does not filter by status when filter is ALL", async () => {
    await sendBlast(EVENT_ID, "Hey!", "ALL");
    const where = mockRsvpFindMany.mock.calls[0][0].where;
    expect(where.status).toBeUndefined();
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
    const result = await sendSmsBlast(EVENT_ID, "Party!", "ALL");
    expect(result).toEqual({ success: true, sent: 2 });
  });

  it("returns sent: 0 without calling the SMS library when no phone numbers exist", async () => {
    const { sendSmsBlast: smsSendBlast } = await import("@/lib/sms");
    mockRsvpFindMany.mockResolvedValue([]);
    const result = await sendSmsBlast(EVENT_ID, "Party!", "ALL");
    expect(result).toEqual({ success: true, sent: 0 });
    expect(smsSendBlast).not.toHaveBeenCalled();
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
    expect(result).toEqual({ success: true, id: "section-1" });
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
    nudgeUnresponded: false, postEventPrompt: false,
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
