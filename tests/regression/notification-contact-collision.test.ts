// Root cause: exact DB equality missed legacy phone punctuation/email casing,
// allowing verified contact changes to collide with another event RSVP.
import { describe, expect, it, vi } from "vitest";
import type { Prisma } from "@/app/generated/prisma/client";
vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("@/lib/session-user", () => ({ getSessionUser: async () => null }));
vi.mock("@/lib/redis", () => ({ isRedisEnabled: () => false }));
import { assertNotificationContactAvailable } from "@/lib/notifications/manage";
describe("normalized event contact collisions", () => {
  it.each([
    ["sms", "+15550002222", { guestEmail: null, guestPhone: "+1 (555) 000-2222" }],
    ["email", "guest@example.com", { guestEmail: " Guest@Example.com ", guestPhone: null }],
  ])(
    "rejects a same-channel %s collision before any contact write",
    async (channel, destination, contact) => {
      const findMany = vi.fn().mockResolvedValue([contact]);
      const client = { rSVP: { findMany } } as unknown as Pick<Prisma.TransactionClient, "rSVP">;
      await expect(
        assertNotificationContactAvailable(
          client,
          "event",
          "current",
          channel as string,
          destination as string
        )
      ).rejects.toThrow("contactConflict");
      expect(findMany).toHaveBeenCalledWith({
        where: { eventId: "event", id: { not: "current" } },
        select: { guestEmail: true, guestPhone: true },
      });
    }
  );
  it("does not infer a connection identity across channels", async () => {
    const client = {
      rSVP: {
        findMany: vi
          .fn()
          .mockResolvedValue([{ guestEmail: null, guestPhone: "guest@example.com" }]),
      },
    } as unknown as Pick<Prisma.TransactionClient, "rSVP">;
    await expect(
      assertNotificationContactAvailable(client, "event", "current", "email", "guest@example.com")
    ).resolves.toBeUndefined();
  });
});
