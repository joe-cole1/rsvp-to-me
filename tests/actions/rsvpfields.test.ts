import "@/tests/helpers/english-request-locale";
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
    $transaction: vi.fn(),
    event: { findUnique: mockEventFindUnique },
    rSVPField: {
      create: mockRsvpFieldCreate,
      findUnique: mockRsvpFieldFindUnique,
      findMany: mockRsvpFieldFindMany,
      update: mockRsvpFieldUpdate,
      delete: mockRsvpFieldDelete,
    },
    questionnaireSubmission: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    questionnaireAnswer: { deleteMany: vi.fn(), createMany: vi.fn() },
  },
}));

vi.mock("@/lib/session", () => ({ getSession: mockGetSession }));
vi.mock("@/lib/captcha", () => ({ assertCaptcha: vi.fn() }));
vi.mock("@/lib/eventAccess", () => ({
  resolveEventAccess: vi.fn().mockResolvedValue({ decision: "granted" }),
}));
vi.mock("@/lib/rateLimit", () => ({
  rateLimit: vi.fn().mockResolvedValue({ success: true }),
}));
vi.mock("@/lib/clientIp", () => ({
  isTrustedIpConfigured: () => false,
  getClientIp: vi.fn(),
}));
vi.mock("@/lib/poll-voter-token", () => ({
  getOrCreatePollVoterTokenHash: vi.fn().mockResolvedValue("voter-hash"),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/email", () => ({ sendRsvpConfirmationEmail: vi.fn(), sendBlastEmail: vi.fn() }));
vi.mock("@/lib/sms", () => ({ sendRsvpConfirmationSms: vi.fn(), sendSmsBlast: vi.fn() }));

import {
  addRsvpField,
  updateRsvpField,
  deleteRsvpField,
  reorderRsvpFields,
  getRsvpFieldAnswers,
  submitQuestionnaireResponse,
} from "@/app/actions/event/rsvpFields";

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
    eventId: EVENT_ID,
    event: { slug: EVENT_SLUG },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ── addRsvpField ─────────────────────────────────────────────────────────────

describe("addRsvpField", () => {
  beforeEach(() => {
    asHost();
    mockEventFindUnique.mockResolvedValue(hostEventWithCohosts());
    mockRsvpFieldCreate.mockResolvedValue({ id: FIELD_ID });
  });

  it("creates a field and returns its id", async () => {
    const result = await addRsvpField(EVENT_ID, {
      label: "Dietary?",
      fieldType: "TEXT",
      required: false,
      order: 0,
    });
    expect(result).toEqual({ success: true, id: FIELD_ID });
  });

  it("persists all provided fields", async () => {
    await addRsvpField(EVENT_ID, {
      label: "Choice",
      fieldType: "SELECT",
      required: true,
      options: "A\nB",
      order: 1,
    });
    expect(mockRsvpFieldCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          label: "Choice",
          fieldType: "SELECT",
          required: true,
          options: "A\nB",
          order: 1,
        }),
      })
    );
  });

  it("stores null options when not a SELECT/CHECKBOX type", async () => {
    await addRsvpField(EVENT_ID, { label: "Notes", fieldType: "TEXT", required: false, order: 0 });
    expect(mockRsvpFieldCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ options: null }),
      })
    );
  });

  it("allows a cohost to add a field", async () => {
    const COHOST_ID = "cohost-1";
    mockGetSession.mockResolvedValue({ userId: COHOST_ID, email: "cohost@example.com" });
    mockEventFindUnique.mockResolvedValue(hostEventWithCohosts([COHOST_ID]));
    const result = await addRsvpField(EVENT_ID, {
      label: "Q?",
      fieldType: "TEXT",
      required: false,
      order: 0,
    });
    expect(result.success).toBe(true);
  });

  it("throws Unauthorized when no session", async () => {
    mockGetSession.mockResolvedValue(null);
    await expect(
      addRsvpField(EVENT_ID, { label: "Q", fieldType: "TEXT", required: false, order: 0 })
    ).rejects.toThrow("Unauthorized");
  });

  it("throws Forbidden when not host or cohost", async () => {
    mockGetSession.mockResolvedValue({ userId: OTHER_ID, email: "other@example.com" });
    await expect(
      addRsvpField(EVENT_ID, { label: "Q", fieldType: "TEXT", required: false, order: 0 })
    ).rejects.toThrow("Forbidden");
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
    // SEC-30: authz goes through assertHostOrCohost, which loads the event itself
    mockEventFindUnique.mockResolvedValue(hostEventWithCohosts());
    mockRsvpFieldUpdate.mockResolvedValue({});
  });

  it("allows a cohost to update a field (SEC-30)", async () => {
    const COHOST_ID = "cohost-1";
    mockGetSession.mockResolvedValue({ userId: COHOST_ID, email: "cohost@example.com" });
    mockEventFindUnique.mockResolvedValue(hostEventWithCohosts([COHOST_ID]));
    const result = await updateRsvpField(FIELD_ID, { label: "New label", required: true });
    expect(result).toEqual({ success: true });
  });

  it("updates label and required and returns success", async () => {
    const result = await updateRsvpField(FIELD_ID, { label: "New label", required: true });
    expect(result).toEqual({ success: true });
    expect(mockRsvpFieldUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: FIELD_ID },
        data: expect.objectContaining({ label: "New label", required: true }),
      })
    );
  });

  it("throws Forbidden when not host or cohost", async () => {
    mockGetSession.mockResolvedValue({ userId: OTHER_ID, email: "other@example.com" });
    await expect(updateRsvpField(FIELD_ID, { label: "X", required: false })).rejects.toThrow(
      "Forbidden"
    );
  });

  it("throws Forbidden when field not found", async () => {
    mockRsvpFieldFindUnique.mockResolvedValue(null);
    await expect(updateRsvpField(FIELD_ID, { label: "X", required: false })).rejects.toThrow(
      "Forbidden"
    );
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
    // SEC-30: authz goes through assertHostOrCohost, which loads the event itself
    mockEventFindUnique.mockResolvedValue(hostEventWithCohosts());
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
      eventId: EVENT_ID,
      answers: [{ value: "No gluten", rsvp: { guestName: "Alice" } }],
    });
    // SEC-30: authz goes through assertHostOrCohost, which loads the event itself
    mockEventFindUnique.mockResolvedValue(hostEventWithCohosts());

    const result = await getRsvpFieldAnswers(FIELD_ID);
    expect(result).toEqual([{ guestName: "Alice", value: "No gluten" }]);
  });
});

describe("typed fields, description, goingOnly, and TERMS validation (#786)", () => {
  beforeEach(() => {
    asHost();
    mockEventFindUnique.mockResolvedValue(hostEventWithCohosts());
    mockRsvpFieldCreate.mockResolvedValue({ id: FIELD_ID });
    mockRsvpFieldFindUnique.mockResolvedValue(fieldWithEvent({ fieldType: "TERMS" }));
    mockRsvpFieldUpdate.mockResolvedValue({});
  });

  it("persists description, goingOnly, and normalized TERMS options", async () => {
    await addRsvpField(EVENT_ID, {
      label: "Event waiver",
      description: "Review carefully before confirming.",
      fieldType: "TERMS",
      required: true,
      goingOnly: true,
      options: JSON.stringify({ text: "Be kind.", url: "example.com/waiver" }),
      order: 0,
    });

    expect(mockRsvpFieldCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        label: "Event waiver",
        description: "Review carefully before confirming.",
        fieldType: "TERMS",
        required: true,
        goingOnly: true,
        options: JSON.stringify({ text: "Be kind.", url: "https://example.com/waiver" }),
      }),
    });
  });

  it("rejects javascript: URLs on TERMS fields (SEC-36)", async () => {
    await expect(
      addRsvpField(EVENT_ID, {
        label: "Waiver",
        fieldType: "TERMS",
        required: true,
        options: JSON.stringify({ text: "Terms", url: "javascript:alert(1)" }),
        order: 0,
      })
    ).rejects.toThrow("Enter a valid http:// or https:// link.");

    await expect(
      updateRsvpField(FIELD_ID, {
        options: JSON.stringify({ text: "Terms", url: "data:text/html,xss" }),
      })
    ).rejects.toThrow("Enter a valid http:// or https:// link.");
  });

  it("validates PHONE, ADDRESS, and TERMS on standalone info-only questionnaire submissions", async () => {
    mockGetSession.mockResolvedValue(null);
    mockEventFindUnique.mockResolvedValue({
      id: EVENT_ID,
      slug: EVENT_SLUG,
      status: "PUBLISHED",
      visibility: "PUBLIC",
      passwordHash: null,
      hostId: HOST_ID,
      rsvpEnabled: false,
      coHosts: [],
      rsvpFields: [
        { id: "f-phone", fieldType: "PHONE", required: false, options: null },
        { id: "f-addr", fieldType: "ADDRESS", required: true, options: null },
        { id: "f-terms", fieldType: "TERMS", required: true, options: null },
      ],
    });

    const invalid = await submitQuestionnaireResponse({
      eventId: EVENT_ID,
      respondentName: "Sam",
      answers: {
        "f-phone": "bad-phone",
        "f-addr": JSON.stringify({ line1: "123 Main", city: "", postalCode: "10001" }),
        "f-terms": "",
      },
    });
    expect(invalid.success).toBe(false);
    expect(invalid.fieldErrors).toEqual({
      "f-phone": "Please enter a valid phone number.",
      "f-addr": "Enter street address, city, and postal code.",
      "f-terms": "Agree to the terms to continue.",
    });
  });
});
