import "dotenv/config";
import cron from "node-cron";
import { processReminders } from "../lib/reminders";

console.log("[cron] Reminder scheduler started — running every 15 minutes");

// Run immediately on startup to catch any reminders that fired while the container was down
processReminders().catch((err) => console.error("[cron] Startup check failed:", err));

cron.schedule("*/15 * * * *", () => {
  processReminders().catch((err) => console.error("[cron] Check failed:", err));
});
