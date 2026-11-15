// #849 root causes: reminders included declined guests, loaded all future-event
// recipients, and could use a date snapshot taken before the host rescheduled.
import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({
  due: vi.fn(),
  load: vi.fn(),
  claim: vi.fn(),
  rows: vi.fn(),
  deliver: vi.fn(),
  event: vi.fn(),
}));
vi.mock("@/lib/db", () => ({
  db: {
    $queryRaw: m.due,
    $executeRaw: (sql: TemplateStringsArray) =>
      sql.join("").includes("UPDATE") ? m.claim() : Promise.resolve(1),
    async $transaction(action: (client: unknown) => Promise<unknown>) {
      return action(this);
    },
    notificationSchedule: { findUniqueOrThrow: m.load },
    event: { findUnique: m.event },
    cronLock: { deleteMany: async () => {}, create: async () => {} },
    session: { deleteMany: async () => {} },
  },
}));
vi.mock("@/lib/redis", () => ({ isRedisEnabled: () => false }));
vi.mock("@/lib/notifications/resolve", () => ({ recipientSelect: {}, resolveRecipients: m.rows }));
vi.mock("@/lib/notifications/service", () => ({ deliver: m.deliver }));
import { processReminders } from "@/lib/reminders";
const startAt = new Date(Date.now() + 3600000);
const candidate = { id: "slot", eventId: "event", startAt };
function slot(kind = "reminder") {
  return {
    id: "slot",
    kind,
    hoursBefore: 2,
    recipientRouting: true,
    event: {
      id: "event",
      startAt,
      slug: "party",
      title: "Party",
      host: { name: "Host" },
      rsvps: ["GOING", "MAYBE", "NO", "INVITED"].map((status) => ({
        id: status,
        status,
        responded: status !== "INVITED",
        guestEmail: `${status}@example.test`,
      })),
      invitations: [{ rsvpId: "INVITED", channel: "EMAIL", sentTo: "INVITED@example.test" }],
    },
  };
}
beforeEach(() => {
  vi.clearAllMocks();
  m.due.mockResolvedValue([candidate]);
  m.claim.mockResolvedValue(1);
  m.load.mockResolvedValue(slot());
  m.rows.mockResolvedValue([]);
  m.deliver.mockResolvedValue({});
});
describe("#849 reminder audience and claims", () => {
  it("excludes declined and unanswered guests from ordinary reminders", async () => {
    await processReminders();
    expect(m.rows.mock.calls[0][1].map((row: { status: string }) => row.status)).toEqual([
      "GOING",
      "MAYBE",
    ]);
  });
  it("keeps nudges limited to matching unanswered invitation contacts", async () => {
    m.load.mockResolvedValue(slot("nudge"));
    await processReminders();
    expect(m.rows.mock.calls[0][1]).toEqual([
      expect.objectContaining({ id: "INVITED", guestEmail: "INVITED@example.test" }),
    ]);
  });
  it("does not load recipients for events without due schedules", async () => {
    m.due.mockResolvedValue([]);
    await processReminders();
    expect(m.load).not.toHaveBeenCalled();
    expect(m.rows).not.toHaveBeenCalled();
  });
  it("skips a candidate that became stale or consumed before claiming", async () => {
    m.claim.mockResolvedValue(0);
    await processReminders();
    expect(m.load).not.toHaveBeenCalled();
    expect(m.deliver).not.toHaveBeenCalled();
  });
  it("blocks submission after a date edit commits during preparation", async () => {
    m.rows.mockResolvedValue([
      {
        id: "GOING",
        locale: "en-US",
        policy: { channels: ["email"] },
        destinations: { email: "guest@example.test" },
      },
    ]);
    m.event.mockResolvedValue({
      startAt: new Date(startAt.getTime() + 86400000),
      status: "PUBLISHED",
    });
    await processReminders();
    const recipient = m.deliver.mock.calls[0][1][0];
    await expect(recipient.canSend("email", "guest@example.test")).resolves.toBe(false);
  });
});
