import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

const nextConfig: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // Keep react-email packages out of the server-action bundle: @react-email/render
  // imports react-dom/server, which the App Router bundler rejects when inlined.
  serverExternalPackages: ["@react-email/render", "@react-email/components"],
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
        value: [
          "default-src 'self'",
          `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
          "style-src 'self' 'unsafe-inline'",
          "img-src 'self' data: blob:",
          "font-src 'self'",
          "connect-src 'self'",
          "frame-ancestors 'none'",
        ].join("; "),
      },
    ];

    // Only enable HSTS in real production environments (not dev and not E2E tests)
    if (!isDev && !disableHsts) {
      securityHeaders.push({
        key: "Strict-Transport-Security",
        value: "max-age=63072000; includeSubDomains; preload",
      });
    }

    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
