import { describe, it, expect, vi, beforeEach } from "vitest";
import { revalidatePath } from "next/cache";

const {
  mockEventFindUnique,
  mockUserFindUnique,
  mockEventCoHostCreate,
  mockEventCoHostFindUnique,
  mockEventCoHostDelete,
  mockEventCoHostUpdate,
  mockCoHostInviteCreate,
  mockCoHostInviteDelete,
  mockCoHostInviteFindUnique,
  mockCoHostInviteFindFirst,
  mockCoHostInviteFindMany,
  mockGetSession,
} = vi.hoisted(() => ({
  mockEventFindUnique: vi.fn(),
  mockUserFindUnique: vi.fn(),
  mockEventCoHostCreate: vi.fn(),
  mockEventCoHostFindUnique: vi.fn(),
  mockEventCoHostDelete: vi.fn(),
  mockEventCoHostUpdate: vi.fn(),
  mockCoHostInviteCreate: vi.fn(),
  mockCoHostInviteDelete: vi.fn(),
  mockCoHostInviteFindUnique: vi.fn(),
  mockCoHostInviteFindFirst: vi.fn(),
  mockCoHostInviteFindMany: vi.fn(),
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
      update: mockEventCoHostUpdate,
    },
    coHostInvitation: {
      create: mockCoHostInviteCreate,
      delete: mockCoHostInviteDelete,
      findUnique: mockCoHostInviteFindUnique,
      findFirst: mockCoHostInviteFindFirst,
      findMany: mockCoHostInviteFindMany,
    },
  },
}));

vi.mock("@/lib/session", () => ({ getSession: mockGetSession }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/email", () => ({ sendCoHostInviteEmail: vi.fn().mockResolvedValue({}) }));

import {
  addCoHost,
  removeCoHost,
  updateCoHostDisplayName,
  cancelCoHostInvitation,
  getPendingCoHostInvitations,
} from "@/app/actions/event/cohosts";

const HOST_ID = "host-1";
const OTHER_ID = "other-user";
const EVENT_ID = "event-1";
const EVENT_SLUG = "test-event";

function asHost() {
  mockGetSession.mockResolvedValue({ userId: HOST_ID, email: "host@example.com" });
}

function hostEventRow(overrides = {}) {
  return {
    id: EVENT_ID,
    hostId: HOST_ID,
    slug: EVENT_SLUG,
    title: "Test Event",
    startAt: new Date(),
    host: { name: "Host User" },
    coHosts: [],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ── addCoHost ─────────────────────────────────────────────────────────────────

describe("addCoHost", () => {
  const COHOST_EMAIL = "cohost@example.com";

  beforeEach(() => {
    asHost();
    mockEventFindUnique.mockResolvedValue(hostEventRow());
    mockCoHostInviteFindFirst.mockResolvedValue(null);
    mockCoHostInviteCreate.mockResolvedValue({ id: "invite-1" });
  });

  it("returns success with invite info on valid email", async () => {
    const result = await addCoHost(EVENT_ID, COHOST_EMAIL);
    expect(result.success).toBe(true);
    expect(result.email).toBe(COHOST_EMAIL);
    expect(result.invited).toBe(true);
  });

  it("creates a CoHostInvitation row", async () => {
    await addCoHost(EVENT_ID, COHOST_EMAIL);
    expect(mockCoHostInviteCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ eventId: EVENT_ID, email: COHOST_EMAIL }),
      })
    );
  });

  it("returns error if already invited", async () => {
    mockCoHostInviteFindFirst.mockResolvedValue({ id: "invite-1" });
    const result = await addCoHost(EVENT_ID, COHOST_EMAIL);
    expect(result.success).toBe(false);
    expect(result.error).toBe("Already invited");
    expect(mockCoHostInviteCreate).not.toHaveBeenCalled();
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
      eventId: EVENT_ID,
      event: { slug: EVENT_SLUG },
    });
    mockEventFindUnique.mockResolvedValue(hostEventRow());
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

  it("stays host-only: a co-host cannot remove other co-hosts (SEC-30)", async () => {
    mockGetSession.mockResolvedValue({ userId: OTHER_ID, email: "cohost@example.com" });
    mockEventFindUnique.mockResolvedValue(hostEventRow({ coHosts: [{ userId: OTHER_ID }] }));
    await expect(removeCoHost(COHOST_RECORD_ID)).rejects.toThrow("Forbidden");
  });

  it("throws Unauthorized when no session", async () => {
    mockGetSession.mockResolvedValue(null);
    await expect(removeCoHost(COHOST_RECORD_ID)).rejects.toThrow("Unauthorized");
  });

  it("revalidates the settings page", async () => {
    await removeCoHost(COHOST_RECORD_ID);
    expect(revalidatePath).toHaveBeenCalledWith(`/e/${EVENT_SLUG}/settings`);
  });
});

// ── updateCoHostDisplayName ───────────────────────────────────────────────────

describe("updateCoHostDisplayName", () => {
  const COHOST_RECORD_ID = "ch-1";

  beforeEach(() => {
    asHost();
    mockEventCoHostFindUnique.mockResolvedValue({
      eventId: EVENT_ID,
      event: { slug: EVENT_SLUG },
    });
    mockEventFindUnique.mockResolvedValue(hostEventRow());
    mockEventCoHostUpdate.mockResolvedValue({});
  });

  it("updates the display name", async () => {
    const result = await updateCoHostDisplayName(COHOST_RECORD_ID, "New Name");
    expect(result.success).toBe(true);
    expect(mockEventCoHostUpdate).toHaveBeenCalledWith({
      where: { id: COHOST_RECORD_ID },
      data: { displayName: "New Name" },
    });
  });

  it("throws Forbidden if not host", async () => {
    mockGetSession.mockResolvedValue({ userId: OTHER_ID, email: "other@example.com" });
    await expect(updateCoHostDisplayName(COHOST_RECORD_ID, "New Name")).rejects.toThrow(
      "Forbidden"
    );
  });
});

// ── cancelCoHostInvitation ────────────────────────────────────────────────────

describe("cancelCoHostInvitation", () => {
  beforeEach(() => {
    asHost();
    mockCoHostInviteFindUnique.mockResolvedValue({
      id: "invite-1",
      eventId: EVENT_ID,
      email: "invited@example.com",
      event: { slug: EVENT_SLUG },
    });
    mockEventFindUnique.mockResolvedValue(hostEventRow());
    mockCoHostInviteDelete.mockResolvedValue({});
  });

  it("deletes the invitation", async () => {
    const result = await cancelCoHostInvitation("invite-1");
    expect(result.success).toBe(true);
    expect(mockCoHostInviteDelete).toHaveBeenCalledWith({ where: { id: "invite-1" } });
  });

  it("throws Forbidden if not host", async () => {
    mockGetSession.mockResolvedValue({ userId: OTHER_ID, email: "other@example.com" });
    await expect(cancelCoHostInvitation("invite-1")).rejects.toThrow("Forbidden");
  });
});

// ── getPendingCoHostInvitations ───────────────────────────────────────────────

describe("getPendingCoHostInvitations", () => {
  beforeEach(() => {
    asHost();
    mockCoHostInviteFindMany.mockResolvedValue([{ id: "invite-1", email: "invited@example.com" }]);
  });

  it("returns pending invitations", async () => {
    const result = await getPendingCoHostInvitations(EVENT_ID);
    expect(result).toHaveLength(1);
    expect(result[0].email).toBe("invited@example.com");
  });

  it("throws Forbidden if not host", async () => {
    mockGetSession.mockResolvedValue({ userId: OTHER_ID, email: "other@example.com" });
    await expect(getPendingCoHostInvitations(EVENT_ID)).rejects.toThrow("Forbidden");
  });
});
