import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSendMail = vi.fn().mockResolvedValue({ messageId: "test-id" });
const mockCreateTransport = vi.fn().mockReturnValue({ sendMail: mockSendMail });

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
});
