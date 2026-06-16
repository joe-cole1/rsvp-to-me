import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockCreate = vi.fn().mockResolvedValue({ sid: "SM123" });
const mockTwilio = vi.fn().mockReturnValue({
  messages: { create: mockCreate },
});

vi.mock("twilio", () => ({ default: mockTwilio }));

const loadModule = () => import("@/lib/sms");

describe("lib/sms.ts", () => {
  beforeEach(() => {
    vi.resetModules();
    mockCreate.mockClear();
    mockTwilio.mockClear();
    delete process.env.TWILIO_ACCOUNT_SID;
    delete process.env.TWILIO_AUTH_TOKEN;
    delete process.env.TWILIO_PHONE_NUMBER;
  });

  describe("console fallback (no Twilio credentials)", () => {
    it("logs to console when Twilio env vars are unset", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const { sendRsvpConfirmationSms } = await loadModule();
      await sendRsvpConfirmationSms("+15550001111", {
        guestName: "Alice",
        eventTitle: "Wine Night",
        eventSlug: "wine-night",
        status: "GOING",
        editToken: "tok123",
      });
      expect(consoleSpy).toHaveBeenCalledWith("[sms:dev]", expect.objectContaining({ to: "+15550001111" }));
      expect(mockCreate).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe("Twilio client (credentials set)", () => {
    beforeEach(() => {
      process.env.TWILIO_ACCOUNT_SID = "ACtest";
      process.env.TWILIO_AUTH_TOKEN = "authtest";
      process.env.TWILIO_PHONE_NUMBER = "+15559999999";
    });

    afterEach(() => {
      delete process.env.TWILIO_ACCOUNT_SID;
      delete process.env.TWILIO_AUTH_TOKEN;
      delete process.env.TWILIO_PHONE_NUMBER;
    });

    it("calls Twilio messages.create with correct params", async () => {
      const { sendRsvpConfirmationSms } = await loadModule();
      await sendRsvpConfirmationSms("+15550001111", {
        guestName: "Alice",
        eventTitle: "Wine Night",
        eventSlug: "wine-night",
        status: "GOING",
        editToken: "tok123",
      });
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "+15550001111",
          from: "+15559999999",
          body: expect.stringContaining("Wine Night"),
        })
      );
    });

    it("sendSmsBlast sends to all numbers and returns count", async () => {
      const { sendSmsBlast } = await loadModule();
      mockCreate.mockResolvedValue({ sid: "SM123" });
      const count = await sendSmsBlast(["+15550001111", "+15550002222"], {
        eventTitle: "Wine Night",
        eventSlug: "wine-night",
        message: "See you there!",
        hostName: "Bob",
      });
      expect(mockCreate).toHaveBeenCalledTimes(2);
      expect(count).toBe(2);
    });

    it("sendSmsBlast still returns count even if some messages fail", async () => {
      const { sendSmsBlast } = await loadModule();
      mockCreate.mockRejectedValueOnce(new Error("Twilio error")).mockResolvedValueOnce({ sid: "SM999" });
      const count = await sendSmsBlast(["+15550001111", "+15550002222"], {
        eventTitle: "Wine Night",
        eventSlug: "wine-night",
        message: "Still happening!",
        hostName: "Bob",
      });
      expect(count).toBe(2);
    });
  });
});
