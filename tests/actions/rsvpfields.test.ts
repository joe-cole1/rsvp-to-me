import { describe, it, expect, vi, beforeEach } from "vitest";
import { revalidatePath } from "next/cache";

const {
  mockEventFindUnique,
  mockRsvpFieldCreate,
  mockRsvpFieldFindUnique,
  mockRsvpFieldFindMany,
  mockRsvpFieldUpdate,
  mockRsvpFieldDelete,
  mockGetSession,
} = vi.hoisted(() => ({
  mockEventFindUnique: vi.fn(),
  mockRsvpFieldCreate: vi.fn(),
  mockRsvpFieldFindUnique: vi.fn(),
  mockRsvpFieldFindMany: vi.fn(),
  mockRsvpFieldUpdate: vi.fn(),
  mockRsvpFieldDelete: vi.fn(),
  mockGetSession: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    event: { findUnique: mockEventFindUnique },
    rSVPField: {
      create: mockRsvpFieldCreate,
      findUnique: mockRsvpFieldFindUnique,
      findMany: mockRsvpFieldFindMany,
      update: mockRsvpFieldUpdate,
      delete: mockRsvpFieldDelete,
    },
  },
}));

vi.mock("@/lib/session", () => ({ getSession: mockGetSession }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/email", () => ({ sendRsvpConfirmationEmail: vi.fn(), sendBlastEmail: vi.fn() }));
vi.mock("@/lib/sms", () => ({ sendRsvpConfirmationSms: vi.fn(), sendSmsBlast: vi.fn() }));

import { addRsvpField, updateRsvpField, deleteRsvpField, reorderRsvpFields, getRsvpFieldAnswers } from "@/app/actions/event";

const HOST_ID = "host-1";
const OTHER_ID = "other-user";
const EVENT_ID = "event-1";
const EVENT_SLUG = "test-event";
const FIELD_ID = "field-1";

function asHost() {
  mockGetSession.mockResolvedValue({ userId: HOST_ID, email: "host@example.com" });
}

function hostEventWithCohosts(cohostIds: string[] = []) {
  return { hostId: HOST_ID, slug: EVENT_SLUG, coHosts: cohostIds.map((id) => ({ userId: id })) };
}

function fieldWithEvent(overrides = {}) {
  return {
    id: FIELD_ID,
    event: { hostId: HOST_ID, slug: EVENT_SLUG, coHosts: [] },
    ...overrides,
  };
}

beforeEach(() => { vi.clearAllMocks(); });

// ── addRsvpField ─────────────────────────────────────────────────────────────

describe("addRsvpField", () => {
  beforeEach(() => {
    asHost();
    mockEventFindUnique.mockResolvedValue(hostEventWithCohosts());
    mockRsvpFieldCreate.mockResolvedValue({ id: FIELD_ID });
  });

  it("creates a field and returns its id", async () => {
    const result = await addRsvpField(EVENT_ID, { label: "Dietary?", fieldType: "TEXT", required: false, order: 0 });
    expect(result).toEqual({ success: true, id: FIELD_ID });
  });

  it("persists all provided fields", async () => {
    await addRsvpField(EVENT_ID, { label: "Choice", fieldType: "SELECT", required: true, options: "A\nB", order: 1 });
    expect(mockRsvpFieldCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ label: "Choice", fieldType: "SELECT", required: true, options: "A\nB", order: 1 }),
    }));
  });

  it("stores null options when not a SELECT/CHECKBOX type", async () => {
    await addRsvpField(EVENT_ID, { label: "Notes", fieldType: "TEXT", required: false, order: 0 });
    expect(mockRsvpFieldCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ options: null }),
    }));
  });

  it("allows a cohost to add a field", async () => {
    const COHOST_ID = "cohost-1";
    mockGetSession.mockResolvedValue({ userId: COHOST_ID, email: "cohost@example.com" });
    mockEventFindUnique.mockResolvedValue(hostEventWithCohosts([COHOST_ID]));
    const result = await addRsvpField(EVENT_ID, { label: "Q?", fieldType: "TEXT", required: false, order: 0 });
    expect(result.success).toBe(true);
  });

  it("throws Unauthorized when no session", async () => {
    mockGetSession.mockResolvedValue(null);
    await expect(addRsvpField(EVENT_ID, { label: "Q", fieldType: "TEXT", required: false, order: 0 })).rejects.toThrow("Unauthorized");
  });

  it("throws Forbidden when not host or cohost", async () => {
    mockGetSession.mockResolvedValue({ userId: OTHER_ID, email: "other@example.com" });
    await expect(addRsvpField(EVENT_ID, { label: "Q", fieldType: "TEXT", required: false, order: 0 })).rejects.toThrow("Forbidden");
  });

  it("revalidates both event and settings pages", async () => {
    await addRsvpField(EVENT_ID, { label: "Q", fieldType: "TEXT", required: false, order: 0 });
    expect(revalidatePath).toHaveBeenCalledWith(`/e/${EVENT_SLUG}/settings`);
    expect(revalidatePath).toHaveBeenCalledWith(`/e/${EVENT_SLUG}`);
  });
});

// ── updateRsvpField ───────────────────────────────────────────────────────────

describe("updateRsvpField", () => {
  beforeEach(() => {
    asHost();
    mockRsvpFieldFindUnique.mockResolvedValue(fieldWithEvent({ fieldType: "TEXT" }));
    mockRsvpFieldUpdate.mockResolvedValue({});
  });

  it("updates label and required and returns success", async () => {
    const result = await updateRsvpField(FIELD_ID, { label: "New label", required: true });
    expect(result).toEqual({ success: true });
    expect(mockRsvpFieldUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: FIELD_ID },
      data: expect.objectContaining({ label: "New label", required: true }),
    }));
  });

  it("throws Forbidden when not host or cohost", async () => {
    mockGetSession.mockResolvedValue({ userId: OTHER_ID, email: "other@example.com" });
    await expect(updateRsvpField(FIELD_ID, { label: "X", required: false })).rejects.toThrow("Forbidden");
  });

  it("throws Forbidden when field not found", async () => {
    mockRsvpFieldFindUnique.mockResolvedValue(null);
    await expect(updateRsvpField(FIELD_ID, { label: "X", required: false })).rejects.toThrow("Forbidden");
  });

  it("revalidates event and settings pages", async () => {
    await updateRsvpField(FIELD_ID, { label: "X", required: false });
    expect(revalidatePath).toHaveBeenCalledWith(`/e/${EVENT_SLUG}/settings`);
    expect(revalidatePath).toHaveBeenCalledWith(`/e/${EVENT_SLUG}`);
  });
});

// ── deleteRsvpField ───────────────────────────────────────────────────────────

describe("deleteRsvpField", () => {
  beforeEach(() => {
    asHost();
    mockRsvpFieldFindUnique.mockResolvedValue(fieldWithEvent());
    mockRsvpFieldDelete.mockResolvedValue({});
  });

  it("deletes the field", async () => {
    await deleteRsvpField(FIELD_ID);
    expect(mockRsvpFieldDelete).toHaveBeenCalledWith({ where: { id: FIELD_ID } });
  });

  it("throws Forbidden when not the host or cohost", async () => {
    mockGetSession.mockResolvedValue({ userId: OTHER_ID, email: "other@example.com" });
    await expect(deleteRsvpField(FIELD_ID)).rejects.toThrow("Forbidden");
  });

  it("throws Forbidden when field not found", async () => {
    mockRsvpFieldFindUnique.mockResolvedValue(null);
    await expect(deleteRsvpField(FIELD_ID)).rejects.toThrow("Forbidden");
  });

  it("revalidates event and settings pages", async () => {
    await deleteRsvpField(FIELD_ID);
    expect(revalidatePath).toHaveBeenCalledWith(`/e/${EVENT_SLUG}/settings`);
    expect(revalidatePath).toHaveBeenCalledWith(`/e/${EVENT_SLUG}`);
  });
});

describe("reorderRsvpFields", () => {
  beforeEach(() => {
    asHost();
    mockEventFindUnique.mockResolvedValue(hostEventWithCohosts());
    mockRsvpFieldFindMany.mockResolvedValue([{ id: "field-a" }, { id: "field-b" }]);
    mockRsvpFieldUpdate.mockResolvedValue({});
  });

  it("throws Unauthorized when no session", async () => {
    mockGetSession.mockResolvedValue(null);
    await expect(reorderRsvpFields(EVENT_ID, [FIELD_ID])).rejects.toThrow("Unauthorized");
  });

  it("updates each field's order to its index in orderedIds", async () => {
    await reorderRsvpFields(EVENT_ID, ["field-a", "field-b"]);
    expect(mockRsvpFieldUpdate).toHaveBeenCalledTimes(2);
    expect(mockRsvpFieldUpdate).toHaveBeenNthCalledWith(1, {
      where: { id: "field-a" },
      data: { order: 0 },
    });
    expect(mockRsvpFieldUpdate).toHaveBeenNthCalledWith(2, {
      where: { id: "field-b" },
      data: { order: 1 },
    });
  });
});

describe("getRsvpFieldAnswers", () => {
  beforeEach(() => {
    asHost();
  });

  it("returns answers including guest name and value", async () => {
    mockRsvpFieldFindUnique.mockResolvedValue({
      id: FIELD_ID,
      event: { hostId: HOST_ID, coHosts: [] },
      answers: [
        { value: "No gluten", rsvp: { guestName: "Alice" } },
      ],
    });

    const result = await getRsvpFieldAnswers(FIELD_ID);
    expect(result).toEqual([{ guestName: "Alice", value: "No gluten" }]);
  });
});

