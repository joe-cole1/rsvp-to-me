// Docker runtime hardening — the production image ran as UID 0, used floating
// base tags, shipped an unused download client, persisted build-only connection
// placeholders, and deployed the same Prisma migration twice on every start.
//
// Root cause (found 2026-07): the Dockerfile had grown around deployment
// convenience without a regression guard for image identity, least privilege,
// build-context exclusions, or the startup command.

import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const REPO_ROOT = join(__dirname, "..", "..");
const dockerfile = readFileSync(join(REPO_ROOT, "Dockerfile"), "utf8");
const dockerignore = readFileSync(join(REPO_ROOT, ".dockerignore"), "utf8");
const entrypoint = readFileSync(join(REPO_ROOT, "scripts", "docker-entrypoint.sh"), "utf8");
const runner = dockerfile.split(/FROM\s+\$\{NODE_IMAGE\}\s+AS\s+runner/)[1] ?? "";

describe("Docker production image hardening", () => {
  it("pins every build stage to one exact multi-architecture Node image", () => {
    expect(dockerfile).toMatch(/^ARG NODE_IMAGE=node:22\.23\.1-alpine3\.24@sha256:[a-f0-9]{64}$/m);
    expect(dockerfile.match(/^FROM \$\{NODE_IMAGE\} AS \w+$/gm)).toHaveLength(3);
    expect(dockerfile).not.toMatch(/^FROM\s+node:[^@\s]+\s/m);
  });

  it("drops the final application to the fixed non-root account", () => {
    expect(runner).toMatch(/addgroup --system --gid 10001 nodejs/);
    expect(runner).toMatch(/adduser --system --uid 10001 --ingroup nodejs nextjs/);
    expect(runner).toMatch(/^USER 0:0$/m);
    expect(runner).toMatch(/^ENTRYPOINT \["\/app\/scripts\/docker-entrypoint\.sh"\]$/m);
    expect(entrypoint).toMatch(/exec su-exec "\$app_user:\$app_group" "\$@"/);
    expect(runner).toMatch(
      /CMD \["su-exec", "nextjs:nodejs", "node", "-e", "fetch\('http:\/\/127\.0\.0\.1:3000\/api\/health'/
    );
  });

  it("keeps required backup tooling but removes the unused download client", () => {
    const apkInstruction = runner.match(/RUN apk add --no-cache[^\n]*/)?.[0] ?? "";
    expect(apkInstruction).toContain("postgresql-client");
    expect(apkInstruction).toContain("su-exec");
    expect(apkInstruction).not.toMatch(/\bcurl\b/);
  });

  it("scopes build placeholders to the build instruction", () => {
    expect(dockerfile).not.toMatch(/^ENV (DATABASE_URL|REDIS_URL)=/m);
    expect(dockerfile).toMatch(/RUN DATABASE_URL=postgresql:\/\/build-placeholder/);
    expect(dockerfile).toMatch(/REDIS_URL=redis:\/\/build-placeholder/);
  });

  it("deploys migrations once and execs the long-running process", () => {
    const command = runner.match(/^CMD \[.*$/m)?.[0] ?? "";
    expect(command).toContain("node scripts/migrate-db.js");
    expect(command).not.toContain("prisma migrate deploy");
    expect(command).toContain("exec ./node_modules/.bin/next start");
  });

  it("excludes local secrets, generated output, and persistent data from builds", () => {
    for (const path of [
      ".env*",
      ".next*",
      "node_modules",
      "data/",
      "pg_data/",
      "redis_data/",
      "coverage/",
      "playwright-report/",
    ]) {
      expect(dockerignore.split("\n"), `.dockerignore must contain ${path}`).toContain(path);
    }
  });
});
