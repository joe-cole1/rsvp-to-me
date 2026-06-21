export async function register() {
  if (
    process.env.NEXT_RUNTIME === "nodejs" &&
    process.env.NODE_ENV !== "test" &&
    process.env.NEXT_PHASE !== "phase-production-build"
  ) {
    console.log("[instrumentation] Bootstrapping background tasks in nodejs runtime...");
    try {
      const { startInProcessCron } = await import("./lib/cron-scheduler");
      await startInProcessCron();
    } catch (err) {
      console.error("[instrumentation] Failed to initialize in-process cron scheduler:", err);
    }
  }
}
