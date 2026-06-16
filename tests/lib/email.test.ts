import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockSendMail = vi.fn().mockResolvedValue({ messageId: "test-id" });
const mockCreateTransport = vi.fn().mockReturnValue({ sendMail: mockSendMail });

vi.mock("nodemailer", () => ({
  default: { createTransport: mockCreateTransport },
}));

// Import after mocking
const loadModule = () => import("@/lib/email");

describe("lib/email.ts", () => {
  beforeEach(() => {
    vi.resetModules();
    mockSendMail.mockClear();
    mockCreateTransport.mockClear();
    delete process.env.SMTP_HOST;
  });

  describe("console fallback (no SMTP_HOST)", () => {
    it("logs to console instead of sending when SMTP_HOST is unset", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const { sendMagicLinkEmail } = await loadModule();
      await sendMagicLinkEmail("user@example.com", "http://localhost:3000/auth/verify?token=abc");
      expect(consoleSpy).toHaveBeenCalledWith(
        "[email:dev]",
        expect.objectContaining({ to: "user@example.com" })
      );
      expect(mockSendMail).not.toHaveBeenCalled();
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

    afterEach(() => {
      delete process.env.SMTP_HOST;
      delete process.env.SMTP_PORT;
      delete process.env.SMTP_SECURE;
      delete process.env.SMTP_USER;
      delete process.env.SMTP_PASS;
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
});
