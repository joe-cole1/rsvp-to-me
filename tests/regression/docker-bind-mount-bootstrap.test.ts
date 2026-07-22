// Root cause (found 2026-07): switching the production image from root to a
// fixed UID made existing Linux bind mounts and newly auto-created ./data
// directories unwritable. Pre-migration backups then failed before startup.

import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const REPO_ROOT = join(__dirname, "..", "..");
const dockerfile = readFileSync(join(REPO_ROOT, "Dockerfile"), "utf8");
const entrypoint = readFileSync(join(REPO_ROOT, "scripts", "docker-entrypoint.sh"), "utf8");

describe("Docker bind-mount bootstrap", () => {
  it("repairs only the application data tree before dropping privileges", () => {
    expect(entrypoint).toContain("data_dir=/app/data");
    expect(entrypoint).toContain('mkdir -p "$data_dir/uploads" "$data_dir/backups/pre-migration"');
    expect(entrypoint).toMatch(/find "\$data_dir" -xdev/);
    expect(entrypoint).toContain('-exec chown -h "$app_user:$app_group"');
    expect(entrypoint).not.toMatch(/chown[^\n]+\/(?:etc|usr|var|app)(?:\s|["'])/);

    const ownershipRepair = entrypoint.indexOf('-exec chown -h "$app_user:$app_group"');
    const privilegeDrop = entrypoint.indexOf('exec su-exec "$app_user:$app_group" "$@"');
    expect(ownershipRepair).toBeGreaterThan(-1);
    expect(privilegeDrop).toBeGreaterThan(ownershipRepair);
  });

  it("fails clearly if the application account still cannot write", () => {
    expect(entrypoint).toContain("[entrypoint] $data_dir is not writable by UID/GID 10001:10001.");
    expect(entrypoint).toMatch(/test -w "\$1\/backups\/pre-migration"/);
    expect(entrypoint).toMatch(/\n\s*exit 1\n/);
  });

  it("installs and invokes the entrypoint in the production image", () => {
    expect(dockerfile).toMatch(/apk add --no-cache[^\n]*\bsu-exec\b/);
    expect(dockerfile).toMatch(/chmod 0555 \/app\/scripts\/docker-entrypoint\.sh/);
    expect(dockerfile).toMatch(/^USER 0:0$/m);
    expect(dockerfile).toMatch(/^ENTRYPOINT \["\/app\/scripts\/docker-entrypoint\.sh"\]$/m);
  });
});
