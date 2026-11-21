// #918: no gate ever upgraded a real database from the previous release. The
// v2 participation-identity migration drops the vote key v1.5.0 upserts on, and
// startup converts saved credentials, so an image-only rollback became unsafe
// without any check noticing. Container QC now runs scripts/upgrade-rehearsal.sh:
// it seeds the previous release through its own code, upgrades to the candidate
// and rehearses the rollback. These tests guard its planning logic, its data
// preservation rules, and that Container QC runs it only for manual runs and
// the Release gate, leaving PR and push runs unchanged.
import { spawnSync } from "node:child_process";
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";

type Row = Record<string, unknown>;
type Snapshot = { tables: Record<string, { columns: string[]; rows: Record<string, Row> }> };
type Rule = Record<string, unknown>;
type Lib = {
  selectBaseline(tags: string[], atCandidate?: string[]): string | null;
  selectScenario(versions: string[], baseline: string): string | null;
  expectedMigrations(baseline: string[], candidate: string[]): string[];
  compareSnapshots(
    before: Snapshot,
    after: Snapshot,
    options?: { rules?: Rule[]; appliedMigrations?: string[]; exact?: boolean }
  ): { differences: Row[]; allowed: { count: number }[] };
  validateRules(rules: Rule[], migrations: string[]): string[];
  summarizeDifferences(differences: Row[]): string[];
  markdownCell(value: unknown): string;
};
const require = createRequire(import.meta.url);
const lib = require("../../scripts/upgrade-rehearsal/lib.cjs") as Lib;
const { load } = require("js-yaml") as { load: (yaml: string) => unknown };

const migrationsDir = "prisma/postgres-migrations";
const migrations = readdirSync(migrationsDir).filter((name) => /^\d{14}_/.test(name));

function table(columns: string[], rows: Row[]) {
  return {
    columns,
    rows: Object.fromEntries(rows.map((row) => [JSON.stringify([row.id]), row])),
  };
}

describe("#918 upgrade rehearsal planning", () => {
  it("rehearses from the newest earlier stable release, never the candidate's own tag", () => {
    const tags = ["v1.4.1", "v1.5.0", "v2.0.0-rc.1", "v0.9.0"];
    expect(lib.selectBaseline(tags)).toBe("v1.5.0");
    // Releasing v2.0.0 rehearses the upgrade from v1.5.0.
    expect(lib.selectBaseline([...tags, "v2.0.0"], ["v2.0.0"])).toBe("v1.5.0");
    // Valid newer versions sort numerically, not lexically.
    expect(lib.selectBaseline(["v1.9.0", "v1.10.0", "v2.0.0", "v10.0.0"])).toBe("v10.0.0");
    expect(lib.selectBaseline(["v2.0.0-rc.1", "latest", "v2.0"])).toBeNull();
  });

  it("selects the newest scenario not newer than the baseline", () => {
    expect(lib.selectScenario(["v1.5.0"], "v1.5.0")).toBe("v1.5.0");
    expect(lib.selectScenario(["v1.5.0"], "v2.3.1")).toBe("v1.5.0");
    expect(lib.selectScenario(["v1.5.0", "v2.1.0"], "v2.0.4")).toBe("v1.5.0");
    expect(lib.selectScenario(["v1.5.0", "v2.1.0"], "v2.1.0")).toBe("v2.1.0");
    expect(lib.selectScenario(["v1.5.0"], "v1.4.1")).toBeNull();
    // Every shipped scenario has a release-shaped name.
    for (const file of readdirSync("scripts/upgrade-rehearsal/scenarios")) {
      expect(file).toMatch(/^v\d+\.\d+\.\d+\.cjs$/);
    }
  });

  it("derives the new migrations and rejects a candidate that drops one", () => {
    expect(lib.expectedMigrations(["a", "b"], ["a", "b", "d", "c"])).toEqual(["c", "d"]);
    expect(() => lib.expectedMigrations(["a", "b"], ["a"])).toThrow(
      /removes baseline migrations: b/
    );
  });
});

describe("#918 data preservation", () => {
  const before: Snapshot = {
    tables: {
      PollVote: table(
        ["id", "userId", "voterName"],
        [{ id: "v1", userId: "u1", voterName: "Sam" }]
      ),
      SystemConfig: table(
        ["id", "key", "value"],
        [{ id: "c1", key: "smtp_pass", value: "legacy" }]
      ),
    },
  };
  const after: Snapshot = {
    tables: {
      PollVote: table(
        ["id", "userId", "voterName", "rsvpId"],
        [{ id: "v1", userId: null, voterName: "Sam", rsvpId: null }]
      ),
      SystemConfig: table(
        ["id", "key", "value"],
        [
          { id: "c1", key: "smtp_pass", value: "v2:converted" },
          { id: "c2", key: "config_encryption_version", value: "2" },
        ]
      ),
      Upload: table(["id"], []),
    },
  };
  const rules = [
    {
      migration: "m_identity",
      table: "PollVote",
      column: "userId",
      change: "rewrite",
      reason: "Legacy links are cleared by this migration.",
    },
    {
      startup: "config-secrets-v2",
      table: "SystemConfig",
      column: "value",
      change: "rewrite",
      rows: { key: ["smtp_pass"] },
      reason: "Startup converts saved secrets to v2.",
    },
  ];

  it("allows additions and only the declared rewrites of migrations in this upgrade", () => {
    const result = lib.compareSnapshots(before, after, {
      rules,
      appliedMigrations: ["m_identity"],
    });
    expect(result.differences).toEqual([]);
    expect(result.allowed.map((entry) => entry.count)).toEqual([1, 1]);
  });

  it("reports undeclared rewrites, rules of migrations outside the upgrade, and removals", () => {
    const outside = lib.compareSnapshots(before, after, { rules, appliedMigrations: [] });
    expect(outside.differences).toEqual([
      expect.objectContaining({ table: "PollVote", column: "userId", change: "value changed" }),
    ]);
    const removed = structuredClone(after);
    removed.tables.SystemConfig.rows = {};
    delete removed.tables.PollVote;
    expect(
      lib.compareSnapshots(before, removed, { rules, appliedMigrations: ["m_identity"] })
        .differences
    ).toEqual([
      { table: "PollVote", change: "table removed" },
      expect.objectContaining({ table: "SystemConfig", change: "row removed" }),
    ]);
    // A row outside the declared filter is never covered by it.
    const other = structuredClone(before);
    other.tables.SystemConfig.rows['["c1"]'].key = "smtp_user";
    const otherAfter = structuredClone(after);
    otherAfter.tables.SystemConfig.rows['["c1"]'].key = "smtp_user";
    expect(
      lib.compareSnapshots(other, otherAfter, { rules, appliedMigrations: ["m_identity"] })
        .differences
    ).toHaveLength(1);
  });

  it("applies the secret conversion rule only to a legacy baseline", () => {
    const modern = structuredClone(before);
    modern.tables.SystemConfig.rows['["c2"]'] = {
      id: "c2",
      key: "config_encryption_version",
      value: "2",
    };
    const result = lib.compareSnapshots(modern, after, {
      rules,
      appliedMigrations: ["m_identity"],
    });
    expect(result.differences).toEqual([
      expect.objectContaining({ table: "SystemConfig", change: "value changed" }),
    ]);
  });

  it("accepts a declared JSON extension only when every existing key is unchanged", () => {
    const preset = (snapshot: Row) => ({
      tables: {
        ThemePreset: table(["id", "originalSnapshot"], [{ id: "p1", originalSnapshot: snapshot }]),
      },
    });
    const extend = [
      {
        migration: "m_presets",
        table: "ThemePreset",
        column: "originalSnapshot",
        change: "extend-json",
        reason: "Snapshots gain a presentation key.",
      },
    ];
    const original = preset({ name: "Disco", base: "DARK" });
    const compare = (after: Row) =>
      lib.compareSnapshots(original, preset(after), {
        rules: extend,
        appliedMigrations: ["m_presets"],
      }).differences;
    expect(compare({ name: "Disco", base: "DARK", presentation: { category: "general" } })).toEqual(
      []
    );
    expect(compare({ name: "Renamed", base: "DARK", presentation: {} })).toHaveLength(1);
    expect(compare({ name: "Disco" })).toHaveLength(1);
    const summary = lib.summarizeDifferences(compare({ name: "Renamed", base: "DARK" }));
    expect(summary).toEqual([
      expect.stringMatching(/^ThemePreset\.originalSnapshot value changed ×1 \(e\.g\. /),
    ]);
  });

  it("requires restores to match exactly, including additions", () => {
    const result = lib.compareSnapshots(before, after, {
      rules,
      appliedMigrations: ["m_identity"],
      exact: true,
    });
    expect(result.differences.map((entry) => entry.change)).toEqual(
      expect.arrayContaining(["value changed", "column added", "row added", "table added"])
    );
    expect(
      lib.compareSnapshots(before, structuredClone(before), { exact: true }).differences
    ).toEqual([]);
  });

  it("declares every shipped rewrite against a real migration with a reason", () => {
    const shipped = JSON.parse(
      readFileSync("scripts/upgrade-rehearsal/expected-rewrites.json", "utf8")
    ) as Rule[];
    expect(lib.validateRules(shipped, migrations)).toEqual([]);
    expect(
      lib.validateRules(
        [{ table: "Event", change: "rewrite", migration: "missing", reason: "x" }],
        migrations
      )
    ).toHaveLength(2);
  });
});

describe("#918 job summary table", () => {
  // GitHub table cells end at a pipe that an odd run of backslashes does not escape.
  function cells(row: string) {
    const result: string[] = [];
    let current = "";
    let slashes = 0;
    for (const char of row.slice(1, -1)) {
      if (char === "|" && slashes % 2 === 0) {
        result.push(current);
        current = "";
      } else current += char;
      slashes = char === "\\" ? slashes + 1 : 0;
    }
    return [...result, current].map((cell) => cell.trim());
  }

  it.each([
    ["plain detail"],
    ["a | b"],
    ["path ends with a backslash \\"],
    ["already escaped \\| pipe"],
    ["C:\\temp\\|\\\\|x"],
    ["two\nlines\r\nand\rmore"],
  ])("keeps every check on one four-cell row: %j", (detail) => {
    const row = `| upgrade | check | **FAIL** | ${lib.markdownCell(detail)} |`;
    expect(row).not.toMatch(/[\r\n]/);
    expect(cells(row)).toHaveLength(4);
    expect(cells(row)[3].replace(/\\([\\|])/g, "$1")).toBe(detail.replace(/\r?\n|\r/g, " "));
  });
});

describe("#918 rehearsal entry point", () => {
  const fixture = mkdtempSync(join(tmpdir(), "rsvp-rehearsal-plan-"));
  afterAll(() => rmSync(fixture, { recursive: true, force: true }));

  function git(...args: string[]) {
    const result = spawnSync("git", args, { cwd: fixture, encoding: "utf8" });
    expect(result.status, result.stderr).toBe(0);
    return result.stdout.trim();
  }
  function migration(name: string) {
    mkdirSync(join(fixture, "db/migrations", name), { recursive: true });
    writeFileSync(join(fixture, "db/migrations", name, "migration.sql"), "SELECT 1;\n");
  }
  function plan(...args: string[]) {
    return spawnSync("bash", ["scripts/upgrade-rehearsal.sh", "--plan-only", ...args], {
      cwd: fixture,
      encoding: "utf8",
    });
  }

  it("resolves baseline, image, scenario and migrations from Git alone", () => {
    cpSync("scripts/upgrade-rehearsal.sh", join(fixture, "scripts/upgrade-rehearsal.sh"));
    cpSync("scripts/upgrade-rehearsal", join(fixture, "scripts/upgrade-rehearsal"), {
      recursive: true,
    });
    writeFileSync(
      join(fixture, "prisma.config.ts"),
      'export default { migrations: { path: "db/migrations" } };\n'
    );
    writeFileSync(
      join(fixture, "docker-compose.release.yml"),
      "services:\n  app:\n    image: ghcr.io/example/app:latest\n"
    );
    git("init", "-q");
    git("config", "user.email", "rehearsal@example.invalid");
    git("config", "user.name", "Rehearsal");
    migration("20260101000000_initial");
    git("add", ".");
    git("commit", "-qm", "v1.5.0");
    git("tag", "v1.5.0");
    migration("20260201000000_added");
    git("add", ".");
    git("commit", "-qm", "candidate");
    git("tag", "v1.6.0-rc.1");
    git("tag", "v1.6.0");

    const release = plan();
    expect(release.status, release.stderr).toBe(0);
    expect(release.stdout).toContain("baseline:   v1.5.0");
    expect(release.stdout).toContain("image:      ghcr.io/example/app:1.5.0");
    expect(release.stdout).toContain("scenario:   scenarios/v1.5.0.cjs");
    expect(release.stdout).toMatch(
      /migrations: 1 added since the baseline\n\s+20260201000000_added/
    );

    // Work after the release rehearses the upgrade from it.
    migration("20260301000000_later");
    git("add", ".");
    git("commit", "-qm", "later");
    const later = plan();
    expect(later.stdout).toContain("baseline:   v1.6.0");
    expect(later.stdout).toMatch(/migrations: 1 added since the baseline\n\s+20260301000000_later/);
    expect(plan("--from", "v1.5.0").stdout).toMatch(/migrations: 2 added/);

    const unknown = plan("--from", "v9.9.9");
    expect(unknown.status).toBe(2);
    expect(unknown.stderr).toContain("Unknown release tag: v9.9.9");
  });

  it("isolates every container from real providers and published ports", () => {
    const script = readFileSync("scripts/upgrade-rehearsal.sh", "utf8");
    expect(script).toContain('docker network create --internal "$prefix"');
    expect(script).not.toMatch(/\s(-p|--publish)\s/);
    expect(script).not.toMatch(/docker login|GITHUB_TOKEN/);
    const apps = script.match(/docker run[^\n]*\\\n(?:[^\n]*\\\n)*[^\n]*/g) ?? [];
    for (const command of apps.filter((entry) => entry.includes("docker run -d"))) {
      expect(command).toContain('--network "$network"');
    }
  });
});

describe("#918 the upgrade check runs only before releases", () => {
  type Step = {
    name?: string;
    if?: string;
    run?: string;
    uses?: string;
    with?: Record<string, unknown>;
    "timeout-minutes"?: number;
  };
  type Job = {
    name: string;
    "timeout-minutes": string | number;
    steps: Step[];
    strategy: { matrix: { include: { arch: string }[] } };
  };
  const workflow = load(readFileSync(".github/workflows/container-qc.yml", "utf8")) as {
    on: Record<string, unknown>;
    permissions: Record<string, string>;
    jobs: Record<string, Job>;
  };
  const release = load(readFileSync(".github/workflows/release.yml", "utf8")) as {
    on: Record<string, { types?: string[] }>;
  };
  const job = workflow.jobs.container;
  const rehearsalSteps = job.steps.filter(
    (step) => step.run?.includes("scripts/upgrade-rehearsal.sh") || step.run?.includes("--tags")
  );
  // A called workflow sees its caller's event, so the Release gate is "release".
  const runsFor = (condition: string | undefined, event: string) =>
    (condition ?? "")
      .split("||")
      .map((part) => part.trim())
      .includes(`github.event_name == '${event}'`);

  it("runs on manual runs and the Release gate, and is skipped for PRs and pushes", () => {
    expect(rehearsalSteps).toHaveLength(2);
    for (const step of rehearsalSteps) {
      expect(step.if?.split("||")).toHaveLength(2);
      expect(runsFor(step.if, "workflow_dispatch")).toBe(true);
      expect(runsFor(step.if, "release")).toBe(true);
      expect(runsFor(step.if, "pull_request")).toBe(false);
      expect(runsFor(step.if, "push")).toBe(false);
    }
    expect(release.on.release.types).toEqual(["published"]);
    expect(workflow.on).toHaveProperty("workflow_dispatch");
  });

  it("keeps PR and push runs as before: same checks, shallow checkout, original timeout", () => {
    expect(Object.keys(workflow.jobs)).toEqual(["container"]);
    expect(job.name).toBe("Container (${{ matrix.arch }})");
    expect(job.strategy.matrix.include.map((row) => row.arch)).toEqual(["amd64", "arm64"]);
    const checkout = job.steps.find((step) => step.uses?.startsWith("actions/checkout@"));
    expect(checkout?.with).toEqual({ "persist-credentials": false });
    expect(String(job["timeout-minutes"])).toMatch(/&& 60 \|\| 35 }}$/);
    expect(String(job["timeout-minutes"])).toContain(rehearsalSteps[1].if);
  });

  it("fetches tags, then rehearses the built image, without registry login", () => {
    const [fetch, rehearsal] = rehearsalSteps;
    const steps = job.steps;
    expect(steps.indexOf(fetch)).toBeGreaterThan(
      steps.findIndex((step) => step.name === "Build candidate image")
    );
    expect(steps.indexOf(rehearsal)).toBe(steps.indexOf(fetch) + 1);
    expect(fetch.run).toContain("--unshallow --tags origin");
    expect(rehearsal.run).toContain("--to-image rsvp-container-qc:local");
    expect(rehearsal["timeout-minutes"]).toBeGreaterThan(0);
    expect(workflow.permissions).toEqual({ contents: "read" });
    expect(steps.some((step) => step.uses?.startsWith("docker/login-action"))).toBe(false);
  });
});
