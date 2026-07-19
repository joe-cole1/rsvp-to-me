import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    ".next-e2e/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "coverage/**",
    "pg_data/**",
    "redis_data/**",
  ]),
  // React Email renders complete email-client HTML. These Next.js application
  // rules do not apply to its required document <head> and raw <img> markup.
  {
    files: ["emails/**/*.tsx"],
    rules: {
      "@next/next/no-head-element": "off",
      "@next/next/no-img-element": "off",
    },
  },
]);

export default eslintConfig;
