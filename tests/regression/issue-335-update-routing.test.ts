// Root cause (#335, November 2026): event updates defaulted phone-only guests
// to email, ignored channel opt-outs, and detached delivery promises from the
// saved update. Resolve only event RSVP contacts and report delivery separately.
import "@/tests/helpers/english-request-locale";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  guests: vi.fn(),
  event: vi.fn(),
  create: vi.fn(),
  guard: vi.fn(),
  captcha: vi.fn(),
  email: vi.fn(),
  sms: vi.fn(),
}));
vi.mock("@/lib/db", () => ({
  db: {
    rSVP: { findMany: mocks.guests },
    event: { findUnique: mocks.event },
    eventUpdate: { create: mocks.create },
  },
}));
vi.mock("@/app/actions/event/shared", () => ({ assertHostOrCohost: mocks.guard }));
vi.mock("@/lib/captcha", () => ({ assertCaptcha: mocks.captcha }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/redis", () => ({ isRedisEnabled: () => false }));
vi.mock("@/lib/email", () => ({
  sendBlastEmail: mocks.email,
  createEmailNotificationAdapter: async () => ({
    channel: "email",
    available: true,
    kinds: ["event_update"],
    deliver: async (_message: unknown, targets: { destination: string }[]) => {
      await mocks.email(targets.map((t) => t.destination));
      return targets.map(() => ({ status: "accepted" }));
    },
  }),
}));
vi.mock("@/lib/sms", () => ({
  sendSmsBlast: mocks.sms,
  createSmsNotificationAdapter: async () => ({
    channel: "sms",
    available: true,
    kinds: ["event_update"],
    deliver: async (_message: unknown, targets: { destination: string }[]) => {
      await mocks.sms(targets.map((t) => t.destination));
      return targets.map(() => ({ status: "accepted" }));
    },
  }),
}));

import { addEventUpdate } from "@/app/actions/event/blasts";

const guest = {
  id: "rsvp-1",
  guestEmail: "guest@example.com",
  guestPhone: "+15550001111",
  user: {
    notificationChannel: "BOTH",
    emailNotifications: true,
    smsNotifications: true,
    preferredLocale: "en-US",
  },
};
beforeEach(() => {
  vi.clearAllMocks();
  mocks.guard.mockResolvedValue({ id: "event-1", slug: "party" });
  mocks.captcha.mockResolvedValue(undefined);
  mocks.create.mockResolvedValue({ id: "update-1", createdAt: new Date("2026-11-03") });
  mocks.event.mockResolvedValue({
    title: "Party",
    theme: null,
    host: { name: "Host", email: "host@example.com" },
  });
  mocks.guests.mockResolvedValue([guest]);
  mocks.email.mockResolvedValue(undefined);
  mocks.sms.mockResolvedValue(undefined);
});

describe("#335 event-update notification routing", () => {
  it("reaches a phone-only guest with the default Both preference", async () => {
    mocks.guests.mockResolvedValue([{ ...guest, guestEmail: null }]);
    await addEventUpdate("event-1", "See you soon", true);
    expect(mocks.sms).toHaveBeenCalled();
    expect(mocks.email).not.toHaveBeenCalled();
  });

  it("honors both opt-outs instead of sending an update anyway", async () => {
    mocks.guests.mockResolvedValue([
      {
        ...guest,
        user: {
          ...guest.user,
          emailNotifications: false,
          smsNotifications: false,
        },
      },
    ]);
    await addEventUpdate("event-1", "See you soon", true);
    expect(mocks.email).not.toHaveBeenCalled();
    expect(mocks.sms).not.toHaveBeenCalled();
  });

  it("keeps an explicit SMS choice from falling through to email", async () => {
    mocks.guests.mockResolvedValue([
      { ...guest, guestPhone: null, user: { ...guest.user, notificationChannel: "SMS" } },
    ]);
    await addEventUpdate("event-1", "See you soon", true);
    expect(mocks.email).not.toHaveBeenCalled();
  });

  it("posts without notification work when the host disables notification", async () => {
    const result = await addEventUpdate("event-1", "See you soon", false);
    expect(result).toMatchObject({ success: true, id: "update-1" });
    expect(mocks.guests).not.toHaveBeenCalled();
    expect(mocks.email).not.toHaveBeenCalled();
    expect(mocks.sms).not.toHaveBeenCalled();
  });

  it("awaits delivery and returns only an aggregate summary", async () => {
    let release!: () => void;
    mocks.email.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        })
    );
    let finished = false;
    const pending = addEventUpdate("event-1", "See you soon", true).then((result) => {
      finished = true;
      return result;
    });
    await vi.waitFor(() => expect(mocks.email).toHaveBeenCalled());
    expect(finished).toBe(false);
    expect(mocks.create).toHaveBeenCalledBefore(mocks.email);
    release();
    const result = await pending;
    expect(result.notifications).toEqual({
      status: "completed",
      summary: { accepted: 1, skipped: 0, failed: 0, uncertain: 0 },
    });
    expect(JSON.stringify(result)).not.toContain(guest.guestEmail);
    expect(JSON.stringify(result)).not.toContain(guest.guestPhone);
    expect(JSON.stringify(mocks.guests.mock.calls[0][0])).toContain('"emailNotifications":true');
  });

  it("keeps the update posted after preparation failure and redacts diagnostics", async () => {
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
    mocks.guests.mockRejectedValue(new Error("private-provider-secret"));
    const result = await addEventUpdate("event-1", "See you soon", true);
    expect(result).toMatchObject({
      success: true,
      id: "update-1",
      notifications: { status: "failed" },
    });
    expect(JSON.stringify(warning.mock.calls)).not.toContain("private-provider-secret");
    expect(JSON.stringify(result)).not.toContain("private-provider-secret");
    warning.mockRestore();
  });

  it("checks authority and CAPTCHA before saving or dispatching", async () => {
    mocks.guard.mockRejectedValueOnce(new Error("Forbidden"));
    await expect(addEventUpdate("event-1", "See you soon", true)).rejects.toThrow("Forbidden");
    expect(mocks.create).not.toHaveBeenCalled();
    mocks.captcha.mockRejectedValueOnce(new Error("CAPTCHA required"));
    await expect(addEventUpdate("event-1", "See you soon", true)).rejects.toThrow(
      "CAPTCHA required"
    );
    expect(mocks.guests).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
  });
});
