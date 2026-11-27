// Pure upgrade-rehearsal logic, shared by the container scripts and unit tests.
// No I/O and no application imports, so any Node version can load it.

const STABLE_TAG = /^v(\d+)\.(\d+)\.(\d+)$/;

function parseStableTag(tag) {
  const match = STABLE_TAG.exec(String(tag).trim());
  return match ? match.slice(1).map(Number) : null;
}

function compareVersions(a, b) {
  for (let index = 0; index < 3; index++) if (a[index] !== b[index]) return a[index] - b[index];
  return 0;
}

/**
 * The default baseline: the newest stable release reachable from the candidate,
 * excluding tags on the candidate commit itself (a release rehearses the upgrade
 * from the previous release, not from itself). Prereleases are never baselines.
 */
function selectBaseline(reachableTags, tagsAtCandidate = []) {
  const excluded = new Set(tagsAtCandidate.map((tag) => tag.trim()));
  return (
    reachableTags
      .map((tag) => tag.trim())
      .filter((tag) => !excluded.has(tag) && parseStableTag(tag))
      .sort((a, b) => compareVersions(parseStableTag(b), parseStableTag(a)))[0] ?? null
  );
}

/** The newest scenario whose version is not newer than the baseline release. */
function selectScenario(scenarioVersions, baselineTag) {
  const baseline = parseStableTag(baselineTag);
  if (!baseline) return null;
  return (
    scenarioVersions
      .filter((version) => parseStableTag(version))
      .filter((version) => compareVersions(parseStableTag(version), baseline) <= 0)
      .sort((a, b) => compareVersions(parseStableTag(b), parseStableTag(a)))[0] ?? null
  );
}

/** Migrations the candidate adds; the candidate must keep every baseline migration. */
function expectedMigrations(baselineMigrations, candidateMigrations) {
  const candidate = new Set(candidateMigrations);
  const missing = baselineMigrations.filter((name) => !candidate.has(name));
  if (missing.length) {
    throw new Error(`Candidate removes baseline migrations: ${missing.join(", ")}`);
  }
  const baseline = new Set(baselineMigrations);
  return [...candidate].filter((name) => !baseline.has(name)).sort();
}

function stable(value) {
  return JSON.stringify(value);
}

function ruleApplies(rule, context) {
  if (rule.migration) return context.appliedMigrations.includes(rule.migration);
  if (rule.startup === "config-secrets-v2") return context.legacySecrets;
  if (rule.startup === "upload-sweep") return context.sweptUploadFilenames.length > 0;
  return false;
}

function rowMatches(rule, row, context) {
  if (
    rule.rows &&
    !Object.entries(rule.rows).every(([column, values]) => values.includes(row?.[column]))
  ) {
    return false;
  }
  if (rule.startup === "upload-sweep") {
    return context.sweptUploadFilenames.includes(row?.filename);
  }
  return true;
}

// An object that keeps every existing key unchanged and only adds keys.
function isJsonExtension(before, after) {
  const object = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
  return (
    object(before) &&
    object(after) &&
    Object.entries(before).every(([key, value]) => stable(after[key]) === stable(value))
  );
}

function permitted(rules, context, table, kind, column, row) {
  return rules.find(
    (rule) =>
      rule.table === table &&
      rule.change === kind &&
      (rule.column === undefined || rule.column === column) &&
      rowMatches(rule, row, context) &&
      ruleApplies(rule, context)
  );
}

/** True when the baseline stored provider secrets before versioned encryption. */
function hasLegacySecrets(snapshot) {
  const rows = snapshot.tables?.SystemConfig?.rows ?? {};
  return !Object.values(rows).some(
    (row) => row.key === "config_encryption_version" && row.value === "2"
  );
}

/**
 * Picks the first snapshot file added by the candidate with `prefix`, ignoring
 * snapshots already written during baseline startup or earlier runs.
 */
function selectNewSnapshot(beforeFiles, afterFiles, prefix) {
  const existing = new Set(beforeFiles);
  return (
    afterFiles.filter((name) => name.startsWith(prefix) && !existing.has(name)).sort()[0] ?? null
  );
}

/** Parses the completed `[config-secrets] migrate:` summary line from startup logs. */
function parseSecretMigrationLog(logText) {
  const match = /\[config-secrets\] migrate: (\d+) converted, (\d+) verified; v2 ready\./.exec(
    String(logText ?? "")
  );
  if (!match) return null;
  return { converted: Number(match[1]), verified: Number(match[2]), line: match[0] };
}

/** Expected secret migration behavior for legacy (`v1.5.0`) vs v2 (`v2.0.0+`) baselines. */
function secretMigrationExpectations(beforeSnapshot, secretCount) {
  const legacy = hasLegacySecrets(beforeSnapshot);
  return legacy
    ? {
        legacy: true,
        expectSecretsBackup: true,
        expectedConverted: secretCount,
        expectedVerified: 0,
      }
    : {
        legacy: false,
        expectSecretsBackup: false,
        expectedConverted: 0,
        expectedVerified: secretCount,
      };
}

/**
 * Compares two database snapshots ({ tables: { name: { columns, rows: { key: row } } } }).
 * Upgrade mode allows additions (tables, columns, rows) and only the declared
 * rewrites of migrations in this upgrade. Exact mode (restores) allows nothing.
 */
function compareSnapshots(before, after, options = {}) {
  const exact = options.exact === true;
  const rules = exact ? [] : (options.rules ?? []);
  const context = {
    appliedMigrations: options.appliedMigrations ?? [],
    legacySecrets: hasLegacySecrets(before),
    sweptUploadFilenames: options.sweptUploadFilenames ?? [],
  };
  const ignored = new Set(exact ? [] : (options.ignoreTables ?? ["_prisma_migrations"]));
  const differences = [];
  const allowed = new Map();
  const note = (rule, entry) => {
    const key = `${rule.table}.${rule.column ?? "*"} ${rule.change}`;
    const current = allowed.get(key) ?? { rule, count: 0 };
    current.count += 1;
    current.example ??= entry;
    allowed.set(key, current);
  };

  for (const [table, beforeTable] of Object.entries(before.tables)) {
    if (ignored.has(table)) continue;
    const afterTable = after.tables[table];
    if (!afterTable) {
      const rule = permitted(rules, context, table, "drop-table");
      if (rule) note(rule, { table });
      else differences.push({ table, change: "table removed" });
      continue;
    }
    const keptColumns = [];
    for (const column of beforeTable.columns) {
      if (afterTable.columns.includes(column)) keptColumns.push(column);
      else {
        const rule = permitted(rules, context, table, "drop-column", column);
        if (rule) note(rule, { table, column });
        else differences.push({ table, column, change: "column removed" });
      }
    }
    for (const [key, row] of Object.entries(beforeTable.rows)) {
      const next = afterTable.rows[key];
      if (!next) {
        const rule = permitted(rules, context, table, "delete-row", undefined, row);
        if (rule) note(rule, { table, key });
        else differences.push({ table, key, change: "row removed" });
        continue;
      }
      for (const column of keptColumns) {
        if (stable(row[column]) === stable(next[column])) continue;
        const rule =
          permitted(rules, context, table, "rewrite", column, row) ??
          (isJsonExtension(row[column], next[column])
            ? permitted(rules, context, table, "extend-json", column, row)
            : undefined);
        if (rule) note(rule, { table, key, column });
        else
          differences.push({
            table,
            key,
            column,
            change: "value changed",
            before: row[column],
            after: next[column],
          });
      }
    }
    if (exact) {
      for (const column of afterTable.columns)
        if (!beforeTable.columns.includes(column))
          differences.push({ table, column, change: "column added" });
      for (const key of Object.keys(afterTable.rows))
        if (!beforeTable.rows[key]) differences.push({ table, key, change: "row added" });
    }
  }
  if (exact) {
    for (const table of Object.keys(after.tables))
      if (!before.tables[table]) differences.push({ table, change: "table added" });
  }
  return { differences, allowed: [...allowed.values()] };
}

/** One line per table/column/change, with a count and the first example. */
function summarizeDifferences(differences) {
  const groups = new Map();
  for (const entry of differences) {
    const key = `${entry.table}${entry.column ? `.${entry.column}` : ""} ${entry.change}`;
    const group = groups.get(key) ?? { key, count: 0, entry };
    group.count += 1;
    groups.set(key, group);
  }
  const example = (value) => {
    const text = JSON.stringify(value);
    return text && text.length > 60 ? `${text.slice(0, 57)}...` : text;
  };
  return [...groups.values()].map(({ key, count, entry }) =>
    "before" in entry
      ? `${key} ×${count} (e.g. ${example(entry.before)} → ${example(entry.after)})`
      : `${key} ×${count}`
  );
}

/**
 * Text for one GitHub Markdown table cell. Backslashes are escaped first, so a
 * trailing backslash cannot un-escape the pipe that follows; line breaks would
 * end the row.
 */
function markdownCell(value) {
  return String(value)
    .replace(/\\/g, "\\\\")
    .replace(/\|/g, "\\|")
    .replace(/\r?\n|\r/g, " ");
}

/** Validates declared rewrites: every rule names a known migration and a reason. */
function validateRules(rules, knownMigrations) {
  const errors = [];
  const changes = ["rewrite", "extend-json", "delete-row", "drop-column", "drop-table"];
  rules.forEach((rule, index) => {
    const label = `rule ${index + 1} (${rule.table}.${rule.column ?? "*"})`;
    if (!rule.table) errors.push(`${label}: table is required`);
    if (!changes.includes(rule.change)) errors.push(`${label}: unknown change ${rule.change}`);
    if (!rule.reason || rule.reason.trim().length < 20)
      errors.push(`${label}: explain the intentional change`);
    if (rule.migration && !knownMigrations.includes(rule.migration))
      errors.push(`${label}: unknown migration ${rule.migration}`);
    if (!rule.migration && !["config-secrets-v2", "upload-sweep"].includes(rule.startup))
      errors.push(`${label}: name the migration or startup step that makes this change`);
  });
  return errors;
}

// Small CLI for scripts/upgrade-rehearsal.sh, which keeps git and Docker work in
// shell and delegates the decisions above to this one implementation.
//   baseline <tags-at-candidate...>   stdin: tags reachable from the candidate
//   scenario <baseline> <versions...>
//   migrations                        stdin: baseline names, a "---" line, candidate names
//   new-snapshot <prefix>             stdin: before names, a "---" line, after names
function cli([command, ...args], stdin = "") {
  const lines = (text) =>
    text
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
  if (command === "baseline") return selectBaseline(lines(stdin), args);
  if (command === "scenario") return selectScenario(args.slice(1), args[0]);
  if (command === "migrations") {
    const [baseline, candidate = ""] = stdin.split(/^---$/m);
    return expectedMigrations(lines(baseline), lines(candidate)).join("\n");
  }
  if (command === "new-snapshot") {
    const [before, after = ""] = stdin.split(/^---$/m);
    return selectNewSnapshot(lines(before), lines(after), args[0]);
  }
  throw new Error(`Unknown command: ${command}`);
}

if (require.main === module) {
  const chunks = [];
  const finish = () => {
    try {
      const result = cli(process.argv.slice(2), Buffer.concat(chunks).toString("utf8"));
      if (result === null) process.exitCode = 3;
      else if (result) console.log(result);
    } catch (error) {
      console.error(error.message);
      process.exitCode = 2;
    }
  };
  if (process.stdin.isTTY) finish();
  else process.stdin.on("data", (chunk) => chunks.push(chunk)).on("end", finish);
}

module.exports = {
  cli,
  parseStableTag,
  compareVersions,
  selectBaseline,
  selectScenario,
  expectedMigrations,
  compareSnapshots,
  hasLegacySecrets,
  markdownCell,
  parseSecretMigrationLog,
  secretMigrationExpectations,
  selectNewSnapshot,
  summarizeDifferences,
  validateRules,
};
