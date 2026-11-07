import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { buildContentSecurityPolicy } from "./lib/csp";

const isDev = process.env.NODE_ENV === "development";

const nextConfig: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR || ".next",
  async headers() {
    const disableHsts =
      process.env.DISABLE_HSTS === "true" ||
      process.env.PLAYWRIGHT_BASE_URL !== undefined ||
      process.env.CI !== undefined;

    const securityHeaders = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "SAMEORIGIN" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
      {
        key: "Content-Security-Policy",
        value: buildContentSecurityPolicy({ isDev }),
      },
    ];

    // Only enable HSTS in real production environments (not dev and not E2E tests)
    if (!isDev && !disableHsts) {
      securityHeaders.push({
        key: "Strict-Transport-Security",
        value: "max-age=63072000; includeSubDomains; preload",
      });
    }

    const downloadHeaders = [{ key: "Cache-Control", value: "private, no-store" }];
    const downloadPaths = [
      "/e/:slug/guests.csv",
      "/e/:slug/calendar.ics",
      "/api/admin/backups/:filename",
    ];

    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
      ...downloadPaths.map((source) => ({ source, headers: downloadHeaders })),
      {
        source: "/e/:slug/notifications",
        headers: [...downloadHeaders, { key: "Referrer-Policy", value: "no-referrer" }],
      },
      // #825: effect library art lives under a pinned version directory
      // (public/effects/library/<collection>/<version>/), so a file never
      // changes in place; a new version is a new path.
      {
        source: "/effects/library/:collection/:version/:file",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
    ];
  },
};

export default createNextIntlPlugin()(nextConfig);
