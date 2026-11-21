/* eslint-disable @typescript-eslint/no-require-imports */
// Entry point for rehearsal steps inside sidecar containers.
//   seed | smoke <phase> [--report-only] | snapshot <file> | verify-upgrade | backdate-uploads [hours]
//   compare-exact <phase> <name> | record <phase> <ok|fail> <blocking|report> <name> [detail]
//   report
const fs = require("node:fs");
const { checker, readJson, record, snapshot, writeJson, RESULTS } = require("./common.cjs");
const { compareSnapshots } = require("./lib.cjs");

function scenario() {
  const file = process.env.REHEARSAL_SCENARIO;
  if (!file) throw new Error("REHEARSAL_SCENARIO is required");
  return require(file);
}

function report() {
  const results = fs.existsSync(RESULTS)
    ? fs
        .readFileSync(RESULTS, "utf8")
        .split("\n")
        .filter(Boolean)
        .map((line) => JSON.parse(line))
    : [];
  const lines = [
    "## Upgrade rehearsal",
    "",
    "| Phase | Check | Result | Detail |",
    "| --- | --- | --- | --- |",
  ];
  const cell = (text) => String(text).replace(/\|/g, "\\|").replace(/\n/g, " ");
  for (const result of results) {
    const status = result.ok ? "pass" : result.blocking ? "**FAIL**" : "fails (report only)";
    lines.push(
      `| ${cell(result.phase)} | ${cell(result.name)} | ${status} | ${cell(result.detail)} |`
    );
  }
  const blocking = results.filter((result) => !result.ok && result.blocking);
  lines.push(
    "",
    blocking.length
      ? `**${blocking.length} blocking check(s) failed.**`
      : `All ${results.filter((result) => result.blocking).length} blocking checks passed.`
  );
  console.log(lines.join("\n"));
  return blocking.length === 0 && results.length > 0;
}

async function main([command, ...args]) {
  switch (command) {
    case "seed":
      return scenario().seed();
    case "smoke": {
      const reportOnly = args.includes("--report-only");
      return scenario().smoke(args[0], { blocking: !reportOnly });
    }
    case "snapshot":
      writeJson(args[0], await snapshot());
      return true;
    case "verify-upgrade":
      return require("./candidate.cjs").verifyUpgrade();
    case "compare-exact": {
      const [phase, name] = args;
      const check = checker(phase);
      await check(name, async () => {
        const result = compareSnapshots(readJson("before.json"), await snapshot(), { exact: true });
        assert(result.differences.length === 0, result.differences);
        return "identical to the pre-upgrade snapshot, including migration history";
      });
      return check.allPassed();
    }
    case "backdate-uploads": {
      // No application API creates an old file. Age every upload past the
      // candidate's 24-hour grace period so the sweep must rely on references.
      const hours = Number(args[0] ?? 48);
      const when = new Date(Date.now() - hours * 60 * 60 * 1000);
      const names = fs.readdirSync("/uploads");
      for (const name of names) fs.utimesSync(`/uploads/${name}`, when, when);
      record({
        phase: "seed",
        name: `Aged every upload ${hours} hours`,
        ok: true,
        blocking: true,
        detail: `${names.length} files`,
      });
      return names.length > 0;
    }
    case "record": {
      const [phase, outcome, kind, name, detail = ""] = args;
      record({ phase, name, ok: outcome === "ok", blocking: kind === "blocking", detail });
      return true;
    }
    case "report":
      return report();
    default:
      throw new Error(`Unknown command: ${command}`);
  }
}

function assert(condition, differences) {
  if (condition) return;
  throw new Error(
    `${differences.length} differences, e.g. ${JSON.stringify(differences.slice(0, 3))}`
  );
}

main(process.argv.slice(2))
  .then((ok) => {
    process.exitCode = ok ? 0 : 1;
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 2;
  });
