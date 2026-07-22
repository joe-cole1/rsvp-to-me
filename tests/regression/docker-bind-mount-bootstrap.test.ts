// Root cause (found 2026-07): switching the production image from root to a
// fixed UID made existing Linux bind mounts and newly auto-created ./data
// directories unwritable. Pre-migration backups then failed before startup.

import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const REPO_ROOT = join(__dirname, "..", "..");
const dockerfile = readFileSync(join(REPO_ROOT, "Dockerfile"), "utf8");
const entrypoint = readFileSync(join(REPO_ROOT, "scripts", "docker-entrypoint.sh"), "utf8");
const composeFiles = ["docker-compose.yml", "docker-compose.dev.yml", "docker-compose.release.yml"];

describe("Docker bind-mount bootstrap", () => {
  it("repairs only uploads and backups before dropping privileges", () => {
    expect(entrypoint).toContain("data_dir=/app/data");
    expect(entrypoint).toContain("uploads_dir=$data_dir/uploads");
    expect(entrypoint).toContain("backups_dir=$data_dir/backups");
    expect(entrypoint).toContain('mkdir -p "$uploads_dir" "$backups_dir/pre-migration"');
    expect(entrypoint).toContain('for managed_dir in "$uploads_dir" "$backups_dir"; do');
    expect(entrypoint).toMatch(/find "\$managed_dir" -xdev/);
    expect(entrypoint).not.toMatch(/find "\$data_dir"(?:\s|$)/);
    expect(entrypoint).toContain('-exec chown -h "$app_user:$app_group"');
    expect(entrypoint).not.toMatch(/chown[^\n]+\/(?:etc|usr|var|app)(?:\s|["'])/);

    const ownershipRepair = entrypoint.indexOf('-exec chown -h "$app_user:$app_group"');
    const privilegeDrop = entrypoint.indexOf('exec su-exec "$app_user:$app_group" "$@"');
    expect(ownershipRepair).toBeGreaterThan(-1);
    expect(privilegeDrop).toBeGreaterThan(ownershipRepair);
  });

  it("never includes PostgreSQL or Redis siblings in the ownership allowlist", () => {
    const siblingLayout = ["pg_data", "redis_data", "uploads", "backups"];
    const ownershipRoots = [
      ...entrypoint.matchAll(/^(uploads|backups)_dir=\$data_dir\/(\w+)$/gm),
    ].map(([, , directory]) => directory);

    expect(ownershipRoots).toEqual(["uploads", "backups"]);
    expect(siblingLayout.filter((directory) => ownershipRoots.includes(directory))).toEqual([
      "uploads",
      "backups",
    ]);
    expect(entrypoint).not.toMatch(/(?:pg_data|redis_data)/);
  });

  it("fails clearly if the application account still cannot write", () => {
    expect(entrypoint).toContain(
      "[entrypoint] Upload and backup storage must be writable by UID/GID 10001:10001."
    );
    expect(entrypoint).toMatch(/test -w "\$1" && test -w "\$2\/pre-migration"/);
    expect(entrypoint).toMatch(/\n\s*exit 1\n/);
  });

  it.each(composeFiles)("mounts only application-owned data paths in %s", (filename) => {
    const compose = readFileSync(join(REPO_ROOT, filename), "utf8");

    expect(compose).toContain("- ./data/uploads:/app/data/uploads");
    expect(compose).toContain("- ./data/backups:/app/data/backups");
    expect(compose).not.toMatch(/- \.\/data:\/app\/data(?:\s|$)/);
    expect(compose).toContain("- ./pg_data:/var/lib/postgresql");
    expect(compose).toContain("- ./redis_data:/data");
  });

  it.each(composeFiles)("waits for authenticated Redis health in %s", (filename) => {
    const compose = readFileSync(join(REPO_ROOT, filename), "utf8");

    expect(compose).toContain("image: redis:8-alpine");
    expect(compose).toContain('REDISCLI_AUTH="$$REDIS_PASSWORD" redis-cli ping | grep -q PONG');
    expect(compose).toMatch(/redis:\n\s+condition: service_healthy/);
  });

  it("installs and invokes the entrypoint in the production image", () => {
    expect(dockerfile).toMatch(/apk add --no-cache[^\n]*\bsu-exec\b/);
    expect(dockerfile).toMatch(/chmod 0555 \/app\/scripts\/docker-entrypoint\.sh/);
    expect(dockerfile).toMatch(/^USER 0:0$/m);
    expect(dockerfile).toMatch(/^ENTRYPOINT \["\/app\/scripts\/docker-entrypoint\.sh"\]$/m);
  });
});
