import { randomUUID } from "crypto";
import { getClientIp, isTrustedIpConfigured } from "@/lib/clientIp";
import { getSession } from "@/lib/session";
import { CAPTCHA_ERROR_MESSAGE, type CaptchaAction } from "@/lib/captcha-types";

const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const VERIFY_TIMEOUT_MS = 5_000;

type TurnstileResponse = {
  success?: boolean;
  hostname?: string;
  action?: string;
  "error-codes"?: string[];
};

type CaptchaConfig =
  | { state: "disabled"; siteKey: null; secretKey: null }
  | { state: "partial"; siteKey: string | null; secretKey: string | null }
  | { state: "enabled"; siteKey: string; secretKey: string };

export class CaptchaVerificationError extends Error {
  constructor() {
    super(CAPTCHA_ERROR_MESSAGE);
    this.name = "CaptchaVerificationError";
  }
}

function readCaptchaConfig(): CaptchaConfig {
  const siteKey = process.env.TURNSTILE_SITE_KEY?.trim() || null;
  const secretKey = process.env.TURNSTILE_SECRET_KEY?.trim() || null;

  if (!siteKey && !secretKey) return { state: "disabled", siteKey: null, secretKey: null };
  if (!siteKey || !secretKey) return { state: "partial", siteKey, secretKey };
  return { state: "enabled", siteKey, secretKey };
}

export function getCaptchaSiteKey(): string | null {
  return readCaptchaConfig().siteKey;
}

function expectedHostname(): string | null {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!appUrl) return null;
  try {
    return new URL(appUrl).hostname;
  } catch {
    return null;
  }
}

async function callSiteverify(
  secretKey: string,
  token: string,
  idempotencyKey: string,
  remoteIp?: string
): Promise<TurnstileResponse> {
  const body = new FormData();
  body.set("secret", secretKey);
  body.set("response", token);
  body.set("idempotency_key", idempotencyKey);
  if (remoteIp) body.set("remoteip", remoteIp);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), VERIFY_TIMEOUT_MS);
  try {
    const response = await fetch(SITEVERIFY_URL, {
      method: "POST",
      body,
      signal: controller.signal,
      cache: "no-store",
    });
    if (!response.ok) {
      throw new Error(`Siteverify returned HTTP ${response.status}`);
    }
    return (await response.json()) as TurnstileResponse;
  } finally {
    clearTimeout(timeout);
  }
}

function logFailure(action: CaptchaAction, reason: string, errorCodes?: string[]) {
  console.warn("[captcha] Turnstile verification failed", {
    action,
    reason,
    errorCodes: errorCodes ?? [],
  });
}

export async function assertCaptcha(
  action: CaptchaAction,
  token: string | null | undefined
): Promise<void> {
  const config = readCaptchaConfig();
  if (config.state === "disabled") return;

  const session = await getSession();
  if (session?.role === "ADMIN") return;

  if (config.state === "partial") {
    logFailure(action, "partial_configuration");
    throw new CaptchaVerificationError();
  }

  if (typeof token !== "string" || token.length === 0 || token.length > 2048) {
    logFailure(action, "missing_or_invalid_token");
    throw new CaptchaVerificationError();
  }

  const remoteIp = isTrustedIpConfigured() ? await getClientIp() : undefined;
  const idempotencyKey = randomUUID();
  let verification: TurnstileResponse | null = null;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      verification = await callSiteverify(config.secretKey, token, idempotencyKey, remoteIp);
      if (!verification["error-codes"]?.includes("internal-error")) break;
    } catch (error) {
      if (attempt === 1) {
        logFailure(action, error instanceof Error ? error.message : "siteverify_unavailable");
        throw new CaptchaVerificationError();
      }
    }
  }

  if (!verification?.success) {
    logFailure(action, "challenge_rejected", verification?.["error-codes"]);
    throw new CaptchaVerificationError();
  }
  if (verification.action !== action) {
    logFailure(action, "action_mismatch");
    throw new CaptchaVerificationError();
  }

  const hostname = expectedHostname();
  if (hostname && verification.hostname !== hostname) {
    logFailure(action, "hostname_mismatch");
    throw new CaptchaVerificationError();
  }
}
