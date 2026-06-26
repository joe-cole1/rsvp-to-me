export async function register() {
  if (
    process.env.NEXT_RUNTIME === "nodejs" &&
    process.env.NODE_ENV !== "test" &&
    process.env.NEXT_PHASE !== "phase-production-build"
  ) {
    console.log("[instrumentation] Bootstrapping background tasks in nodejs runtime...");
    try {
      const { startInProcessCron, stopInProcessCron } = await import("./lib/cron-scheduler");
      await startInProcessCron();

      const shutdown = () => {
        try {
          stopInProcessCron();
          console.log("[instrumentation] Graceful shutdown — cron stopped.");
        } catch (err) {
          console.error("[instrumentation] Error during shutdown:", err);
        }
        process.exit(0);
      };

      process.once("SIGTERM", shutdown);
      process.once("SIGINT", shutdown);
    } catch (err) {
      console.error("[instrumentation] Failed to initialize in-process cron scheduler:", err);
    }
  }
}
