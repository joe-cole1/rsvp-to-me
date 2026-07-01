// SEC-25 / H-4 — docker-compose shipped weak default credentials and exposed
// DB/Redis ports on the host.
//
// Bug (found 2026-07, security review): every compose file fell back to the
// publicly-known literals `postgres_password_here` / `redis_password_placeholder`
// when POSTGRES_PASSWORD / REDIS_PASSWORD were unset, and docker-compose.yml
// additionally published PostgreSQL on host port 5432. `docker compose up` on a
// cloud VM with a public IP therefore produced a directly reachable database
// with a known password.
//
// Fix: all compose files use the `${VAR:?message}` interpolation form so
// compose fails fast when the secrets are missing, and no compose file maps
// PostgreSQL (5432) or Redis (6379) to a host port. This test inspects the
// compose files on disk so any reintroduction of a `:-` fallback for the two
// secrets, or of a host port mapping for the datastores, fails CI.

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

const REPO_ROOT = join(__dirname, "..", "..");

const COMPOSE_FILES = [
  "docker-compose.yml",
  "docker-compose.release.yml",
  "docker-compose.dev.yml",
  "docker-compose.postgres.yml",
];

function composeContents(): Array<{ file: string; content: string }> {
  return COMPOSE_FILES.filter((f) => existsSync(join(REPO_ROOT, f))).map((f) => ({
    file: f,
    content: readFileSync(join(REPO_ROOT, f), "utf8"),
  }));
}

describe("SEC-25: compose files require real secrets and hide datastore ports", () => {
  it("finds the compose files it is guarding", () => {
    expect(composeContents().length).toBeGreaterThanOrEqual(3);
  });

  it("contains no weak literal credential fallbacks", () => {
    for (const { file, content } of composeContents()) {
      expect(content, `${file} still contains a default Postgres password`).not.toContain(
        "postgres_password_here"
      );
      expect(content, `${file} still contains a default Redis password`).not.toContain(
        "redis_password_placeholder"
      );
      // No `${POSTGRES_PASSWORD:-...}` / `${REDIS_PASSWORD:-...}` default form at all.
      expect(content, `${file} uses a :- default for a secret`).not.toMatch(
        /\$\{(POSTGRES_PASSWORD|REDIS_PASSWORD):-/
      );
    }
  });

  it("requires POSTGRES_PASSWORD and REDIS_PASSWORD via the :? fail-fast form", () => {
    for (const { file, content } of composeContents()) {
      if (content.includes("${POSTGRES_PASSWORD")) {
        expect(content, `${file} must use \${POSTGRES_PASSWORD:?...}`).toMatch(
          /\$\{POSTGRES_PASSWORD:\?/
        );
      }
      if (content.includes("${REDIS_PASSWORD")) {
        expect(content, `${file} must use \${REDIS_PASSWORD:?...}`).toMatch(
          /\$\{REDIS_PASSWORD:\?/
        );
      }
    }
  });

  it("never publishes PostgreSQL (5432) or Redis (6379) on a host port", () => {
    for (const { file, content } of composeContents()) {
      // A host mapping looks like `- "5432:5432"` (quoted or not) in a ports: list.
      expect(content, `${file} maps Postgres to a host port`).not.toMatch(/-\s*"?\d+:5432"?/);
      expect(content, `${file} maps Redis to a host port`).not.toMatch(/-\s*"?\d+:6379"?/);
    }
  });
});
