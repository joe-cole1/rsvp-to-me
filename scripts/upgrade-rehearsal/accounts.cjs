// Disposable, test-only provider settings for the upgrade rehearsal. They are
// valid only for the capture transport on the rehearsal's internal network; no
// real provider is reachable from there.
module.exports = {
  // Saved through the baseline's admin settings, so the upgrade must convert them.
  smtp: {
    host: "smtp-capture",
    port: "2525",
    user: "saved-smtp@rehearsal.invalid",
    pass: "rehearsal-saved-smtp-pass",
  },
  twilio: {
    // Not hexadecimal, so it cannot be mistaken for a real Account SID.
    sid: "ACrehearsaltestaccount00000000918",
    token: "rehearsal-saved-twilio-token",
    phone: "+15005550006",
  },
  // Stored but inactive: they exercise conversion of every secret setting.
  cloudflare: {
    workerSecret: "rehearsal-inactive-worker-secret",
    apiToken: "rehearsal-inactive-api-token",
  },
};
