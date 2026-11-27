/* eslint-disable @typescript-eslint/no-require-imports */
// Baseline scenario for releases from v2.0.0 until a newer scenario file exists.
// It runs in a sidecar of the BASELINE image and changes data only through that
// release's own server actions and upload route, on top of the release's own
// SEED_TEST_DATA fixtures. Reads use SQL against the baseline's own schema.
// Add a newer scenarios/vX.Y.Z.cjs when a baseline's action signatures change.
const assert = require("node:assert/strict");
const accounts = require("../accounts.cjs");
const { createClient, lastMessageId, waitForMessage } = require("../action-client.cjs");
const { checker, query, readJson, writeJson } = require("../common.cjs");
const {
  APP_URL,
  assertHealthy,
  assertImageServed,
  futureDate,
  signInByLink,
  uploadImage,
} = require("../flows.cjs");

const EVENT_PASSWORD = "rehearsal-door-1918";
const SAME_NAME = "Sam Rivera";

// Each phase signs in fresh identities: sign-in is limited to five requests per
// identifier per ten minutes, and Redis is shared across the whole rehearsal.
const SMOKE_IDENTITIES = {
  baseline: { email: "guest5@test.com", phone: "+15550000001" },
  "R1 image-only": { email: "guest6@test.com", phone: "+15550000001" },
  "R2 secrets-rollback": { email: "guest7@test.com", phone: "+15550000002" },
  "R3a restore-operator-backup": { email: "guest8@test.com", phone: "+15550000002" },
  "R3b restore-startup-snapshot": { email: "guest9@test.com", phone: "+15550000002" },
};

async function act(client, name, args, path) {
  return client.action(name, args, path ? { path } : {});
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

async function rsvp(eventId, slug, input, { password } = {}) {
  const guest = createClient(APP_URL, input.guestName);
  const pagePath = `/e/${slug}`;
  if (password) {
    const unlocked = await act(
      guest,
      "app/actions/event/rsvp.ts#verifyEventPassword",
      [slug, password, null],
      pagePath
    );
    assert.equal(unlocked.success, true, JSON.stringify(unlocked));
  }
  const proofs = [];
  if (input.guestEmail) {
    proofs.push(await proveContact(guest, eventId, "email", input.guestEmail, pagePath));
  }
  if (input.guestPhone) {
    proofs.push(await proveContact(guest, eventId, "sms", input.guestPhone, pagePath));
  }
  const result = await act(
    guest,
    "app/actions/event/rsvp.ts#addRSVP",
    [{ eventId, status: "GOING", plusOneCount: 0, ...input }, null, proofs],
    pagePath
  );
  assert.equal(result?.success, true, `RSVP failed: ${JSON.stringify(result)}`);
  return { guest, id: result.id, editToken: result.editToken };
}

async function saveProviderSettings(admin) {
  const settings = [
    ["email_provider", "smtp"],
    ["smtp_host", accounts.smtp.host],
    ["smtp_port", accounts.smtp.port],
    ["smtp_secure", "false"],
    ["smtp_user", accounts.smtp.user],
    ["smtp_pass", accounts.smtp.pass],
    ["twilio_account_sid", accounts.twilio.sid],
    ["twilio_auth_token", accounts.twilio.token],
    ["twilio_phone_number", accounts.twilio.phone],
    ["cloudflare_worker_api_secret", accounts.cloudflare.workerSecret],
    ["cloudflare_api_token", accounts.cloudflare.apiToken],
  ];
  for (const [key, value] of settings) {
    const saved = await act(
      admin,
      "app/actions/admin.ts#updateSystemConfig",
      [key, value],
      "/admin"
    );
    assert.equal(saved?.success, true, `${key}: ${JSON.stringify(saved)}`);
  }
  const stored = await query(`SELECT key, value FROM "SystemConfig" WHERE key = ANY($1::text[])`, [
    [
      "config_encryption_version",
      "smtp_pass",
      "twilio_auth_token",
      "cloudflare_worker_api_secret",
      "cloudflare_api_token",
    ],
  ]);
  const byKey = Object.fromEntries(stored.map((row) => [row.key, row.value]));
  assert.equal(byKey.config_encryption_version, "2", "v2 encryption marker missing");
  for (const key of [
    "smtp_pass",
    "twilio_auth_token",
    "cloudflare_worker_api_secret",
    "cloudflare_api_token",
  ]) {
    assert.match(
      byKey[key] ?? "",
      /^v2:[0-9a-f]{32}:[0-9a-f]{24}:[0-9a-f]{32}:[0-9a-f]+$/,
      `${key} is not v2-encrypted`
    );
  }
  return "4 provider secrets saved with v2 encryption";
}

async function setAvatar(client, url) {
  const profile = await act(client, "app/actions/profile.ts#getUserProfile", [], "/profile");
  const saved = await act(
    client,
    "app/actions/profile.ts#updateProfileSettings",
    [{ name: profile.name, email: profile.email ?? undefined, avatarUrl: url }, null],
    "/profile"
  );
  assert.notEqual(saved?.success, false, JSON.stringify(saved));
}

async function seed() {
  const check = checker("seed");
  const fixtures = { uploads: { referenced: [], stale: null } };
  let admin;
  let host;

  await check("Administrator signs in by emailed link", async () => {
    ({ client: admin } = await signInByLink("admin@test.com", "admin"));
  });
  await check("Saved encrypted email and SMS provider settings", () => saveProviderSettings(admin));
  await check("Host signs in through the saved SMTP credential", async () => {
    const signedIn = await signInByLink("host@test.com", "host");
    host = signedIn.client;
    assert.equal(signedIn.message.authUser, accounts.smtp.user);
  });
  await check("Uploaded and assigned avatars and covers", async () => {
    const adminAvatar = await uploadImage(admin, "#457b9d");
    await setAvatar(admin, adminAvatar);
    const hostAvatar = await uploadImage(host, "#e76f51");
    await setAvatar(host, hostAvatar);
    const events = await query(
      `SELECT e.id, e.slug FROM "Event" e JOIN "User" u ON u.id = e."hostId"
       WHERE u.email = 'host@test.com' AND e."startAt" > now() ORDER BY e."startAt" LIMIT 3`
    );
    assert.ok(events.length >= 3, "the baseline seed has upcoming host events");
    const sharedCover = await uploadImage(host, "#2a9d8f");
    const ownCover = await uploadImage(host, "#f4a261");
    for (const [event, cover] of [
      [events[0], sharedCover],
      [events[1], sharedCover],
      [events[2], ownCover],
    ]) {
      await act(
        host,
        "app/actions/event/settings.ts#saveCoverImage",
        [event.id, cover, null],
        `/e/${event.slug}/settings`
      );
    }
    fixtures.uploads.referenced = [adminAvatar, hostAvatar, sharedCover, ownCover];
    return "2 avatars, 1 cover shared by two events, 1 cover";
  });
  await check("Uploaded one image that nothing references", async () => {
    fixtures.uploads.stale = await uploadImage(host, "#264653");
  });

  let event;
  await check("Created an Unlisted, password-protected event with display settings", async () => {
    const form = new FormData();
    form.set("title", "Upgrade Rehearsal Supper");
    form.set("description", "Disposable upgrade-rehearsal fixture.");
    form.set("startDate", futureDate(30));
    form.set("startTime", "18:30");
    form.set("timezone", "Europe/Amsterdam");
    form.set("locationType", "PHYSICAL");
    form.set("locationName", "Rehearsal Hall");
    form.set("visibility", "UNLISTED");
    const created = await act(
      host,
      "app/actions/createEvent.ts#createEvent",
      [form],
      "/dashboard/events/new"
    );
    assert.match(created?.redirect ?? "", /^\/e\/[^/]+$/, JSON.stringify(created));
    const slug = created.redirect.slice(3);
    const [row] = await query(`SELECT id FROM "Event" WHERE slug = $1`, [slug]);
    event = { id: row.id, slug, password: EVENT_PASSWORD };
    const settings = await act(
      host,
      "app/actions/event/settings.ts#saveEventSettings",
      [
        event.id,
        {
          password: EVENT_PASSWORD,
          plusOneAllowed: true,
          plusOneMax: 2,
          plusOneNamesRequired: false,
          guestGoingList: "COLLAPSED",
          guestGoingCount: "EXACT",
          guestMaybeList: "HIDDEN",
          guestMaybeCount: "HIDDEN",
          guestDeclinedList: "EXPANDED",
          guestDeclinedCount: "CAPPED",
          hostAlertEmail: true,
          hostAlertSms: true,
        },
        null,
      ],
      `/e/${slug}/settings`
    );
    assert.equal(settings?.success, true, JSON.stringify(settings));
    fixtures.event = event;
    return slug;
  });
  await check("Scheduled reminders for the new event", async () => {
    await act(
      host,
      "app/actions/event/settings.ts#saveReminderSettings",
      [
        event.id,
        {
          emailWeekBefore: true,
          emailDayBefore: true,
          emailHoursBefore: 3,
          smsWeekBefore: false,
          smsDayBefore: true,
          smsHoursBefore: 0,
          nudgeUnresponded: true,
        },
        null,
      ],
      `/e/${event.slug}/settings`
    );
  });
  await check("Created single- and multiple-choice polls and a potluck item", async () => {
    const path = `/e/${event.slug}/settings`;
    await act(
      host,
      "app/actions/event/polls.ts#createPoll",
      [event.id, "Which dessert?", ["Pie", "Cake", "Fruit"], false, false, false, null],
      path
    );
    await act(
      host,
      "app/actions/event/polls.ts#createPoll",
      [
        event.id,
        "Which activities?",
        ["Hiking", "Board games", "Karaoke"],
        true,
        false,
        false,
        null,
      ],
      path
    );
    await act(
      host,
      "app/actions/event/potluck.ts#addPotluckItem",
      [event.id, "Bread", 4, null],
      path
    );
    const options = await query(
      `SELECT p.question, p.id AS "pollId", o.id, o.text FROM "Poll" p
       JOIN "PollOption" o ON o."pollId" = p.id WHERE p."eventId" = $1`,
      [event.id]
    );
    const option = (text) => options.find((row) => row.text === text);
    fixtures.polls = {
      single: { id: option("Pie").pollId, pie: option("Pie").id, cake: option("Cake").id },
      multi: {
        id: option("Hiking").pollId,
        hiking: option("Hiking").id,
        games: option("Board games").id,
        karaoke: option("Karaoke").id,
      },
    };
    const [item] = await query(`SELECT id FROM "PotluckItem" WHERE "eventId" = $1`, [event.id]);
    fixtures.potluckItem = item.id;
  });

  const guests = {};
  await check(
    "Protected RSVPs with companions, including two guests with the same name",
    async () => {
      guests.samOne = await rsvp(
        event.id,
        event.slug,
        {
          guestName: SAME_NAME,
          guestEmail: "sam.one@rehearsal.invalid",
          plusOneCount: 1,
          plusOneGuestNames: ["Robin Rivera"],
        },
        { password: EVENT_PASSWORD }
      );
      guests.samTwo = await rsvp(
        event.id,
        event.slug,
        {
          guestName: SAME_NAME,
          guestEmail: "sam.two@rehearsal.invalid",
          plusOneCount: 2,
          plusOneGuestNames: ["Kit Rivera", "Ash Rivera"],
        },
        { password: EVENT_PASSWORD }
      );
      guests.alex = await rsvp(
        event.id,
        event.slug,
        { guestName: "Alex Kim", guestPhone: "+15550009181", status: "MAYBE" },
        { password: EVENT_PASSWORD }
      );
      fixtures.editTokens = {
        samOne: guests.samOne.editToken,
        samTwo: guests.samTwo.editToken,
        alex: guests.alex.editToken,
      };
    }
  );
  await check("Votes and potluck claims by guests who share a name", async () => {
    const path = `/e/${event.slug}`;
    const vote = (guest, poll, option) =>
      act(
        guest.guest,
        "app/actions/event/polls.ts#castVote",
        [poll, option, SAME_NAME, true, guest.editToken],
        path
      );
    const { single, multi } = fixtures.polls;
    await vote(guests.samOne, multi.id, multi.hiking);
    await vote(guests.samTwo, multi.id, multi.games);
    await vote(guests.samOne, single.id, single.pie);
    await vote(guests.samTwo, single.id, single.cake);
    await vote(guests.samTwo, multi.id, multi.hiking);
    await act(
      guests.samOne.guest,
      "app/actions/event/potluck.ts#claimPotluckItem",
      [fixtures.potluckItem, SAME_NAME, 2, guests.samOne.editToken],
      path
    );
    await act(
      guests.alex.guest,
      "app/actions/event/potluck.ts#claimPotluckItem",
      [fixtures.potluckItem, "Alex Kim", 1, guests.alex.editToken],
      path
    );
    const counts = await query(
      `SELECT o.text, count(v.id)::int AS votes FROM "PollOption" o
       LEFT JOIN "PollVote" v ON v."pollOptionId" = o.id
       JOIN "Poll" p ON p.id = o."pollId" WHERE p."eventId" = $1 GROUP BY o.text ORDER BY o.text`,
      [event.id]
    );
    const byText = Object.fromEntries(counts.map((row) => [row.text, row.votes]));
    assert.equal(
      byText.Hiking,
      2,
      `expected independent same-name votes: ${JSON.stringify(byText)}`
    );
    return counts.map((row) => `${row.text}=${row.votes}`).join(", ");
  });
  await check("Edited an RSVP with its edit link token", async () => {
    const edited = await act(
      guests.alex.guest,
      "app/actions/event/rsvp.ts#updateRSVP",
      [
        guests.alex.editToken,
        {
          guestName: "Alex Kim",
          status: "GOING",
          plusOneCount: 0,
          note: "Edited before the upgrade",
        },
        null,
      ],
      `/e/${event.slug}`
    );
    assert.equal(edited?.success, true, JSON.stringify(edited));
  });
  await check("Invited guests by email and SMS through the saved providers", async () => {
    const recipients = [
      { contact: "invitee.one@rehearsal.invalid", name: "Invitee One" },
      { contact: "+15550009182", name: "Invitee Two" },
    ];
    const path = `/e/${event.slug}/guests`;
    const preview = await act(
      host,
      "app/actions/event/invites.ts#previewGuestInvitations",
      [event.id, recipients],
      path
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
      path
    );
    assert.ok(
      sent.results.every((result) => result.status === "sent"),
      JSON.stringify(sent)
    );
    const mail = await waitForMessage(
      "emails",
      (m) => m.to.includes("invitee.one@rehearsal.invalid"),
      { since: emailSince }
    );
    const text = await waitForMessage("sms", (m) => m.to === "+15550009182", { since: smsSince });
    assert.equal(mail.authUser, accounts.smtp.user);
    assert.equal(text.authUser, accounts.twilio.sid);
  });

  writeJson("fixtures.json", fixtures);
  return check.allPassed();
}

/** Core baseline flows, used as a control before upgrade and after each rollback. */
async function smoke(phase, { blocking }) {
  const check = checker(phase, { blocking });
  const fixtures = readJson("fixtures.json");
  const identity = SMOKE_IDENTITIES[phase];
  assert.ok(identity, `No smoke identities for ${phase}`);
  const { event, polls, potluckItem, uploads } = fixtures;

  await check("Health check", () => assertHealthy());
  await check("Email sign-in uses the saved SMTP credential", async () => {
    const { message } = await signInByLink(identity.email);
    assert.equal(message.authUser, accounts.smtp.user, "the saved SMTP login was not used");
  });
  await check("SMS sign-in uses the saved Twilio credential", async () => {
    const { message } = await signInByLink(identity.phone);
    assert.equal(message.authUser, accounts.twilio.sid);
  });
  await check("Referenced avatars and covers are served", async () => {
    for (const url of uploads.referenced) await assertImageServed(url);
    return `${uploads.referenced.length} images`;
  });
  await check("Existing event URLs open", async () => {
    const events = await query(`SELECT slug FROM "Event" WHERE status = 'PUBLISHED'`);
    for (const { slug } of events) {
      const page = await createClient(APP_URL).get(`/e/${slug}`);
      assert.equal(page.status, 200, `/e/${slug} returned ${page.status}`);
    }
    return `${events.length} events`;
  });
  let guest;
  await check("Protected RSVP", async () => {
    guest = await rsvp(
      event.id,
      event.slug,
      {
        guestName: `Smoke ${phase}`,
        guestEmail: `${phase.split(" ")[0].toLowerCase()}@rehearsal.invalid`,
      },
      { password: event.password }
    );
  });
  await check("Poll vote", async () => {
    const before = await query(
      `SELECT count(*)::int AS n FROM "PollVote" WHERE "pollOptionId" = $1`,
      [polls.multi.karaoke]
    );
    await act(
      guest.guest,
      "app/actions/event/polls.ts#castVote",
      [polls.multi.id, polls.multi.karaoke, `Smoke ${phase}`, true, guest.editToken],
      `/e/${event.slug}`
    );
    const after = await query(
      `SELECT count(*)::int AS n FROM "PollVote" WHERE "pollOptionId" = $1`,
      [polls.multi.karaoke]
    );
    assert.equal(after[0].n, before[0].n + 1, "the vote was not stored");
  });
  await check("Potluck claim", async () => {
    await act(
      guest.guest,
      "app/actions/event/potluck.ts#claimPotluckItem",
      [potluckItem, `Smoke ${phase}`, 1, guest.editToken],
      `/e/${event.slug}`
    );
  });
  if (phase !== "baseline") await rollbackEffects(check, event);
  return check.allPassed();
}

// What a rollback does to work done on the candidate. Restores are expected to
// lose it, so these checks only report; the restore checks above are blocking.
async function rollbackEffects(check, event) {
  let after;
  try {
    after = readJson("post-upgrade.json");
  } catch {
    return;
  }
  const present = await query(`SELECT id FROM "RSVP" WHERE id = ANY($1::text[])`, [
    after.sameName.map((row) => row.id),
  ]);
  await check(
    "Responses received after the upgrade are still present",
    () => assert.equal(present.length, after.sameName.length, "lost with the restored database"),
    { blocking: false }
  );
  if (present.length !== after.sameName.length) return;
  await check(
    "Retracting one same-name vote from after the upgrade keeps the other",
    async () => {
      const count = async () =>
        (
          await query(`SELECT count(*)::int AS n FROM "PollVote" WHERE "pollOptionId" = $1`, [
            after.option,
          ])
        )[0].n;
      const start = await count();
      const [first] = after.sameName;
      const guest = createClient(APP_URL, first.guestName);
      await act(
        guest,
        "app/actions/event/rsvp.ts#verifyEventPassword",
        [event.slug, event.password, null],
        `/e/${event.slug}`
      );
      await act(
        guest,
        "app/actions/event/polls.ts#castVote",
        [after.poll, after.option, first.guestName, false, first.editToken],
        `/e/${event.slug}`
      );
      const end = await count();
      assert.equal(end, start - 1, `one retraction removed ${start - end} votes`);
    },
    { blocking: false }
  );
}

module.exports = { seed, smoke };
