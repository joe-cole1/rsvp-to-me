// SEC-9 / issue #327 — the application allowed arbitrary inline scripts through
// `script-src 'unsafe-inline'`, so an injected script could execute in every
// rendered page.
//
// Fix: build the policy in one shared module, generate a fresh request nonce in
// Proxy, and forward that same nonce-bearing policy into Next.js rendering and
// the browser response. API and Next internals keep the safe fallback policy.

import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import nextConfig from "../../next.config";
import { buildContentSecurityPolicy } from "../../lib/csp";
import { config as proxyConfig, proxy } from "../../proxy";

function makeRequest(pathname = "/", headers?: Record<string, string>): NextRequest {
  return new NextRequest(`http://localhost:3000${pathname}`, { headers });
}

describe("SEC-9 / issue #327: script CSP nonce enforcement", () => {
  it("keeps the next.config fallback CSP free of unsafe-inline", async () => {
    const headers = await nextConfig.headers?.();
    const csp = headers
      ?.flatMap((entry) => entry.headers)
      .find((header) => header.key === "Content-Security-Policy")?.value;

    expect(csp).toBe(buildContentSecurityPolicy({ isDev: false }));
    expect(csp).toContain("script-src 'self' https://challenges.cloudflare.com");
    expect(csp).not.toContain("script-src 'unsafe-inline'");
    expect(csp).not.toContain("'strict-dynamic'");
    expect(csp).not.toContain("'unsafe-eval'");
    expect(csp).toContain("style-src 'self' 'unsafe-inline'");
    expect(csp).toContain("base-uri 'self'");
  });

  it("adds strict-dynamic and development eval only to nonce policies", () => {
    const nonce = "nonce-for-sec-9";
    const productionPolicy = buildContentSecurityPolicy({ nonce, isDev: false });
    const developmentPolicy = buildContentSecurityPolicy({ nonce, isDev: true });

    expect(productionPolicy).toContain(`script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`);
    expect(productionPolicy).toContain("https://challenges.cloudflare.com");
    expect(
      productionPolicy.split("; ").find((directive) => directive.startsWith("script-src"))
    ).not.toContain("'unsafe-inline'");
    expect(productionPolicy).not.toContain("'unsafe-eval'");
    expect(developmentPolicy).toContain("'unsafe-eval'");
    expect(productionPolicy).toContain("base-uri 'self'");
    expect(developmentPolicy).toContain("base-uri 'self'");
  });

  it("overwrites hostile CSP and nonce headers and forwards one fresh nonce", () => {
    const response = proxy(
      makeRequest("/dashboard", {
        "x-nonce": "attacker-controlled-nonce",
        "content-security-policy": "script-src 'unsafe-inline'",
      })
    );
    const nonce = response.headers.get("x-middleware-request-x-nonce");
    const csp = response.headers.get("content-security-policy");

    expect(nonce).toBeTruthy();
    expect(nonce).not.toBe("attacker-controlled-nonce");
    expect(csp).toBe(buildContentSecurityPolicy({ nonce: nonce!, isDev: false }));
    expect(csp?.split("; ").find((directive) => directive.startsWith("script-src"))).not.toContain(
      "'unsafe-inline'"
    );
    expect(response.headers.get("x-middleware-request-content-security-policy")).toBe(csp);
    expect(response.headers.get("x-middleware-override-headers")).toContain("x-nonce");
    expect(response.headers.get("x-middleware-override-headers")).toContain(
      "content-security-policy"
    );
  });

  it("generates a distinct nonce for each request", () => {
    const first = proxy(makeRequest("/"));
    const second = proxy(makeRequest("/"));

    const firstNonce = first.headers.get("x-middleware-request-x-nonce");
    const secondNonce = second.headers.get("x-middleware-request-x-nonce");

    expect(firstNonce).toBeTruthy();
    expect(secondNonce).toBeTruthy();
    expect(secondNonce).not.toBe(firstNonce);
  });

  it("matches document paths by segment and never uses client prefetch headers as a bypass", () => {
    const matches = (url: string, headers?: Record<string, string>) =>
      unstable_doesMiddlewareMatch({ config: proxyConfig, url, headers });

    expect(matches("/api")).toBe(false);
    expect(matches("/api/health")).toBe(false);
    expect(matches("/_next/static/chunk.js")).toBe(false);
    expect(matches("/apiary")).toBe(true);
    expect(matches("/_nextish")).toBe(true);
    expect(matches("/public/page.html")).toBe(true);
    expect(
      matches("/dashboard", {
        "next-router-prefetch": "1",
        purpose: "prefetch",
      })
    ).toBe(true);

    const response = proxy(
      makeRequest("/dashboard", {
        "next-router-prefetch": "1",
        purpose: "prefetch",
      })
    );
    expect(response.headers.get("content-security-policy")).toContain("'strict-dynamic'");
  });
});
