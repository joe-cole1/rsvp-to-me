import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSendMail = vi.fn().mockResolvedValue({ messageId: "test-id" });
const mockVerify = vi.fn().mockResolvedValue(true);
const mockCreateTransport = vi.fn().mockReturnValue({ sendMail: mockSendMail, verify: mockVerify });

vi.mock("nodemailer", () => ({
  default: { createTransport: mockCreateTransport },
}));

const mockSystemConfigFindMany = vi.fn().mockResolvedValue([]);
vi.mock("@/lib/db", () => ({
  db: {
    systemConfig: {
      findMany: () => mockSystemConfigFindMany(),
    },
  },
}));

const mockFetch = vi.fn().mockResolvedValue({
  ok: true,
  json: async () => ({ ok: true }),
  text: async () => "OK",
});
vi.stubGlobal("fetch", mockFetch);

// Import after mocking
const loadModule = () => import("@/lib/email");

describe("lib/email.ts", () => {
  beforeEach(() => {
    vi.resetModules();
    mockSendMail.mockClear();
    mockVerify.mockClear();
    mockVerify.mockResolvedValue(true);
    mockCreateTransport.mockClear();
    mockSystemConfigFindMany.mockClear();
    mockSystemConfigFindMany.mockResolvedValue([]);
    mockFetch.mockClear();

    delete process.env.SMTP_HOST;
    delete process.env.SMTP_PORT;
    delete process.env.SMTP_SECURE;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
    delete process.env.EMAIL_FROM;
    delete process.env.CLOUDFLARE_WORKER_EMAIL_URL;
    delete process.env.CLOUDFLARE_WORKER_API_SECRET;
  });

  describe("console fallback (no config)", () => {
    it("logs to console instead of sending when no provider is configured", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const { sendMagicLinkEmail } = await loadModule();
      await sendMagicLinkEmail("user@example.com", "http://localhost:3000/auth/verify?token=abc");
      expect(consoleSpy).toHaveBeenCalledWith(
        "[email:dev]",
        expect.objectContaining({ to: "user@example.com" })
      );
      expect(mockSendMail).not.toHaveBeenCalled();
      expect(mockFetch).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe("SMTP transport (SMTP_HOST set)", () => {
    beforeEach(() => {
      process.env.SMTP_HOST = "smtp.example.com";
      process.env.SMTP_PORT = "587";
      process.env.SMTP_SECURE = "false";
      process.env.SMTP_USER = "user@example.com";
      process.env.SMTP_PASS = "secret";
    });

    it("creates nodemailer transport with correct options", async () => {
      const { sendMagicLinkEmail } = await loadModule();
      await sendMagicLinkEmail("user@example.com", "http://localhost:3000/auth/verify?token=abc");
      expect(mockCreateTransport).toHaveBeenCalledWith(
        expect.objectContaining({
          host: "smtp.example.com",
          port: 587,
          secure: false,
        })
      );
    });

    it("calls sendMail with correct to and subject for magic link", async () => {
      const { sendMagicLinkEmail } = await loadModule();
      await sendMagicLinkEmail("user@example.com", "http://localhost:3000/auth/verify?token=abc");
      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "user@example.com",
          subject: "Your sign-in link for RSVP to Me",
          html: expect.stringContaining("http://localhost:3000/auth/verify?token=abc"),
        })
      );
    });

    it("sends RSVP confirmation with edit link in body", async () => {
      const { sendRsvpConfirmationEmail } = await loadModule();
      await sendRsvpConfirmationEmail("guest@example.com", {
        guestName: "Alice",
        eventTitle: "Wine Night",
        eventSlug: "wine-night",
        status: "GOING",
        editToken: "tok123",
        startAt: new Date("2026-07-04T19:00:00Z"),
      });
      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "guest@example.com",
          html: expect.stringContaining("tok123"),
        })
      );
    });

    it("sends blast email to BCC list", async () => {
      const { sendBlastEmail } = await loadModule();
      await sendBlastEmail(["a@example.com", "b@example.com"], {
        eventTitle: "Wine Night",
        eventSlug: "wine-night",
        message: "Can't wait!",
        hostName: "Bob",
      });
      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          bcc: ["a@example.com", "b@example.com"],
        })
      );
    });
  });

  describe("Cloudflare Worker transport (CLOUDFLARE_WORKER_EMAIL_URL set)", () => {
    beforeEach(() => {
      process.env.CLOUDFLARE_WORKER_EMAIL_URL = "https://email-worker.example.com";
      process.env.CLOUDFLARE_WORKER_API_SECRET = "worker-secret";
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ ok: true }),
        text: async () => "OK",
      });
    });

    it("uses Cloudflare Worker when URL is set", async () => {
      const { sendMagicLinkEmail } = await loadModule();
      await sendMagicLinkEmail("user@example.com", "http://localhost:3000/auth/verify?token=abc");
      expect(mockFetch).toHaveBeenCalledWith(
        "https://email-worker.example.com/send",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            Authorization: "Bearer worker-secret",
          }),
          body: expect.stringContaining("user@example.com"),
        })
      );
      expect(mockSendMail).not.toHaveBeenCalled();
    });

    it("falls back to SMTP when worker returns non-ok", async () => {
      process.env.SMTP_HOST = "smtp.example.com";
      mockFetch.mockResolvedValue({
        ok: false,
        json: async () => ({ ok: false }),
        text: async () => "Bad Request",
      });

      const { sendMagicLinkEmail } = await loadModule();
      await sendMagicLinkEmail("user@example.com", "http://localhost:3000/auth/verify?token=abc");

      expect(mockFetch).toHaveBeenCalled();
      expect(mockSendMail).toHaveBeenCalled();
    });
  });

  describe("Database Configuration Priority", () => {
    beforeEach(() => {
      process.env.SMTP_HOST = "smtp.example.com";
      process.env.CLOUDFLARE_WORKER_EMAIL_URL = "https://email-worker.example.com";
      process.env.CLOUDFLARE_WORKER_API_SECRET = "worker-secret";
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ ok: true }),
        text: async () => "OK",
      });
    });

    it("prioritizes database email_provider: 'cloudflare' over environment variables", async () => {
      mockSystemConfigFindMany.mockResolvedValue([
        { key: "email_provider", value: "cloudflare" },
        { key: "cloudflare_worker_email_url", value: "https://db-worker.example.com" },
        { key: "cloudflare_worker_api_secret", value: "db-secret" },
      ]);

      const { sendMagicLinkEmail } = await loadModule();
      await sendMagicLinkEmail("user@example.com", "http://localhost:3000/auth/verify?token=abc");

      expect(mockFetch).toHaveBeenCalledWith(
        "https://db-worker.example.com/send",
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "Bearer db-secret",
          }),
        })
      );
      expect(mockSendMail).not.toHaveBeenCalled();
    });

    it("prioritizes database email_provider: 'smtp' over environment variables", async () => {
      mockSystemConfigFindMany.mockResolvedValue([
        { key: "email_provider", value: "smtp" },
        { key: "smtp_host", value: "db-smtp.example.com" },
        { key: "smtp_port", value: "25" },
        { key: "smtp_secure", value: "false" },
      ]);

      const { sendMagicLinkEmail } = await loadModule();
      await sendMagicLinkEmail("user@example.com", "http://localhost:3000/auth/verify?token=abc");

      expect(mockCreateTransport).toHaveBeenCalledWith(
        expect.objectContaining({
          host: "db-smtp.example.com",
          port: 25,
        })
      );
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe("testEmailConfig", () => {
    it("handles console provider fallback", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const { testEmailConfig } = await loadModule();
      const res = await testEmailConfig("admin@example.com", {
        provider: "console",
        from: "noreply@example.com",
        smtp: { port: 587, secure: false },
        cloudflare: {},
      });
      expect(res.success).toBe(true);
      expect(consoleSpy).toHaveBeenCalledWith("[email:dev-test]", expect.any(Object));
      consoleSpy.mockRestore();
    });

    it("handles SMTP connection success", async () => {
      const { testEmailConfig } = await loadModule();
      const res = await testEmailConfig("admin@example.com", {
        provider: "smtp",
        from: "noreply@example.com",
        smtp: { host: "smtp.example.com", port: 587, secure: false, user: "u", pass: "p" },
        cloudflare: {},
      });
      expect(res.success).toBe(true);
      expect(mockVerify).toHaveBeenCalled();
      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "admin@example.com",
          subject: "Test Email from RSVP to Me",
        })
      );
    });

    it("handles SMTP connection verification failure", async () => {
      mockVerify.mockRejectedValue(new Error("Handshake failed"));
      const { testEmailConfig } = await loadModule();
      const res = await testEmailConfig("admin@example.com", {
        provider: "smtp",
        from: "noreply@example.com",
        smtp: { host: "smtp.example.com", port: 587, secure: false },
        cloudflare: {},
      });
      expect(res.success).toBe(false);
      expect(res.error).toContain("SMTP error: Handshake failed");
      expect(mockSendMail).not.toHaveBeenCalled();
    });

    it("handles SMTP message sending failure", async () => {
      mockSendMail.mockRejectedValue(new Error("SMTP send failed"));
      const { testEmailConfig } = await loadModule();
      const res = await testEmailConfig("admin@example.com", {
        provider: "smtp",
        from: "noreply@example.com",
        smtp: { host: "smtp.example.com", port: 587, secure: false },
        cloudflare: {},
      });
      expect(res.success).toBe(false);
      expect(res.error).toContain("SMTP error: SMTP send failed");
      expect(mockVerify).toHaveBeenCalled();
      expect(mockSendMail).toHaveBeenCalled();
    });

    it("handles Cloudflare Worker send success", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ ok: true }),
        text: async () => "OK",
      });
      const { testEmailConfig } = await loadModule();
      const res = await testEmailConfig("admin@example.com", {
        provider: "cloudflare",
        from: "noreply@example.com",
        smtp: { port: 587, secure: false },
        cloudflare: { url: "https://worker.example.com", secret: "secret" },
      });
      expect(res.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        "https://worker.example.com/send",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            Authorization: "Bearer secret",
          }),
          body: expect.stringContaining("admin@example.com"),
        })
      );
    });

    it("handles Cloudflare Worker status failure (e.g. 401)", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        text: async () => "Unauthorized",
      });
      const { testEmailConfig } = await loadModule();
      const res = await testEmailConfig("admin@example.com", {
        provider: "cloudflare",
        from: "noreply@example.com",
        smtp: { port: 587, secure: false },
        cloudflare: { url: "https://worker.example.com", secret: "secret" },
      });
      expect(res.success).toBe(false);
      expect(res.error).toContain("Cloudflare Worker returned status 401: Unauthorized");
    });

    it("handles Cloudflare Worker connection/fetch error", async () => {
      mockFetch.mockRejectedValue(new Error("Network Error"));
      const { testEmailConfig } = await loadModule();
      const res = await testEmailConfig("admin@example.com", {
        provider: "cloudflare",
        from: "noreply@example.com",
        smtp: { port: 587, secure: false },
        cloudflare: { url: "https://worker.example.com", secret: "secret" },
      });
      expect(res.success).toBe(false);
      expect(res.error).toContain("Failed to connect to Cloudflare Worker: Network Error");
    });
  });
});
