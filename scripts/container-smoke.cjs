/* eslint-disable @typescript-eslint/no-require-imports */
// Runs inside the candidate image, after its normal entrypoint/startup succeeds.
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const sharp = require("sharp");
const { Client } = require("pg");
const { createClient } = require("redis");
const { createCipheriv, createDecipheriv, randomBytes, scryptSync } = require("node:crypto");

function credential(value, modern) {
  const salt = modern ? randomBytes(16) : "rsvp-to-me-salt";
  const iv = randomBytes(12);
  const cipher = createCipheriv(
    "aes-256-gcm",
    scryptSync(process.env.SESSION_SECRET, salt, 32),
    iv
  );
  if (modern) cipher.setAAD(Buffer.from("rsvp-to-me:config:v2"));
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const legacy = `${iv.toString("hex")}:${cipher.getAuthTag().toString("hex")}:${ciphertext.toString("hex")}`;
  return modern ? `v2:${salt.toString("hex")}:${legacy}` : legacy;
}

async function prepareConfigUpgrade() {
  // This fixture is destructive only to this smoke test's disposable database.
  const target = new URL(process.env.DATABASE_URL);
  assert.equal(target.hostname, "postgres");
  assert.equal(target.pathname, "/rsvp_qc");
  const client = new Client({ connectionString: target.toString() });
  await client.connect();
  try {
    await client.query('DELETE FROM "SystemConfig" WHERE key = $1', ["config_encryption_version"]);
    for (const [key, value] of [
      ["smtp_pass", credential("qc-smtp-fixture", false)],
      ["twilio_auth_token", "qc-twilio-fixture"],
      ["cloudflare_worker_api_secret", credential("qc-worker-fixture", true)],
      ["cloudflare_api_token", ""],
    ]) {
      await client.query(
        'INSERT INTO "SystemConfig" (key,value) VALUES ($1,$2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value',
        [key, value]
      );
    }
  } finally {
    await client.end();
  }
  console.log("Prepared disposable legacy configuration upgrade fixture");
}

async function main() {
  assert.equal(process.arch, process.env.EXPECTED_NODE_ARCH);
  assert.equal(process.getuid(), 10001);
  const processStatus = await fs.readFile("/proc/1/status", "utf8");
  assert.match(processStatus, /^Uid:\s+10001\s+10001\s+10001\s+10001$/m);

  const health = await fetch("http://127.0.0.1:3000/api/health", {
    headers: { "x-health-token": process.env.HEALTH_CHECK_TOKEN },
    signal: AbortSignal.timeout(10000),
  });
  assert.equal(health.status, 200);
  const details = await health.json();
  assert.equal(details.status, "ok");
  assert.equal(details.migrations, "ok");
  const anonymous = await fetch("http://127.0.0.1:3000/api/health", {
    signal: AbortSignal.timeout(10000),
  });
  assert.deepEqual(await anonymous.json(), { status: "ok" });
  const homepage = await fetch("http://127.0.0.1:3000", {
    signal: AbortSignal.timeout(10000),
  });
  assert.equal(homepage.status, 200);
  assert.match(homepage.headers.get("content-type"), /text\/html/);

  for (const directory of ["/app/data/uploads", "/app/data/backups/pre-migration"]) {
    const stat = await fs.stat(directory);
    assert.equal(stat.uid, 10001);
    assert.equal(stat.gid, 10001);
    const probe = path.join(directory, ".container-qc");
    await fs.writeFile(probe, "writable", { flag: "wx" });
    await fs.unlink(probe);
  }
  const backupDir = "/app/data/backups/pre-migration";
  const backups = (await fs.readdir(backupDir)).filter((file) => file.endsWith(".sql")).sort();
  assert.ok(backups.length >= 2, "Both startups must create a pre-migration backup");
  for (const backup of backups) {
    const stat = await fs.stat(path.join(backupDir, backup));
    assert.ok(stat.size > 0);
    assert.equal(stat.mode & 0o077, 0, "Credential snapshots must be private");
  }

  const db = new Client({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 5000,
  });
  await db.connect();
  try {
    const secrets = await db.query(
      'SELECT key,value FROM "SystemConfig" WHERE key = ANY($1::text[])',
      [
        [
          "smtp_pass",
          "twilio_auth_token",
          "cloudflare_worker_api_secret",
          "cloudflare_api_token",
          "config_encryption_version",
        ],
      ]
    );
    const config = Object.fromEntries(secrets.rows.map((row) => [row.key, row.value]));
    assert.equal(config.config_encryption_version, "2");
    assert.equal(config.cloudflare_api_token, "");
    for (const [name, expected] of [
      ["smtp_pass", "qc-smtp-fixture"],
      ["twilio_auth_token", "qc-twilio-fixture"],
      ["cloudflare_worker_api_secret", "qc-worker-fixture"],
    ]) {
      const [version, salt, iv, tag, text] = config[name].split(":");
      assert.equal(version, "v2");
      const decipher = createDecipheriv(
        "aes-256-gcm",
        scryptSync(process.env.SESSION_SECRET, Buffer.from(salt, "hex"), 32),
        Buffer.from(iv, "hex")
      );
      decipher.setAAD(Buffer.from("rsvp-to-me:config:v2"));
      decipher.setAuthTag(Buffer.from(tag, "hex"));
      assert.equal(
        Buffer.concat([decipher.update(Buffer.from(text, "hex")), decipher.final()]).toString(),
        expected
      );
    }
    console.log("Automatic legacy configuration upgrade and repeat startup passed");
    const seed = await db.query('SELECT code FROM "HostInviteCode" WHERE code = $1', [
      process.env.HOST_INVITE_CODE,
    ]);
    assert.equal(seed.rowCount, 1, "Normal startup must complete seeding");

    const migrations = await db.query(
      "SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL ORDER BY migration_name"
    );
    assert.ok(migrations.rowCount > 0, "Startup must apply migrations");
    const restoreUrl = new URL(process.env.DATABASE_URL);
    assert.equal(restoreUrl.hostname, "postgres");
    assert.equal(restoreUrl.pathname, "/rsvp_qc");
    restoreUrl.pathname = "/rsvp_qc_restore";
    execFileSync(
      "psql",
      [
        "--no-psqlrc",
        "--set=ON_ERROR_STOP=1",
        "--dbname",
        restoreUrl.toString(),
        "--file",
        path.join(backupDir, backups.at(-1)),
      ],
      { stdio: ["ignore", "ignore", "pipe"], timeout: 60000 }
    );
    const restored = new Client({
      connectionString: restoreUrl.toString(),
      connectionTimeoutMillis: 5000,
    });
    await restored.connect();
    try {
      const restoredSeed = await restored.query(
        'SELECT code FROM "HostInviteCode" WHERE code = $1',
        [process.env.HOST_INVITE_CODE]
      );
      assert.deepEqual(restoredSeed.rows, seed.rows, "Backup must preserve the seeded invite");
      const restoredMigrations = await restored.query(
        "SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL ORDER BY migration_name"
      );
      assert.deepEqual(restoredMigrations.rows, migrations.rows);
      console.log("Backup restore QC passed: seeded invite and migration history preserved");
    } finally {
      await restored.end();
    }
  } finally {
    await db.end();
  }
  const redis = createClient({
    url: process.env.REDIS_URL,
    socket: { connectTimeout: 5000, reconnectStrategy: false },
  });
  redis.on("error", (error) => console.error(error));
  await redis.connect();
  try {
    assert.equal(await redis.ping(), "PONG");
  } finally {
    await redis.quit();
  }

  // Exercise native Sharp/libvips on each Alpine architecture, including the
  // WebP conversion used for responsive uploads, rather than only importing it.
  const input = await sharp({
    create: { width: 32, height: 32, channels: 3, background: "#457b9d" },
  })
    .png()
    .toBuffer();
  for (const format of ["jpeg", "webp", "avif"]) {
    const output = await sharp(input).resize(16, 16).toFormat(format).toBuffer();
    const metadata = await sharp(output).metadata();
    assert.equal(metadata.width, 16);
    assert.equal(metadata.height, 16);
  }
  console.log(
    `Container QC passed: ${process.arch}, Node ${process.version}, Sharp ${sharp.versions.sharp}`
  );
}

(process.argv.includes("--prepare-config-upgrade") ? prepareConfigUpgrade() : main()).catch(
  (error) => {
    console.error(error);
    process.exitCode = 1;
  }
);
