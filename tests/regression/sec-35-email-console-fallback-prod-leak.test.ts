// SEC-35 — Email console fallback logged live credentials in production.
//
// Bug (found 2026-07, OWASP audit [cd6748]): when no email transport was
// configured, lib/email.ts `send()` unconditionally ran
//   console.log("[email:dev]", { to, subject, html })
// The rendered `html` embeds live secrets — magic-link sign-in tokens and
// per-RSVP editTokens — plus the recipient address. Unlike the other dev-only
// fallbacks in the module, this one was NOT gated on NODE_ENV, so a production
// install that forgot to configure SMTP/Cloudflare wrote working sign-in links
// into its container logs, harvestable by anyone with log access.
//
// Fix: gate the full-payload dump to non-production; in production log only a
// generic "no transport configured" warning with no recipient or HTML.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("nodemailer", () => ({
  default: { createTransport: vi.fn().mockReturnValue({ sendMail: vi.fn(), verify: vi.fn() }) },
}));

vi.mock("@/lib/db", () => ({
  db: {
    systemConfig: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(null),
    },
  },
}));

const loadModule = () => import("@/lib/email");

describe("SEC-35: production email console fallback does not leak credentials", () => {
  beforeEach(() => {
    vi.resetModules();
    // No SMTP / Cloudflare config → send() reaches the no-transport fallback.
    delete process.env.SMTP_HOST;
    delete process.env.CLOUDFLARE_WORKER_EMAIL_URL;
    delete process.env.CLOUDFLARE_WORKER_API_SECRET;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  // Exercise the transport fallback directly via sendRenderedEmail (pre-rendered
  // HTML → send()), which is the exact code path that was gated. This avoids
  // rendering a React Email template, which fails under a stubbed production
  // JSX runtime in the test harness and is irrelevant to this fix.
  const TOKEN_HTML =
    '<a href="https://rsvp.example.com/auth/verify?token=SUPER_SECRET_TOKEN">Sign in</a>';

  it("in production, never logs the recipient or the token-bearing HTML", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const { sendRenderedEmail } = await loadModule();
    await sendRenderedEmail({ to: "victim@example.com", subject: "Sign in", html: TOKEN_HTML });

    const loggedText = [...logSpy.mock.calls, ...warnSpy.mock.calls]
      .flat()
      .map((arg) => JSON.stringify(arg ?? ""))
      .join(" ");

    expect(loggedText).not.toContain("SUPER_SECRET_TOKEN");
    expect(loggedText).not.toContain("victim@example.com");
    // A generic warning still signals the misconfiguration.
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("No email transport configured"));
    // The full-payload dev dump must not fire in production.
    expect(logSpy).not.toHaveBeenCalledWith("[email:dev]", expect.anything());

    logSpy.mockRestore();
    warnSpy.mockRestore();
  });

  it("in development, still logs the full payload for local debugging", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const { sendRenderedEmail } = await loadModule();
    await sendRenderedEmail({ to: "dev@example.com", subject: "Sign in", html: TOKEN_HTML });

    expect(logSpy).toHaveBeenCalledWith(
      "[email:dev]",
      expect.objectContaining({ to: "dev@example.com" })
    );
    logSpy.mockRestore();
  });
});
