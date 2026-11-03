import { createTransportContext, unconfirmed } from "./transport";
import type {
  AttemptOutcome,
  DeliveryResult,
  DispatchReport,
  EventUpdateMessage,
  NotificationAdapter,
  NotificationRecipient,
} from "./types";

/** Policy knows registered channel IDs, never email addresses or phone numbers. */
export async function dispatchNotification(
  message: EventUpdateMessage,
  recipients: NotificationRecipient[],
  adapters: readonly NotificationAdapter[]
): Promise<DispatchReport> {
  const registry = new Map(adapters.map((adapter) => [adapter.channel, adapter]));
  if (registry.size !== adapters.length) throw new Error("Duplicate notification channel");
  const context = createTransportContext();
  const deliveries: DeliveryResult[] = [];
  const jobs = recipients.flatMap((recipient) => {
    const channels = [...new Set(recipient.policy.channels)];
    return (
      recipient.policy.mode === "all" ? channels.map((channel) => [channel]) : [channels]
    ).map((routes) => {
      const result: DeliveryResult = { recipientId: recipient.id, status: "skipped", attempts: [] };
      deliveries.push(result);
      return { recipient, routes, index: 0, result, done: false };
    });
  });

  // Round-based grouping preserves locale/BCC batching while fallback remains
  // per recipient: an accepted or uncertain destination never advances.
  while (jobs.some((job) => !job.done)) {
    const batches = new Map<string, { adapter: NotificationAdapter; jobs: typeof jobs }>();
    for (const job of jobs) {
      if (job.done) continue;
      const channel = job.routes[job.index++];
      if (!channel) {
        job.done = true;
        continue;
      }
      const adapter = registry.get(channel);
      const destination = job.recipient.destinations[channel];
      let skipped: AttemptOutcome | undefined;
      if (!adapter || !adapter.kinds.includes(message.kind))
        skipped = { status: "skipped", reason: "unsupported" };
      else if (!adapter.available || !destination)
        skipped = { status: "skipped", reason: "unavailable" };
      if (skipped) {
        job.result.attempts.push({ channel, outcome: skipped });
        continue;
      }
      const key = JSON.stringify([channel, job.recipient.locale]);
      const batch = batches.get(key) ?? { adapter: adapter!, jobs: [] };
      batch.jobs.push(job);
      batches.set(key, batch);
    }
    await Promise.all(
      [...batches.values()].map(async ({ adapter, jobs: batch }) => {
        const targets = batch.map(({ recipient }) => ({
          recipientId: recipient.id,
          locale: recipient.locale,
          destination: recipient.destinations[adapter.channel],
        }));
        let outcomes: AttemptOutcome[];
        try {
          outcomes = await adapter.deliver(message, targets, context);
        } catch {
          outcomes = targets.map(unconfirmed);
        }
        batch.forEach((job, index) => {
          const outcome = outcomes[index] ?? unconfirmed();
          job.result.attempts.push({ channel: adapter.channel, outcome });
          if (outcome.status !== "skipped") job.result.status = outcome.status;
          if (outcome.status === "accepted" || outcome.status === "uncertain") job.done = true;
        });
      })
    );
  }
  const summary = { accepted: 0, skipped: 0, failed: 0, uncertain: 0 };
  for (const delivery of deliveries) summary[delivery.status]++;
  return { deliveries, summary };
}
