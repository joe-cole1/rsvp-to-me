/* eslint-disable @typescript-eslint/no-require-imports */
// Post-upgrade checks. They run in a sidecar of the CANDIDATE image, and their
// action calls follow the candidate's own signatures: this file is versioned
// with the application it checks.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { createDecipheriv, scryptSync } = require("node:crypto");
const accounts = require("./accounts.cjs");
const { createClient, lastMessageId, waitForMessage } = require("./action-client.cjs");
const {
  checker,
  eventually,
  listFiles,
  query,
  readJson,
  snapshot,
  writeJson,
} = require("./common.cjs");
const {
  compareSnapshots,
  parseSecretMigrationLog,
  secretMigrationExpectations,
  selectNewSnapshot,
  summarizeDifferences,
} = require("./lib.cjs");
const {
  APP_URL,
  assertHealthy,
  assertImageServed,
  signInByCode,
  signInByLink,
} = require("./flows.cjs");

const SECRET_KEYS = {
  smtp_pass: accounts.smtp.pass,
  twilio_auth_token: accounts.twilio.token,
  cloudflare_worker_api_secret: accounts.cloudflare.workerSecret,
  cloudflare_api_token: accounts.cloudflare.apiToken,
};

function decryptV2(value) {
  const [version, salt, iv, tag, text] = value.split(":");
  assert.equal(version, "v2", "not in the v2 format");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    scryptSync(
      process.env.ENCRYPTION_KEY || process.env.SESSION_SECRET,
      Buffer.from(salt, "hex"),
      32
    ),
    Buffer.from(iv, "hex")
  );
  decipher.setAAD(Buffer.from("rsvp-to-me:config:v2"));
  decipher.setAuthTag(Buffer.from(tag, "hex"));
  return Buffer.concat([decipher.update(Buffer.from(text, "hex")), decipher.final()]).toString();
}

function rows(snapshotValue, table) {
  return Object.values(snapshotValue.tables[table]?.rows ?? {});
}

function tally(list, key, amount = () => 1) {
  const result = {};
  for (const row of list) result[row[key]] = (result[row[key]] ?? 0) + amount(row);
  return result;
}

async function act(client, name, args, pagePath) {
  return client.action(name, args, { path: pagePath });
}

async function proveContact(client, eventId, channel, destination, pagePath) {
  const kind = channel === "email" ? "emails" : "sms";
  const since = await lastMessageId(kind);
  const requested = await act(
    client,
    "app/actions/event/rsvp.ts#requestRsvpVerification",
    [{ eventId, channel, destination }, null],
    pagePath
  );
  assert.equal(requested?.success, true, `proof request failed: ${JSON.stringify(requested)}`);
  const message = await waitForMessage(
    kind,
    (m) => (kind === "sms" ? m.to === destination : m.to.includes(destination)),
    { since }
  );
  assert.equal(message.authUser, channel === "email" ? accounts.smtp.user : accounts.twilio.sid);
  const code = /\b(\d{8})\b/.exec(message.text)?.[1];
  assert.ok(code, "proof message has no eight-digit code");
  const verified = await act(
    client,
    "app/actions/event/rsvp.ts#verifyRsvpVerification",
    [{ eventId, challengeId: requested.challengeId, code }],
    pagePath
  );
  assert.equal(verified?.success, true, `code rejected: ${JSON.stringify(verified)}`);
  return verified.proof;
}

async function addRsvp(client, eventId, slug, input, proofs = []) {
  const result = await act(
    client,
    "app/actions/event/rsvp.ts#addRSVP",
    [{ eventId, status: "GOING", plusOneCount: 0, ...input }, null, proofs],
    `/e/${slug}`
  );
  assert.equal(result?.success, true, `RSVP failed: ${JSON.stringify(result)}`);
  return result;
}

async function unlock(client, slug, password) {
  const unlocked = await act(
    client,
    "app/actions/event/rsvp.ts#verifyEventPassword",
    [slug, password, null],
    `/e/${slug}`
  );
  assert.equal(unlocked?.success, true, JSON.stringify(unlocked));
}

async function upgradeState(check, before, expected) {
  await check("Health check reports migrations ok", async () => {
    const detail = await assertHealthy();
    assert.equal(detail, "migrations ok");
    return detail;
  });
  await check("Every candidate migration applied", async () => {
    const applied = await query(
      `SELECT migration_name, finished_at, rolled_back_at FROM _prisma_migrations`
    );
    const finished = new Set(
      applied
        .filter((row) => row.finished_at && !row.rolled_back_at)
        .map((row) => row.migration_name)
    );
    const missing = expected.filter((name) => !finished.has(name));
    assert.deepEqual(missing, [], `not applied: ${missing.join(", ")}`);
    const unfinished = applied.filter((row) => !row.finished_at || row.rolled_back_at);
    assert.deepEqual(unfinished, [], "failed or rolled-back migration rows remain");
    return `${expected.length} new: ${expected.join(", ")}`;
  });
  const baselineBackups = fs.existsSync("/work/baseline-pre-migration.txt")
    ? fs
        .readFileSync("/work/baseline-pre-migration.txt", "utf8")
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
    : [];
  const secretExpectations = secretMigrationExpectations(before, Object.keys(SECRET_KEYS).length);
  await check("Startup wrote private schema and secret-recovery snapshots", async () => {
    const directory = "/backups/pre-migration";
    const files = listFiles(directory);
    const schema = selectNewSnapshot(baselineBackups, files, "pre-migration-schema_");
    assert.ok(schema, "no pre-migration schema snapshot");
    const secrets = secretExpectations.expectSecretsBackup
      ? selectNewSnapshot(baselineBackups, files, "pre-migration-secrets_")
      : null;
    if (secretExpectations.expectSecretsBackup) {
      assert.ok(secrets, "no secret-recovery snapshot");
    }
    const legacy = rows(before, "SystemConfig").find((row) => row.key === "smtp_pass").value;
    for (const name of [schema, ...(secrets ? [secrets] : [])]) {
      const stat = fs.statSync(path.join(directory, name));
      assert.ok(stat.size > 0, `${name} is empty`);
      assert.equal(stat.mode & 0o077, 0, `${name} is readable by other accounts`);
      const text = fs.readFileSync(path.join(directory, name), "utf8");
      assert.ok(text.includes(legacy), `${name} does not hold the pre-conversion credential`);
    }
    writeJson("startup-snapshot.json", { file: schema });
    return secrets ? `${schema}, ${secrets}` : schema;
  });
  await check("Saved credentials converted to v2 encryption", async () => {
    const log = fs.readFileSync("/work/candidate-start.log", "utf8");
    const summary = parseSecretMigrationLog(log);
    assert.ok(summary, "no completed config-secrets summary in the startup log");
    assert.equal(summary.converted, secretExpectations.expectedConverted, summary.line);
    assert.equal(summary.verified, secretExpectations.expectedVerified, summary.line);
    const config = Object.fromEntries(
      (await query(`SELECT key, value FROM "SystemConfig"`)).map((row) => [row.key, row.value])
    );
    assert.equal(config.config_encryption_version, "2");
    for (const [key, value] of Object.entries(SECRET_KEYS))
      assert.equal(decryptV2(config[key]), value, key);
    return summary.line;
  });
  await check("Startup sweep keeps referenced uploads and removes the stale one", async () => {
    const { uploads } = readJson("fixtures.json");
    const name = (url) => url.slice("/api/uploads/".length);
    await eventually(
      () =>
        assert.ok(
          !fs.existsSync(path.join("/uploads", name(uploads.stale))),
          "stale upload still present"
        ),
      { timeoutMs: 120000, what: "removal of the stale upload" }
    );
    for (const url of uploads.referenced) {
      assert.ok(fs.existsSync(path.join("/uploads", name(url))), `${url} was removed`);
      await assertImageServed(url);
    }
    return `${uploads.referenced.length} referenced kept (all older than 24 hours), stale removed`;
  });
}

async function preservation(check, before, after, expected) {
  await check("Existing data is preserved except declared migration rewrites", async () => {
    const rules = JSON.parse(fs.readFileSync("/rehearsal/expected-rewrites.json", "utf8"));
    const result = compareSnapshots(before, after, { rules, appliedMigrations: expected });
    writeJson("upgrade-diff.json", result);
    assert.equal(
      result.differences.length,
      0,
      `${result.differences.length} undeclared changes: ${summarizeDifferences(result.differences).join("; ")}`
    );
    return (
      result.allowed
        .map((entry) => `${entry.rule.table}.${entry.rule.column ?? "*"} ×${entry.count}`)
        .join(", ") || "no rewrites"
    );
  });
  await check("Vote counts unchanged", () => {
    const counts = (value) => tally(rows(value, "PollVote"), "pollOptionId");
    assert.deepEqual(counts(after), counts(before));
    return `${rows(before, "PollVote").length} votes`;
  });
  await check("Potluck quantities unchanged", () => {
    const quantities = (value) =>
      tally(rows(value, "PotluckClaim"), "potluckItemId", (row) => row.quantity);
    assert.deepEqual(quantities(after), quantities(before));
    return `${rows(before, "PotluckClaim").length} claims`;
  });
  await check("Display settings and event URLs unchanged", () => {
    // A count whose names were hidden becomes hidden too when upgrading across #811; nothing else moves.
    const hidesHiddenCounts = expected.includes("20261107120000_guest_invited_display");
    const counts = {
      guestGoingCount: "guestGoingList",
      guestMaybeCount: "guestMaybeList",
      guestDeclinedCount: "guestDeclinedList",
    };
    const fields = before.tables.Event.columns.filter((column) =>
      /^(guest|plusOne|visibility|slug|passwordHash|hostAlert)/.test(column)
    );
    const next = Object.fromEntries(rows(after, "Event").map((row) => [row.id, row]));
    let hidden = 0;
    for (const row of rows(before, "Event")) {
      for (const field of fields) {
        const expectedValue =
          hidesHiddenCounts && counts[field] && row[counts[field]] === "HIDDEN"
            ? "HIDDEN"
            : row[field];
        if (expectedValue !== row[field]) hidden += 1;
        assert.equal(next[row.id]?.[field], expectedValue, `${row.slug}.${field}`);
      }
    }
    return `${rows(before, "Event").length} events × ${fields.length} fields; ${hidden} count(s) hidden with their names`;
  });
}

async function functional(check, before) {
  const fixtures = readJson("fixtures.json");
  const { event, polls, editTokens } = fixtures;
  let host;
  await check("Sign-in by emailed link", async () => {
    const signedIn = await signInByLink("host@test.com", "host");
    host = signedIn.client;
    assert.equal(
      signedIn.message.authUser,
      accounts.smtp.user,
      "the converted SMTP credential was not used"
    );
  });
  await check("Sign-in by code", async () => {
    await signInByCode("cohost@test.com", "cohost");
  });
  await check("Existing event URLs open", async () => {
    const published = rows(before, "Event").filter((row) => row.status === "PUBLISHED");
    for (const { slug } of published) {
      const page = await createClient(APP_URL).get(`/e/${slug}`);
      assert.equal(page.status, 200, `/e/${slug} returned ${page.status}`);
    }
    return `${published.length} events`;
  });
  await check("Public RSVP with verified email and phone", async () => {
    const [target] = await query(
      `SELECT id, slug FROM "Event" WHERE visibility = 'PUBLIC' AND status = 'PUBLISHED'
       AND "passwordHash" IS NULL AND "startAt" > now() + interval '1 day'
       AND ("rsvpDeadline" IS NULL OR "rsvpDeadline" > now()) ORDER BY "startAt" LIMIT 1`
    );
    assert.ok(target, "no open public event in the baseline data");
    const guest = createClient(APP_URL, "public guest");
    const email = "public.guest@rehearsal.invalid";
    const phone = "+15550009183";
    const proofs = [
      await proveContact(guest, target.id, "email", email, `/e/${target.slug}`),
      await proveContact(guest, target.id, "sms", phone, `/e/${target.slug}`),
    ];
    const since = await lastMessageId("emails");
    await addRsvp(
      guest,
      target.id,
      target.slug,
      {
        guestName: "Public Guest",
        guestEmail: email,
        guestPhone: phone,
        plusOneCount: 1,
        plusOneGuestNames: ["Public Companion"],
      },
      proofs
    );
    await waitForMessage("emails", (m) => m.to.includes(email), { since });
    return `${target.slug}; confirmation delivered`;
  });
  await check("Password-protected RSVP", async () => {
    const guest = createClient(APP_URL, "protected guest");
    await unlock(guest, event.slug, event.password);
    const email = "protected.guest@rehearsal.invalid";
    const proof = await proveContact(guest, event.id, "email", email, `/e/${event.slug}`);
    await addRsvp(
      guest,
      event.id,
      event.slug,
      { guestName: "Protected Guest", guestEmail: email },
      [proof]
    );
  });
  await check("RSVP editing with a pre-upgrade edit token", async () => {
    const guest = createClient(APP_URL, "alex");
    const edited = await act(
      guest,
      "app/actions/event/rsvp.ts#updateRSVP",
      [
        editTokens.alex,
        { guestName: "Alex Kim", status: "NO", plusOneCount: 0, note: "Edited after the upgrade" },
        null,
      ],
      `/e/${event.slug}`
    );
    assert.equal(edited?.success, true, JSON.stringify(edited));
  });
  await check("Guests who share a name can vote for the same option", async () => {
    const [{ n: start }] = await query(
      `SELECT count(*)::int AS n FROM "PollVote" WHERE "pollOptionId" = $1`,
      [polls.multi.karaoke]
    );
    const sameName = [];
    for (const guestName of ["Jordan Lee", "Jordan Lee"]) {
      const guest = createClient(APP_URL, guestName);
      await unlock(guest, event.slug, event.password);
      const { id, editToken } = await addRsvp(guest, event.id, event.slug, { guestName });
      await act(
        guest,
        "app/actions/event/polls.ts#castVote",
        [polls.multi.id, polls.multi.karaoke, guestName, true, editToken],
        `/e/${event.slug}`
      );
      sameName.push({ id, editToken, guestName });
    }
    const [{ n: end }] = await query(
      `SELECT count(*)::int AS n FROM "PollVote" WHERE "pollOptionId" = $1`,
      [polls.multi.karaoke]
    );
    assert.equal(end, start + 2);
    // Rollback probes check whether the baseline keeps these votes independent.
    writeJson("post-upgrade.json", { sameName, poll: polls.multi.id, option: polls.multi.karaoke });
    return `Karaoke ${start} → ${end}`;
  });
  await check("Invitations by email and SMS", async () => {
    const recipients = [
      { contact: "invitee.three@rehearsal.invalid", name: "Invitee Three" },
      { contact: "+15550009184", name: "Invitee Four" },
    ];
    const pagePath = `/e/${event.slug}/guests`;
    const preview = await act(
      host,
      "app/actions/event/invites.ts#previewGuestInvitations",
      [event.id, recipients],
      pagePath
    );
    const reviewed = recipients.map((recipient) => {
      const row = preview.recipients.find((candidate) => candidate.contact === recipient.contact);
      return {
        ...recipient,
        expectedDisposition: row.disposition,
        expectedGuestName: row.guestName,
      };
    });
    const emailSince = await lastMessageId("emails");
    const smsSince = await lastMessageId("sms");
    const sent = await act(
      host,
      "app/actions/event/invites.ts#sendGuestInvitations",
      [event.id, reviewed, null],
      pagePath
    );
    assert.ok(
      sent.results.every((result) => result.status === "sent"),
      JSON.stringify(sent)
    );
    const mail = await waitForMessage(
      "emails",
      (m) => m.to.includes("invitee.three@rehearsal.invalid"),
      { since: emailSince }
    );
    const text = await waitForMessage("sms", (m) => m.to === "+15550009184", { since: smsSince });
    assert.equal(mail.authUser, accounts.smtp.user);
    assert.equal(text.authUser, accounts.twilio.sid);
  });
  await check("Event update notification reaches pre-upgrade guests", async () => {
    const message = "Rehearsal update sent after the upgrade";
    const since = await lastMessageId("emails");
    const sent = await act(
      host,
      "app/actions/event/blasts.ts#sendBlast",
      [event.id, message, ["GOING"], null],
      `/e/${event.slug}/guests`
    );
    assert.notEqual(sent?.success, false, JSON.stringify(sent));
    await waitForMessage(
      "emails",
      (m) => m.to.includes("sam.one@rehearsal.invalid") && m.text.includes(message),
      { since }
    );
  });
}

async function verifyUpgrade() {
  const check = checker("upgrade");
  const before = readJson("before.json");
  const expected = fs
    .readFileSync("/work/expected-migrations.txt", "utf8")
    .split("\n")
    .filter(Boolean);
  await upgradeState(check, before, expected);
  const after = await snapshot();
  writeJson("after.json", after);
  await preservation(check, before, after, expected);
  await functional(check, before);
  return check.allPassed();
}

module.exports = { verifyUpgrade, decryptV2 };
