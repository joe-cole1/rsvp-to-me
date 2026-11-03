import type { AttemptOutcome, TransportContext } from "./types";

export const TRANSPORT_CONCURRENCY = 10;
export const TRANSPORT_TIMEOUT_MS = 30_000;
export const unconfirmed = (): AttemptOutcome => ({ status: "uncertain", reason: "unconfirmed" });

// An HTTP error is a definitive rejection only when the service explicitly
// declined the request. Server/proxy failures can follow an accepted send.
export function httpFailure(status: number): AttemptOutcome {
  return status >= 400 && status < 500 && status !== 408
    ? { status: "failed", reason: "rejected" }
    : unconfirmed();
}

export function createTransportContext(): TransportContext {
  let active = 0;
  const waiting: (() => void)[] = [];
  return {
    async run(operation, uncertain, cancel) {
      await new Promise<void>((resolve) => {
        const enter = () => {
          active++;
          resolve();
        };
        if (active < TRANSPORT_CONCURRENCY) enter();
        else waiting.push(enter);
      });
      const controller = new AbortController();
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        return await Promise.race([
          Promise.resolve()
            .then(() => operation(controller.signal))
            .catch(uncertain),
          new Promise<ReturnType<typeof uncertain>>((resolve) => {
            timer = setTimeout(() => {
              resolve(uncertain());
              controller.abort();
              try {
                cancel?.();
              } catch {
                /* Cancellation cannot establish acceptance. */
              }
            }, TRANSPORT_TIMEOUT_MS);
          }),
        ]);
      } finally {
        clearTimeout(timer);
        active--;
        waiting.shift()?.();
      }
    },
  };
}
