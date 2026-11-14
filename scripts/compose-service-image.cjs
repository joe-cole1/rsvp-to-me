#!/usr/bin/env node
// Resolve deployment images without loading .env values or the WSL override.
/* eslint-disable @typescript-eslint/no-require-imports -- Plain Node CLI, matching the other CJS scripts. */
const { execFileSync } = require("node:child_process");
const path = require("node:path");

const service = process.argv[2];
if (!service || process.argv.length !== 3) {
  console.error("usage: node scripts/compose-service-image.cjs <service>");
  process.exit(1);
}

try {
  const config = JSON.parse(
    execFileSync(
      "docker",
      [
        "compose",
        "-f",
        "docker-compose.yml",
        "config",
        "--no-interpolate",
        "--no-env-resolution",
        "--format",
        "json",
      ],
      { cwd: path.resolve(__dirname, ".."), encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }
    )
  );
  const image = config.services?.[service]?.image;
  if (typeof image !== "string" || !image || /\s|\$/.test(image)) {
    throw new Error("Missing or unresolved image");
  }
  console.log(image);
} catch {
  // Compose output may contain environment configuration; never echo it here.
  console.error(`Could not resolve the deployment image for service ${service}.`);
  process.exit(1);
}
