// Regression test (task abad2cf6): ship.sh used the whole commit message as the PR title.
//
// Found: 2026-11-12 on PRs #859 and #860, which each needed `gh pr edit --title`.
// Root cause: scripts/ship.sh passed "$MSG" to `gh pr create --title` (and printed
// it as the handoff title). Commit messages carry a body and a Co-Authored-By
// trailer, so the PR title became the subject, the body and the trailer. The PR
// title is now the message's first line; the commit keeps the full message.

import { rmSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createShipFixture, type ShipFixture } from "@/tests/helpers/ship-fixture";

const subject = "[abad2cf6] chore(scripts): ship with a body";
const multiLine = `${subject}\n\nWhy the change was needed.\n\nCo-Authored-By: Someone <someone@example.invalid>`;

let fixture: ShipFixture;

beforeEach(() => {
  fixture = createShipFixture();
});

afterEach(() => {
  if (fixture) rmSync(fixture.directory, { recursive: true, force: true });
});

describe("ship.sh PR title", () => {
  it("uses only the subject line for gh pr create, and keeps the full commit message", () => {
    fixture.installGh("new");
    const result = fixture.ship({ message: multiLine, options: ["--fast"] });
    expect(result.status, result.output).toBe(0);

    const create = fixture.ghCalls().find((call) => call[1] === "create") ?? [];
    expect(create[create.indexOf("--title") + 1]).toBe(subject);
    expect(fixture.git(["log", "-1", "--format=%B"])).toBe(multiLine);
  });

  it("prints only the subject as the handoff title", () => {
    const result = fixture.ship({ message: multiLine });
    expect(result.status, result.output).toBe(0);
    expect(result.output).toContain(`Title: ${subject}\n`);
    expect(result.output).not.toContain("Co-Authored-By: Someone");
  });
});
