import { describe, it, expect, vi, beforeEach } from "vitest";
import { revalidatePath } from "next/cache";

const {
  mockEventFindUnique,
  mockUserFindUnique,
  mockEventCoHostCreate,
  mockEventCoHostFindUnique,
  mockEventCoHostDelete,
  mockGetSession,
} = vi.hoisted(() => ({
  mockEventFindUnique: vi.fn(),
  mockUserFindUnique: vi.fn(),
  mockEventCoHostCreate: vi.fn(),
  mockEventCoHostFindUnique: vi.fn(),
  mockEventCoHostDelete: vi.fn(),
  mockGetSession: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    event: { findUnique: mockEventFindUnique },
    user: { findUnique: mockUserFindUnique },
    eventCoHost: {
      create: mockEventCoHostCreate,
      findUnique: mockEventCoHostFindUnique,
      delete: mockEventCoHostDelete,
    },
  },
}));

vi.mock("@/lib/session", () => ({ getSession: mockGetSession }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/email", () => ({ sendRsvpConfirmationEmail: vi.fn(), sendBlastEmail: vi.fn() }));
vi.mock("@/lib/sms", () => ({ sendRsvpConfirmationSms: vi.fn(), sendSmsBlast: vi.fn() }));

import { addCoHost, removeCoHost } from "@/app/actions/event";

const HOST_ID = "host-1";
const OTHER_ID = "other-user";
const EVENT_ID = "event-1";
const EVENT_SLUG = "test-event";

function asHost() {
  mockGetSession.mockResolvedValue({ userId: HOST_ID, email: "host@example.com" });
}

function hostEventRow(overrides = {}) {
  return { hostId: HOST_ID, slug: EVENT_SLUG, coHosts: [], ...overrides };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ── addCoHost ─────────────────────────────────────────────────────────────────

describe("addCoHost", () => {
  const COHOST_EMAIL = "cohost@example.com";
  const COHOST_USER = { id: "cohost-1", name: "Alex", email: COHOST_EMAIL };

  beforeEach(() => {
    asHost();
    mockEventFindUnique.mockResolvedValue(hostEventRow());
    mockUserFindUnique.mockResolvedValue(COHOST_USER);
    mockEventCoHostCreate.mockResolvedValue({ id: "ch-1" });
  });

  it("returns success with cohost info on valid email", async () => {
    const result = await addCoHost(EVENT_ID, COHOST_EMAIL);
    expect(result.success).toBe(true);
    expect(result.email).toBe(COHOST_EMAIL);
  });

  it("creates an EventCoHost row", async () => {
    await addCoHost(EVENT_ID, COHOST_EMAIL);
    expect(mockEventCoHostCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ eventId: EVENT_ID, userId: COHOST_USER.id }),
      })
    );
  });

  it("returns error when email has no account", async () => {
    mockUserFindUnique.mockResolvedValue(null);
    const result = await addCoHost(EVENT_ID, COHOST_EMAIL);
    expect(result.success).toBe(false);
    expect(result.error).toBe("No account found for that email");
    expect(mockEventCoHostCreate).not.toHaveBeenCalled();
  });

  it("returns error on duplicate (unique constraint violation)", async () => {
    mockEventCoHostCreate.mockRejectedValue(new Error("Unique constraint failed"));
    const result = await addCoHost(EVENT_ID, COHOST_EMAIL);
    expect(result.success).toBe(false);
    expect(result.error).toBe("Already a co-host");
  });

  it("throws Unauthorized when no session", async () => {
    mockGetSession.mockResolvedValue(null);
    await expect(addCoHost(EVENT_ID, COHOST_EMAIL)).rejects.toThrow("Unauthorized");
  });

  it("throws Forbidden when not the host", async () => {
    mockGetSession.mockResolvedValue({ userId: OTHER_ID, email: "other@example.com" });
    await expect(addCoHost(EVENT_ID, COHOST_EMAIL)).rejects.toThrow("Forbidden");
  });

  it("revalidates the settings page", async () => {
    await addCoHost(EVENT_ID, COHOST_EMAIL);
    expect(revalidatePath).toHaveBeenCalledWith(`/e/${EVENT_SLUG}/settings`);
  });
});

// ── removeCoHost ─────────────────────────────────────────────────────────────

describe("removeCoHost", () => {
  const COHOST_RECORD_ID = "ch-1";

  beforeEach(() => {
    asHost();
    mockEventCoHostFindUnique.mockResolvedValue({
      event: { hostId: HOST_ID, slug: EVENT_SLUG },
    });
    mockEventCoHostDelete.mockResolvedValue({});
  });

  it("deletes the co-host record", async () => {
    await removeCoHost(COHOST_RECORD_ID);
    expect(mockEventCoHostDelete).toHaveBeenCalledWith({ where: { id: COHOST_RECORD_ID } });
  });

  it("throws Forbidden when not the event owner", async () => {
    mockGetSession.mockResolvedValue({ userId: OTHER_ID, email: "other@example.com" });
    await expect(removeCoHost(COHOST_RECORD_ID)).rejects.toThrow("Forbidden");
  });

  it("throws Forbidden when no session", async () => {
    mockGetSession.mockResolvedValue(null);
    await expect(removeCoHost(COHOST_RECORD_ID)).rejects.toThrow("Forbidden");
  });

  it("revalidates the settings page", async () => {
    await removeCoHost(COHOST_RECORD_ID);
    expect(revalidatePath).toHaveBeenCalledWith(`/e/${EVENT_SLUG}/settings`);
  });
});
