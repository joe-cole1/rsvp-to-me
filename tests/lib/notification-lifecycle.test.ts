import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({
  connection: vi.fn(),
  update: vi.fn(),
  bindings: vi.fn(),
  settings: vi.fn(),
  settingsUpdate: vi.fn(),
  challenges: vi.fn(),
  lock: vi.fn(),
}));
vi.mock("@/lib/db", () => ({
  db: {
    async $transaction<T>(action: (tx: unknown) => Promise<T>) {
      return action(this);
    },
    $executeRaw: m.lock,
    notificationConnection: { findFirst: m.connection, update: m.update },
    notificationBinding: { updateMany: m.bindings },
    notificationSettings: { findUnique: m.settings, update: m.settingsUpdate },
    notificationChallenge: { updateMany: m.challenges },
  },
}));
import { retireChangedAccountConnection } from "@/lib/notifications/lifecycle";
beforeEach(() => {
  vi.clearAllMocks();
  m.connection.mockResolvedValue(null);
  m.settings.mockResolvedValue(null);
});
it("does nothing without a matching legacy account contact", async () => {
  await retireChangedAccountConnection("user", "email", null);
  expect(m.connection).not.toHaveBeenCalled();
  await retireChangedAccountConnection("user", "email", "old@example.com");
  expect(m.update).not.toHaveBeenCalled();
});
it("retires only matching proof, bindings and challenges, never channel consent", async () => {
  m.connection.mockResolvedValue({ id: "connection" });
  m.settings.mockResolvedValue({ id: "profile:user", blockedChannels: ["sms"] });
  await retireChangedAccountConnection("user", "email", "old@example.com");
  expect(m.connection).toHaveBeenCalledWith({
    where: { userId: "user", channel: "email", destination: "old@example.com", revokedAt: null },
  });
  expect(m.bindings).toHaveBeenCalledWith({
    where: { connectionId: "connection" },
    data: { revokedAt: expect.any(Date) },
  });
  // A sign-in change withdraws proof; it must not silently block email for every event.
  expect(m.settingsUpdate).not.toHaveBeenCalled();
  expect(m.challenges).toHaveBeenCalled();
});
