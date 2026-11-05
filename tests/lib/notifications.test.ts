import { afterEach, describe, expect, it, vi } from "vitest";
import { dispatchNotification } from "@/lib/notifications/dispatch";
import {
  createTransportContext,
  httpFailure,
  TRANSPORT_TIMEOUT_MS,
  unconfirmed,
} from "@/lib/notifications/transport";
import type {
  AttemptOutcome,
  EventUpdateMessage,
  NotificationAdapter,
  NotificationRecipient,
} from "@/lib/notifications/types";

const message: EventUpdateMessage = {
  kind: "event_update",
  id: "update-1",
  eventSlug: "party",
  eventTitle: "Party",
  body: "Host's {text}",
  hostName: "Host",
};
function recipient(channels = ["email", "sms"]): NotificationRecipient {
  return {
    id: "guest-1",
    locale: "en-US",
    destinations: { email: "guest@example.com", sms: "+15550001111", telegram: "opaque-chat-id" },
    policy: { channels },
  };
}
function adapter(
  channel: string,
  outcome: AttemptOutcome = { status: "accepted" }
): NotificationAdapter {
  return {
    channel,
    available: true,
    kinds: ["event_update"],
    deliver: vi.fn(async (_message, targets) => targets.map(() => outcome)),
  };
}
afterEach(() => vi.useRealTimers());

describe("channel-neutral dispatch", () => {
  it("accepts a third adapter without a new routing branch or Prisma enum", async () => {
    const telegram = adapter("telegram");
    const report = await dispatchNotification(message, [recipient(["telegram"])], [telegram]);
    expect(report.summary).toEqual({ accepted: 1, failed: 0, skipped: 0, uncertain: 0 });
    expect(telegram.deliver).toHaveBeenCalledWith(
      message,
      [{ recipientId: "guest-1", destination: "opaque-chat-id", locale: "en-US" }],
      expect.anything()
    );
  });

  it("falls back after explicit rejection and counts only the final acceptance", async () => {
    const email = adapter("email", { status: "failed", reason: "rejected" });
    const sms = adapter("sms");
    const report = await dispatchNotification(message, [recipient()], [email, sms]);
    expect(report.summary).toEqual({ accepted: 1, failed: 0, skipped: 0, uncertain: 0 });
    expect(report.deliveries[0].attempts.map((attempt) => attempt.outcome.status)).toEqual([
      "failed",
      "accepted",
    ]);
  });

  it.each(["accepted", "uncertain"] as const)("does not fall back after %s", async (status) => {
    const sms = adapter("sms");
    const report = await dispatchNotification(
      message,
      [recipient()],
      [adapter("email", { status }), sms]
    );
    expect(sms.deliver).not.toHaveBeenCalled();
    expect(report.summary[status]).toBe(1);
  });

  it("skips unavailable and unknown adapters, then uses a registered alternative", async () => {
    const email = { ...adapter("email"), available: false };
    const report = await dispatchNotification(
      message,
      [recipient(["unknown", "email", "sms"])],
      [email, adapter("sms")]
    );
    expect(email.deliver).not.toHaveBeenCalled();
    expect(report.summary.accepted).toBe(1);
    expect(report.deliveries[0].attempts).toHaveLength(3);
  });

  it("rejects unsupported message kinds without calling delivery", async () => {
    const unsupported = { ...adapter("email"), kinds: [] };
    const report = await dispatchNotification(message, [recipient(["email"])], [unsupported]);
    expect(report.summary.skipped).toBe(1);
    expect(unsupported.deliver).not.toHaveBeenCalled();
  });

  it("retains a rejection when remaining routes are unavailable", async () => {
    const report = await dispatchNotification(
      message,
      [recipient()],
      [adapter("email", { status: "failed" })]
    );
    expect(report.summary.failed).toBe(1);
  });

  it("sends a copy to each proved channel without repeating duplicate choices", async () => {
    const all = { ...recipient(["email", "sms", "email"]), proved: ["email", "sms"] };
    const report = await dispatchNotification(
      message,
      [all],
      [adapter("email"), adapter("sms", { status: "failed" })]
    );
    expect(report.summary).toEqual({ accepted: 1, failed: 1, skipped: 0, uncertain: 0 });
    expect(report.deliveries).toHaveLength(2);
  });

  it("gives unproved contacts one shared message even with every channel checked", async () => {
    const email = adapter("email");
    const sms = adapter("sms");
    const report = await dispatchNotification(message, [recipient()], [email, sms]);
    expect(report.deliveries).toHaveLength(1);
    expect(email.deliver).toHaveBeenCalledTimes(1);
    expect(sms.deliver).not.toHaveBeenCalled();
  });

  it("sends a proved channel its own copy beside one message to the unproved rest", async () => {
    const email = adapter("email");
    const sms = adapter("sms");
    const report = await dispatchNotification(
      message,
      [{ ...recipient(), proved: ["sms"] }],
      [email, sms]
    );
    expect(report.deliveries).toHaveLength(2);
    expect(email.deliver).toHaveBeenCalledTimes(1);
    expect(sms.deliver).toHaveBeenCalledTimes(1);
  });

  it("batches only the same channel and locale and advances rejected recipients alone", async () => {
    const email = adapter("email");
    vi.mocked(email.deliver).mockImplementation(async (_message, targets) =>
      targets.map((target) => ({
        status: target.recipientId === "rejected" ? "failed" : "accepted",
      }))
    );
    const sms = adapter("sms");
    const guests = [
      recipient(),
      { ...recipient(), id: "rejected" },
      { ...recipient(), id: "dutch", locale: "nl-NL" as const },
    ];
    const report = await dispatchNotification(message, guests, [email, sms]);
    expect(email.deliver).toHaveBeenCalledTimes(2);
    expect(sms.deliver).toHaveBeenCalledWith(
      message,
      [expect.objectContaining({ recipientId: "rejected" })],
      expect.anything()
    );
    expect(report.summary.accepted).toBe(3);
  });

  it("treats thrown or incomplete provider results as uncertain", async () => {
    const broken = adapter("email");
    vi.mocked(broken.deliver).mockRejectedValueOnce(new Error("private provider payload"));
    expect(
      (await dispatchNotification(message, [recipient()], [broken, adapter("sms")])).summary
        .uncertain
    ).toBe(1);
    vi.mocked(broken.deliver).mockResolvedValueOnce([]);
    expect((await dispatchNotification(message, [recipient()], [broken])).summary.uncertain).toBe(
      1
    );
  });

  it("rejects duplicate registry IDs", async () => {
    await expect(
      dispatchNotification(message, [], [adapter("email"), adapter("email")])
    ).rejects.toThrow("Duplicate notification channel");
  });
});

describe("bounded provider attempts", () => {
  it("limits simultaneous requests to ten", async () => {
    const context = createTransportContext();
    const release: (() => void)[] = [];
    let active = 0,
      maximum = 0;
    const requests = Array.from({ length: 25 }, () =>
      context.run<AttemptOutcome>(async () => {
        active++;
        maximum = Math.max(maximum, active);
        await new Promise<void>((resolve) => release.push(resolve));
        active--;
        return { status: "accepted" as const };
      }, unconfirmed)
    );
    await vi.waitFor(() => expect(release).toHaveLength(10));
    while (release.length) {
      release.splice(0).forEach((resolve) => resolve());
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    await Promise.all(requests);
    expect(maximum).toBe(10);
  });

  it("aborts uncertain requests at the deadline and never starts a fallback", async () => {
    vi.useFakeTimers();
    let signal: AbortSignal | undefined;
    const cancel = vi.fn();
    const sms = adapter("sms");
    const email = adapter("email");
    vi.mocked(email.deliver).mockImplementation(async (_message, _targets, context) => [
      await context.run(
        async (value) => {
          signal = value;
          return new Promise<AttemptOutcome>(() => {});
        },
        unconfirmed,
        cancel
      ),
    ]);
    const pending = dispatchNotification(message, [recipient()], [email, sms]);
    await vi.advanceTimersByTimeAsync(TRANSPORT_TIMEOUT_MS);
    expect((await pending).summary.uncertain).toBe(1);
    expect(signal?.aborted).toBe(true);
    expect(cancel).toHaveBeenCalledOnce();
    expect(sms.deliver).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("treats network errors as uncertain and negative HTTP acknowledgements as rejection", async () => {
    expect(
      await createTransportContext().run(async () => {
        throw new Error("private");
      }, unconfirmed)
    ).toEqual(unconfirmed());
    expect(httpFailure(400).status).toBe("failed");
    expect(httpFailure(429).status).toBe("failed");
    expect(httpFailure(408).status).toBe("uncertain");
    expect(httpFailure(500).status).toBe("uncertain");
  });
});
