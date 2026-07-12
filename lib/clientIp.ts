import { headers } from "next/headers";

/**
 * Resolve the client IP from request headers for rate-limiting / abuse
 * controls. Shared by auth, event-password, and guest-invite rate limiting so
 * the trusted-header handling stays consistent across the app.
 *
 * SEC-22: forwarding headers (`X-Forwarded-For`, `X-Real-IP`,
 * `CF-Connecting-IP`) are attacker-controlled unless a trusted proxy overwrites
 * them, so we do NOT trust them by default. A client could otherwise rotate
 * `X-Forwarded-For` on every request to mint a fresh rate-limit key and bypass
 * every IP-keyed limiter. Instead:
 *
 *   1. We consult a forwarding header ONLY when the operator has explicitly
 *      named it via `TRUSTED_IP_HEADER` (i.e. they run behind a proxy that is
 *      known to set/overwrite it).
 *   2. For that header we take the LAST comma-separated hop — the value the
 *      trusted proxy appended — not the first, which is the client-controlled
 *      end of an `X-Forwarded-For` chain.
 *
 * With no trusted header configured we fall back to loopback: IP-keyed limits
 * become coarse (per-proxy) but the identifier-keyed limits (per-email/phone/
 * slug) that protect the sensitive flows still apply. Operators behind a proxy
 * should set `TRUSTED_IP_HEADER` to restore per-client granularity.
 */
/**
 * Whether a trusted source of the client IP is configured. When false,
 * `getClientIp()` collapses every request to loopback, so any IP-keyed rate
 * limiter becomes a single shared bucket across all clients. Callers that would
 * otherwise self-DoS on a shared bucket (e.g. the sign-in limiter, which would
 * lock out every user at once) should consult this and fall back to their
 * per-identifier limit instead. See SEC-35.
 */
export function isTrustedIpConfigured(): boolean {
  return !!process.env.TRUSTED_IP_HEADER;
}

export async function getClientIp(): Promise<string> {
  const headersList = await headers();

  const trustedHeader = process.env.TRUSTED_IP_HEADER;
  if (trustedHeader) {
    const raw = headersList.get(trustedHeader);
    if (raw) {
      const hops = raw
        .split(",")
        .map((part) => part.trim())
        .filter((part) => part.length > 0);
      if (hops.length > 0) {
        // Last hop = the address the trusted proxy observed and appended.
        return hops[hops.length - 1];
      }
    }
  }

  // No trusted source of the client IP — do not trust spoofable headers.
  return "127.0.0.1";
}
