import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockFetch = vi.fn();

const mockFindMany = vi.fn();
vi.mock("@/lib/db", () => ({
  db: {
    systemConfig: {
      findMany: () => mockFindMany(),
    },
  },
}));

const loadModule = () => import("@/lib/sms");

function successfulTwilioResponse() {
  return new Response(JSON.stringify({ sid: "SM123" }), {
    status: 201,
    headers: { "Content-Type": "application/json" },
  });
}

function getTwilioRequest(index = 0) {
  const [url, init] = mockFetch.mock.calls[index] as [string, RequestInit];
  return {
    url,
    init,
    form: init.body as URLSearchParams,
  };
}

describe("lib/sms.ts", () => {
  beforeEach(() => {
    vi.resetModules();
    mockFetch.mockReset();
    mockFetch.mockImplementation(() => Promise.resolve(successfulTwilioResponse()));
    vi.stubGlobal("fetch", mockFetch);
    // Default: SMS channel enabled so tests exercise SMS logic, not the gate
    mockFindMany.mockResolvedValue([{ key: "sms_enabled", value: "true" }]);
    delete process.env.TWILIO_ACCOUNT_SID;
    delete process.env.TWILIO_AUTH_TOKEN;
    delete process.env.TWILIO_PHONE_NUMBER;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
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
      expect(consoleSpy).toHaveBeenCalledWith(
        "[sms:dev]",
        expect.objectContaining({ to: "+15550001111" })
      );
      expect(mockFetch).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe("Twilio REST API (credentials set)", () => {
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

    it("posts the expected authenticated form to the Twilio Messages API", async () => {
      const { sendRsvpConfirmationSms } = await loadModule();
      await sendRsvpConfirmationSms("+15550001111", {
        guestName: "Alice",
        eventTitle: "Wine Night",
        eventSlug: "wine-night",
        status: "GOING",
        editToken: "tok123",
      });

      const { url, init, form } = getTwilioRequest();
      expect(url).toBe("https://api.twilio.com/2010-04-01/Accounts/ACtest/Messages.json");
      expect(init.method).toBe("POST");
      expect(init.headers).toEqual({
        Authorization: `Basic ${Buffer.from("ACtest:authtest").toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      });
      expect(form).toBeInstanceOf(URLSearchParams);
      expect(form.get("To")).toBe("+15550001111");
      expect(form.get("From")).toBe("+15559999999");
      expect(form.get("Body")).toContain("Wine Night");
    });

    it("sendSmsBlast sends to all numbers and returns count", async () => {
      const { sendSmsBlast } = await loadModule();
      const count = await sendSmsBlast(["+15550001111", "+15550002222"], {
        eventTitle: "Wine Night",
        eventSlug: "wine-night",
        message: "See you there!",
        hostName: "Bob",
      });
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(count).toBe(2);
    });

    it("sendSmsBlast still returns count even if some messages fail", async () => {
      const { sendSmsBlast } = await loadModule();
      mockFetch
        .mockResolvedValueOnce(new Response("Unauthorized", { status: 401 }))
        .mockResolvedValueOnce(successfulTwilioResponse());
      const count = await sendSmsBlast(["+15550001111", "+15550002222"], {
        eventTitle: "Wine Night",
        eventSlug: "wine-night",
        message: "Still happening!",
        hostName: "Bob",
      });
      expect(count).toBe(2);
    });

    it("testSmsConfig sends message successfully", async () => {
      const { testSmsConfig } = await loadModule();
      const res = await testSmsConfig("+15551112222", {
        sid: "ACtest",
        token: "authtest",
        phone: "+15559999999",
      });
      expect(res.success).toBe(true);
      const { form } = getTwilioRequest();
      expect(form.get("From")).toBe("+15559999999");
      expect(form.get("To")).toBe("+15551112222");
      expect(form.get("Body")).toContain("RSVP to Me");
    });

    it("testSmsConfig returns error if missing config fields", async () => {
      const { testSmsConfig } = await loadModule();
      const res = await testSmsConfig("+15551112222", {
        sid: "",
        token: "authtest",
        phone: "",
      });
      expect(res.success).toBe(false);
      expect(res.error).toContain("required");
    });

    it("testSmsConfig returns error if Twilio rejects the request", async () => {
      mockFetch.mockResolvedValueOnce(new Response("Unauthorized", { status: 401 }));
      const { testSmsConfig } = await loadModule();
      const res = await testSmsConfig("+15551112222", {
        sid: "ACtest",
        token: "authtest",
        phone: "+15559999999",
      });
      expect(res.success).toBe(false);
      expect(res.error).toBe(
        "Twilio request failed. Verify your Account SID, Auth Token, and Phone number."
      );
    });

    it("sendMagicLinkSms sends correct body", async () => {
      const { sendMagicLinkSms } = await loadModule();
      await sendMagicLinkSms("+15551112222", "http://magic-link");
      const { form } = getTwilioRequest();
      expect(form.get("To")).toBe("+15551112222");
      expect(form.get("Body")).toContain("http://magic-link");
    });

    it("sendApprovalSms sends approved or declined message", async () => {
      const { sendApprovalSms } = await loadModule();
      await sendApprovalSms("+15551112222", {
        eventTitle: "Wine Night",
        approved: true,
        message: "Welcome!",
      });
      expect(getTwilioRequest().form.get("To")).toBe("+15551112222");
      expect(getTwilioRequest().form.get("Body")).toContain("approved");

      await sendApprovalSms("+15551112222", { eventTitle: "Wine Night", approved: false });
      expect(getTwilioRequest(1).form.get("To")).toBe("+15551112222");
      expect(getTwilioRequest(1).form.get("Body")).toContain("declined");
    });
  });
});
