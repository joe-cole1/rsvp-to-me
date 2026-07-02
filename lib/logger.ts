type LogLevel = "debug" | "info" | "warn" | "error";

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const CURRENT_LEVEL: LogLevel = (process.env.LOG_LEVEL as LogLevel) || "info";

function maskPII(obj: unknown): unknown {
  if (!obj || typeof obj !== "object") return obj;

  const masked = { ...(obj as Record<string, unknown>) };
  const keysToMask = [
    "email",
    "phone",
    "token",
    "password",
    "smtpPass",
    "cfWorkerSecret",
    "cfApiToken",
    "to",
    "body",
  ];

  for (const key of Object.keys(masked)) {
    const val = masked[key];
    if (keysToMask.includes(key)) {
      masked[key] = "••••••••";
    } else if (val && typeof val === "object") {
      masked[key] = maskPII(val);
    }
  }
  return masked;
}

function log(level: LogLevel, message: string, meta?: unknown) {
  if (LOG_LEVELS[level] < LOG_LEVELS[CURRENT_LEVEL]) return;

  const logObject: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    level,
    message,
  };

  if (meta !== undefined && meta !== null) {
    logObject.meta = maskPII(meta);
  }

  if (level === "error") {
    console.error(JSON.stringify(logObject));
  } else if (level === "warn") {
    console.warn(JSON.stringify(logObject));
  } else {
    console.log(JSON.stringify(logObject));
  }
}

export const logger = {
  debug: (message: string, meta?: unknown) => log("debug", message, meta),
  info: (message: string, meta?: unknown) => log("info", message, meta),
  warn: (message: string, meta?: unknown) => log("warn", message, meta),
  error: (message: string, meta?: unknown) => log("error", message, meta),
};

/**
 * L-4: shared rejection handler for fire-and-forget promises whose failures
 * must never break the main flow (activity logging, best-effort notification
 * sends). Instead of `.catch(() => {})` discarding the error invisibly, the
 * swallowed error is recorded at debug level. Resolves to `null` so
 * `await p.catch(logSafe("ctx"))` keeps the same "value or null" semantics
 * as the previous `.catch(() => null)` call sites.
 */
export function logSafe(context: string) {
  return (err: unknown): null => {
    log("debug", `Swallowed non-critical error in ${context}`, {
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  };
}
