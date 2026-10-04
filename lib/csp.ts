const CLOUDFLARE_SCRIPT_SOURCE = "https://challenges.cloudflare.com";

export function buildContentSecurityPolicy({
  nonce,
  isDev = process.env.NODE_ENV === "development",
}: {
  nonce?: string;
  isDev?: boolean;
} = {}): string {
  const scriptSources = ["'self'"];

  if (nonce) {
    scriptSources.push(`'nonce-${nonce}'`, "'strict-dynamic'");
  }

  scriptSources.push(CLOUDFLARE_SCRIPT_SOURCE);

  if (isDev) {
    scriptSources.push("'unsafe-eval'");
  }

  return [
    "default-src 'self'",
    "base-uri 'self'",
    `script-src ${scriptSources.join(" ")}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "connect-src 'self'",
    "frame-src https://challenges.cloudflare.com",
    "frame-ancestors 'none'",
  ].join("; ");
}
