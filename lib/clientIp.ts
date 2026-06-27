import { headers } from "next/headers";

/**
 * Resolve the client IP from request headers for rate-limiting / abuse
 * controls. Honors an operator-configured `TRUSTED_IP_HEADER` first, then
 * common proxy headers, falling back to localhost. Shared by auth and
 * event-password rate limiting so the trusted-header precedence stays
 * consistent across the app.
 */
export async function getClientIp(): Promise<string> {
  const headersList = await headers();

  const trustedHeader = process.env.TRUSTED_IP_HEADER;
  if (trustedHeader) {
    const ip = headersList.get(trustedHeader);
    if (ip) {
      return ip.split(",")[0].trim();
    }
  }

  const cfConnectingIp = headersList.get("cf-connecting-ip");
  if (cfConnectingIp) {
    return cfConnectingIp.trim();
  }

  const xRealIp = headersList.get("x-real-ip");
  if (xRealIp) {
    return xRealIp.trim();
  }

  const xForwardedFor = headersList.get("x-forwarded-for");
  if (xForwardedFor) {
    return xForwardedFor.split(",")[0].trim();
  }

  return "127.0.0.1";
}
