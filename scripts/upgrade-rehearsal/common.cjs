/* eslint-disable @typescript-eslint/no-require-imports */
// Helpers for rehearsal steps that run inside a sidecar started from an app
// image. They use that image's own pg/sharp modules; results go to the shared
// /work volume so the final report can read every phase.
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const { createRequire } = require("node:module");

const appRequire = createRequire("/app/package.json");
const { Client } = appRequire("pg");

const WORK = "/work";
const RESULTS = path.join(WORK, "results.jsonl");

function readJson(name) {
  return JSON.parse(fs.readFileSync(path.join(WORK, name), "utf8"));
}

function writeJson(name, value) {
  fs.writeFileSync(path.join(WORK, name), `${JSON.stringify(value, null, 2)}\n`);
}

function record(entry) {
  fs.appendFileSync(RESULTS, `${JSON.stringify({ at: new Date().toISOString(), ...entry })}\n`);
}

function short(error) {
  return String(error?.message ?? error)
    .replace(/\s+/g, " ")
    .slice(0, 600);
}

/** Runs named checks for one phase, recording each outcome without stopping. */
function checker(phase, { blocking = true } = {}) {
  let failures = 0;
  async function check(name, fn, options = {}) {
    const isBlocking = options.blocking ?? blocking;
    try {
      const detail = await fn();
      const text = detail === undefined || detail === null ? "" : String(detail);
      record({ phase, name, ok: true, blocking: isBlocking, detail: text });
      console.log(`  ok    ${name}${text ? ` — ${text}` : ""}`);
      return true;
    } catch (error) {
      record({ phase, name, ok: false, blocking: isBlocking, detail: short(error) });
      if (isBlocking) failures += 1;
      console.log(`  ${isBlocking ? "FAIL" : "fails"}  ${name} — ${short(error)}`);
      return false;
    }
  }
  // Report-only failures are findings, not harness or candidate failures.
  check.allPassed = () => failures === 0;
  return check;
}

function databaseUrl() {
  const url = process.env.REHEARSAL_DATABASE_URL;
  assert.ok(url, "REHEARSAL_DATABASE_URL is required");
  // Every database belongs to this rehearsal's disposable PostgreSQL container.
  assert.equal(new URL(url).hostname, "postgres");
  return url;
}

async function withDb(fn, url = databaseUrl()) {
  const client = new Client({ connectionString: url, connectionTimeoutMillis: 10000 });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

async function query(sql, params = [], url) {
  return withDb(async (client) => (await client.query(sql, params)).rows, url);
}

/** Every public table, keyed by primary key, with every column as JSON. */
async function snapshot(url) {
  return withDb(async (client) => {
    const tables = (
      await client.query(
        `SELECT table_name FROM information_schema.tables
         WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name`
      )
    ).rows.map((row) => row.table_name);
    const result = { tables: {} };
    for (const table of tables) {
      const columns = (
        await client.query(
          `SELECT column_name FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = $1 ORDER BY ordinal_position`,
          [table]
        )
      ).rows.map((row) => row.column_name);
      const key = (
        await client.query(
          `SELECT a.attname FROM pg_index i
           JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
           WHERE i.indrelid = format('public.%I', $1::text)::regclass AND i.indisprimary
           ORDER BY array_position(i.indkey, a.attnum)`,
          [table]
        )
      ).rows.map((row) => row.attname);
      const identity = key.length ? key : columns;
      const rows = {};
      const quoted = table.replace(/"/g, '""');
      for (const { row } of (await client.query(`SELECT row_to_json(t) AS row FROM "${quoted}" t`))
        .rows) {
        rows[JSON.stringify(identity.map((column) => row[column]))] = row;
      }
      result.tables[table] = { columns, key: identity, rows };
    }
    return result;
  }, url);
}

function listFiles(directory) {
  try {
    return fs
      .readdirSync(directory)
      .filter((name) => fs.statSync(path.join(directory, name)).isFile());
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

async function eventually(fn, { timeoutMs = 60000, intervalMs = 1000, what = "condition" } = {}) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  for (;;) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
    }
    if (Date.now() > deadline) throw new Error(`${what} not reached: ${short(lastError)}`);
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

module.exports = {
  appRequire,
  checker,
  databaseUrl,
  eventually,
  listFiles,
  query,
  readJson,
  record,
  snapshot,
  withDb,
  writeJson,
  WORK,
  RESULTS,
};
