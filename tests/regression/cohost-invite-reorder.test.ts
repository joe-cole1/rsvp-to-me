import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockEventFindUnique,
  mockUserFindUnique,
  mockCoHostInviteCreate,
  mockCoHostInviteDelete,
  mockCoHostInviteFindUnique,
  mockCoHostInviteFindFirst,
  mockCoHostInviteFindMany,
  mockEventCoHostCreate,
  mockEventCoHostFindUnique,
  mockEventCoHostDelete,
  mockEventInfoSectionUpdate,
  mockTransaction,
  mockGetSession,
} = vi.hoisted(() => ({
  mockEventFindUnique: vi.fn(),
  mockUserFindUnique: vi.fn(),
  mockCoHostInviteCreate: vi.fn(),
  mockCoHostInviteDelete: vi.fn(),
  mockCoHostInviteFindUnique: vi.fn(),
  mockCoHostInviteFindFirst: vi.fn(),
  mockCoHostInviteFindMany: vi.fn(),
  mockEventCoHostCreate: vi.fn(),
  mockEventCoHostFindUnique: vi.fn(),
  mockEventCoHostDelete: vi.fn(),
  mockEventInfoSectionUpdate: vi.fn(),
  mockTransaction: vi.fn(),
  mockGetSession: vi.fn(),
}));

vi.mock("@/lib/db", () => {
  const mockDeleteMany = vi.fn().mockResolvedValue({ count: 0 });
  return {
    db: {
      event: { findUnique: mockEventFindUnique },
      user: { findUnique: mockUserFindUnique, create: vi.fn(), update: vi.fn() },
      coHostInvitation: {
        create: mockCoHostInviteCreate,
        delete: mockCoHostInviteDelete,
        findUnique: mockCoHostInviteFindUnique,
        findFirst: mockCoHostInviteFindFirst,
        findMany: mockCoHostInviteFindMany,
      },
      eventCoHost: {
        create: mockEventCoHostCreate,
        findUnique: mockEventCoHostFindUnique,
        delete: mockEventCoHostDelete,
        deleteMany: mockDeleteMany,
      },
      eventInfoSection: {
        update: mockEventInfoSectionUpdate,
      },
      $transaction: mockTransaction,
    },
  };
});

vi.mock("@/lib/session", () => ({ getSession: mockGetSession }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/email", () => ({ sendCoHostInviteEmail: vi.fn().mockResolvedValue({}) }));

import {
  addCoHost,
  cancelCoHostInvitation,
  getPendingCoHostInvitations,
} from "@/app/actions/event/cohosts";
import { reorderInfoSections } from "@/app/actions/event/infoSections";

const HOST_ID = "host-1";
const EVENT_ID = "event-1";

beforeEach(() => {
  vi.clearAllMocks();
  mockGetSession.mockResolvedValue({ userId: HOST_ID, email: "host@example.com" });
  mockEventFindUnique.mockResolvedValue({
    id: EVENT_ID,
    hostId: HOST_ID,
    slug: "party",
    title: "Party",
    startAt: new Date(),
    host: { name: "Host User" },
    coHosts: [],
  });
});

describe("Co-host invitation actions", () => {
  it("creates a coHostInvitation and does not automatically add to eventCoHost", async () => {
    mockCoHostInviteFindFirst.mockResolvedValue(null);
    mockCoHostInviteCreate.mockResolvedValue({ id: "invite-1" });

    const result = await addCoHost(EVENT_ID, "invitee@example.com");

    expect(result.success).toBe(true);
    expect(result.invited).toBe(true);
    expect(mockCoHostInviteCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventId: EVENT_ID,
          email: "invitee@example.com",
        }),
      })
    );
    expect(mockEventCoHostCreate).not.toHaveBeenCalled();
  });

  it("can retrieve pending invitations", async () => {
    mockCoHostInviteFindMany.mockResolvedValue([{ id: "invite-1", email: "invitee@example.com" }]);

    const result = await getPendingCoHostInvitations(EVENT_ID);
    expect(result).toHaveLength(1);
    expect(result[0].email).toBe("invitee@example.com");
  });

  it("can cancel pending invitation", async () => {
    mockCoHostInviteFindUnique.mockResolvedValue({
      id: "invite-1",
      eventId: EVENT_ID,
      email: "invitee@example.com",
      event: { slug: "party" },
    });
    mockCoHostInviteDelete.mockResolvedValue({});

    const result = await cancelCoHostInvitation("invite-1");
    expect(result.success).toBe(true);
    expect(mockCoHostInviteDelete).toHaveBeenCalledWith({ where: { id: "invite-1" } });
  });
});

describe("Widget section reordering actions", () => {
  it("updates order of info sections inside transaction", async () => {
    mockTransaction.mockImplementation(async (promises) => promises);
    mockEventInfoSectionUpdate.mockResolvedValue({});

    const result = await reorderInfoSections(EVENT_ID, ["sec-1", "sec-2"]);

    expect(result.success).toBe(true);
    expect(mockEventInfoSectionUpdate).toHaveBeenCalledTimes(2);
    expect(mockEventInfoSectionUpdate).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: { id: "sec-1" },
        data: { order: 0 },
      })
    );
    expect(mockEventInfoSectionUpdate).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: { id: "sec-2" },
        data: { order: 1 },
      })
    );
  });
});
