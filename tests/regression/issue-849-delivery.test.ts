// #849 root cause: legacy sends treated failed Cloudflare sends and console-only
// production handling as success, and retried potentially accepted submissions.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({
  config: {} as Record<string, string>,
  send: vi.fn(),
  fetch: vi.fn(),
}));
vi.mock("@/lib/config", () => ({
  getSystemConfigMap: async () => m.config,
  isChannelEnabled: async () => true,
}));
vi.mock("nodemailer", () => ({
  default: { createTransport: () => ({ sendMail: m.send, close: vi.fn() }) },
}));
import { sendRenderedEmail } from "@/lib/email";
import { encryptConfig } from "@/lib/crypto";
const mail = { to: "guest@example.test", subject: "Private", html: "private-token" };
beforeEach(() => {
  vi.clearAllMocks();
  for (const key of [
    "SMTP_HOST",
    "SMTP_USER",
    "SMTP_PASS",
    "CLOUDFLARE_WORKER_EMAIL_URL",
    "CLOUDFLARE_WORKER_API_SECRET",
    "CLOUDFLARE_ACCOUNT_ID",
    "CLOUDFLARE_API_TOKEN",
  ])
    vi.stubEnv(key, "");
  vi.stubGlobal("fetch", m.fetch);
  vi.spyOn(console, "warn").mockImplementation(() => {});
  m.config = {
    email_provider: "cloudflare",
    cloudflare_worker_email_url: "https://worker.example.test",
    cloudflare_worker_api_secret: encryptConfig("fixture-secret"),
  };
  m.send.mockResolvedValue({ accepted: [mail.to], rejected: [] });
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
describe("#849 email acknowledgement", () => {
  it("returns acceptance only after the worker acknowledges it", async () => {
    m.fetch.mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
    await expect(sendRenderedEmail(mail)).resolves.toEqual({ status: "accepted" });
  });
  it.each([400, 401, 422])(
    "surfaces a definitive HTTP %s rejection without SMTP",
    async (status) => {
      m.fetch.mockResolvedValue({
        ok: false,
        status,
        text: async () => "private provider details",
      });
      await expect(sendRenderedEmail(mail)).rejects.toMatchObject({
        outcome: { status: "failed" },
      });
      expect(m.send).not.toHaveBeenCalled();
    }
  );
  it("permits configured SMTP fallback after explicit rejection", async () => {
    m.config.smtp_host = "smtp.example.test";
    m.fetch.mockResolvedValue({ ok: false, status: 401 });
    await expect(sendRenderedEmail(mail)).resolves.toEqual({ status: "accepted" });
    expect(m.send).toHaveBeenCalledTimes(1);
  });
  it.each([408, 500, 502])("never repeats uncertain HTTP %s through SMTP", async (status) => {
    m.config.smtp_host = "smtp.example.test";
    m.fetch.mockResolvedValue({ ok: false, status });
    await expect(sendRenderedEmail(mail)).rejects.toMatchObject({
      outcome: { status: "uncertain" },
    });
    expect(m.send).not.toHaveBeenCalled();
  });
  it.each([{}, { ok: false }, null])(
    "rejects missing or negative acknowledgements: %j",
    async (ack) => {
      m.fetch.mockResolvedValue({ ok: true, json: async () => ack });
      await expect(sendRenderedEmail(mail)).rejects.toMatchObject({
        outcome: { status: "uncertain" },
      });
    }
  );
  it("keeps network errors private and prevents fallback", async () => {
    m.config.smtp_host = "smtp.example.test";
    m.fetch.mockRejectedValue(new Error("private-token guest@example.test"));
    await expect(sendRenderedEmail(mail)).rejects.toThrow("Email delivery could not be confirmed");
    expect(m.send).not.toHaveBeenCalled();
  });
  it("times out a stalled HTTP submission without retrying", async () => {
    vi.useFakeTimers();
    try {
      m.config.smtp_host = "smtp.example.test";
      m.fetch.mockImplementation(
        (_url, opts) =>
          new Promise((_resolve, reject) =>
            opts.signal.addEventListener("abort", () => reject(new Error("aborted")))
          )
      );
      const result = expect(sendRenderedEmail(mail)).rejects.toMatchObject({
        outcome: { status: "uncertain" },
      });
      await vi.advanceTimersByTimeAsync(30001);
      await result;
      expect(m.send).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
  it("requires the REST API's success acknowledgement", async () => {
    m.config = {
      email_provider: "cloudflare_api",
      cloudflare_account_id: "fixture",
      cloudflare_api_token: encryptConfig("fixture-secret"),
    };
    m.fetch.mockResolvedValue({ ok: true, json: async () => ({ success: false }) });
    await expect(sendRenderedEmail(mail)).rejects.toMatchObject({
      outcome: { status: "uncertain" },
    });
    m.fetch.mockResolvedValue({ ok: true, json: async () => ({ success: true }) });
    await expect(sendRenderedEmail(mail)).resolves.toEqual({ status: "accepted" });
  });
  it("does not claim success without SMTP recipient acceptance", async () => {
    m.config = { email_provider: "smtp", smtp_host: "smtp.example.test" };
    m.send.mockResolvedValue({ accepted: [], rejected: [] });
    await expect(sendRenderedEmail(mail)).rejects.toMatchObject({
      outcome: { status: "uncertain" },
    });
  });
  it("fails safely when production has no transport", async () => {
    vi.stubEnv("NODE_ENV", "production");
    m.config = { email_provider: "console" };
    await expect(sendRenderedEmail(mail)).rejects.toMatchObject({ outcome: { status: "failed" } });
    expect(JSON.stringify(vi.mocked(console.warn).mock.calls)).not.toContain("private-token");
  });
});
