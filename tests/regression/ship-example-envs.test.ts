// #877 shipping blocker: the environment-file guard also matched public example
// templates. Permit only example filenames; keep real env files blocking in both modes.
import { rmSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createShipFixture, shipBranch, type ShipFixture } from "@/tests/helpers/ship-fixture";

let fixture: ShipFixture;
beforeEach(() => {
  fixture = createShipFixture();
});
afterEach(() => {
  if (fixture) rmSync(fixture.directory, { recursive: true, force: true });
});

function ship(files: string[], committed: boolean) {
  if (committed) {
    fixture.git(["add", "--", "reviewed.txt", ...files]);
    fixture.git(["commit", "-m", "reviewed example configuration"]);
    return fixture.ship({ options: ["--committed", "--pr-handoff"], files: null });
  }
  return fixture.ship({ files: ["reviewed.txt", ...files] });
}

describe.each([false, true])("public env examples with committed=%s", (committed) => {
  it.each([
    ".env.example",
    ".env.local.example",
    "worker/.env.example",
    "config/.env.production.example",
  ])("ships reviewed template %s", (file) => {
    fixture.write(file, "EXAMPLE_PLACEHOLDER=replace-me\n");
    const result = ship([file], committed);
    expect(result.status, result.output).toBe(0);
    const head = fixture.git(["rev-parse", "HEAD"]);
    expect(
      fixture.git(["--git-dir", fixture.origin, "rev-parse", `refs/heads/${shipBranch}`])
    ).toBe(head);
    expect(fixture.git(["show", `HEAD:${file}`])).toBe("EXAMPLE_PLACEHOLDER=replace-me");
  });

  it.each([
    ".env",
    ".env.local",
    ".env.production",
    "worker/.env",
    ".env.example.local",
    ".env.example.bak",
    "config/.env.production.example.backup",
  ])("still blocks environment file %s alongside an example", (file) => {
    fixture.write(".env.example", "EXAMPLE_PLACEHOLDER=replace-me\n");
    fixture.write(file, "PRIVATE_PLACEHOLDER=fixture-only\n");
    const before = fixture.git(["rev-parse", "HEAD"]);
    const result = ship([".env.example", file], committed);
    expect(result.status).toBe(1);
    expect(result.output).toContain("A .env file is staged");
    expect(fixture.git(["ls-remote", "--heads", "origin", shipBranch])).toBe("");
    if (!committed) expect(fixture.git(["rev-parse", "HEAD"])).toBe(before);
  });
});
