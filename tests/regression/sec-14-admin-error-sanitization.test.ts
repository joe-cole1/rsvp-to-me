// SEC-14 — Verbose errors disclosed in admin config test actions.
//
// Bug (found 2026-07, security review): testEmailConfig and testSmsConfig surfaced
//   raw provider error messages (e.g. SMTP socket connection traces, raw Twilio API error messages)
//   directly to the admin client. This could leak infrastructure details or config shapes.
//
// Fix: testEmailConfig and testSmsConfig log raw error details to the server console,
//   but return sanitized, high-level user-friendly error messages to the client.

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock nodemailer
const mockVerify = vi.fn();
const mockSendMail = vi.fn();
vi.mock("nodemailer", () => ({
  default: {
    createTransport: vi.fn(() => ({
      verify: mockVerify,
      sendMail: mockSendMail,
    })),
  },
}));

// Mock twilio
const mockMessagesCreate = vi.fn();
vi.mock("twilio", () => ({
  default: vi.fn(() => ({
    messages: {
      create: mockMessagesCreate,
    },
  })),
}));

// Mock react-email render
vi.mock("@/emails/render", () => ({
  renderEmail: vi.fn(async () => ({ html: "<p>test</p>", text: "test" })),
  substitutePlaceholders: vi.fn((str) => str),
}));

// Mock config/systemConfig
vi.mock("@/lib/config", () => ({
  getSystemConfigMap: vi.fn().mockResolvedValue({}),
  isChannelEnabled: vi.fn().mockResolvedValue(true),
}));

import { testEmailConfig } from "@/lib/email";
import { testSmsConfig } from "@/lib/sms";

describe("SEC-14: Verbose error sanitization in admin test config actions", () => {
  beforeEach(() => {
    mockVerify.mockReset();
    mockSendMail.mockReset();
    mockMessagesCreate.mockReset();
  });

  it("sanitizes raw SMTP connection and verification errors", async () => {
    // nodemailer verify throws a raw verbose socket connection error
    mockVerify.mockRejectedValue(
      new Error("connect ECONNREFUSED 10.15.2.9:25\n at TCPConnectWrap.afterConnect")
    );

    const result = await testEmailConfig("admin@example.com", {
      provider: "smtp",
      from: "noreply@example.com",
      smtp: {
        host: "smtp.internal.local",
        port: 25,
        secure: false,
      },
      cloudflare: {},
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe(
      "SMTP connection failed. Check your host, port, credentials, and network settings."
    );
  });

  it("sanitizes raw Twilio API error messages", async () => {
    // Twilio client throws a verbose API exception
    mockMessagesCreate.mockRejectedValue(
      new Error(
        "Unable to create record: Authenticity check failed for SID AC12345. Stack trace: TW9981"
      )
    );

    const result = await testSmsConfig("1234567890", {
      sid: "AC12345",
      token: "secret",
      phone: "1987654321",
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe(
      "Twilio request failed. Verify your Account SID, Auth Token, and Phone number."
    );
  });
});
