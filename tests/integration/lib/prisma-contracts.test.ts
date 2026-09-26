import { beforeEach, describe, expect, it } from "vitest";
import { db, truncateAll } from "../helpers/db";

// Exercise the real PostgreSQL adapter contracts used by registration and
// multi-record event writes when upgrading the Prisma CLI/client/adapter group.
beforeEach(async () => {
  await truncateAll();
});

describe("Prisma PostgreSQL contracts", () => {
  it("rolls back earlier batch writes when a later write violates uniqueness", async () => {
    const email = "existing-host@example.com";
    await db.user.create({ data: { email, role: "HOST" } });
    const invite = await db.hostInviteCode.create({ data: { code: "rollback-invite" } });

    await expect(
      db.$transaction([
        db.hostInviteCode.update({
          where: { id: invite.id },
          data: { uses: { increment: 1 } },
        }),
        db.user.create({ data: { email, role: "HOST" } }),
      ])
    ).rejects.toMatchObject({ code: "P2002" });

    expect(await db.hostInviteCode.findUnique({ where: { id: invite.id } })).toMatchObject({
      uses: 0,
    });
    expect(await db.user.count()).toBe(1);
  });

  it("rolls back an interactive transaction after a foreign-key failure", async () => {
    await expect(
      db.$transaction(async (tx) => {
        await tx.user.create({ data: { email: "rolled-back@example.com" } });
        await tx.session.create({
          data: {
            userId: "missing-user",
            token: "rollback-session",
            expiresAt: new Date("2030-12-01T20:00:00Z"),
          },
        });
      })
    ).rejects.toMatchObject({ code: "P2003" });

    expect(await db.user.count()).toBe(0);
    expect(await db.session.count()).toBe(0);
  });

  it("preserves an event and its host when a restricted delete fails", async () => {
    const host = await db.user.create({ data: { email: "event-host@example.com", role: "HOST" } });
    const event = await db.event.create({
      data: {
        title: "Protected event",
        slug: "protected-event",
        startAt: new Date("2030-12-01T20:00:00Z"),
        hostId: host.id,
      },
    });

    await expect(db.user.delete({ where: { id: host.id } })).rejects.toMatchObject({
      code: "P2003",
    });

    expect(await db.user.findUnique({ where: { id: host.id } })).toMatchObject({ id: host.id });
    expect(await db.event.findUnique({ where: { id: event.id } })).toMatchObject({
      hostId: host.id,
    });
  });
});
