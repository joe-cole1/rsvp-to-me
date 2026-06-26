import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFindMany = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    systemConfig: {
      findMany: mockFindMany,
    },
  },
}));

// React.cache passes through in test environment (no request deduplication needed)
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return { ...actual, cache: (fn: unknown) => fn };
});

const loadModule = () => import("@/lib/config");

describe("lib/config.ts", () => {
  beforeEach(() => {
    vi.resetModules();
    mockFindMany.mockClear();
  });

  describe("getChannelConfig", () => {
    it("defaults email to true and sms to false when no DB rows exist", async () => {
      mockFindMany.mockResolvedValue([]);
      const { getChannelConfig } = await loadModule();
      const config = await getChannelConfig();
      expect(config).toEqual({ email: true, sms: false });
    });

    it("auto-enables sms when twilio_account_sid is present in DB", async () => {
      mockFindMany.mockResolvedValue([{ key: "twilio_account_sid", value: "ACtest" }]);
      const { getChannelConfig } = await loadModule();
      const config = await getChannelConfig();
      expect(config).toEqual({ email: true, sms: true });
    });

    it("auto-enables sms when TWILIO_ACCOUNT_SID env var is set", async () => {
      process.env.TWILIO_ACCOUNT_SID = "ACfromenv";
      mockFindMany.mockResolvedValue([]);
      const { getChannelConfig } = await loadModule();
      const config = await getChannelConfig();
      expect(config).toEqual({ email: true, sms: true });
      delete process.env.TWILIO_ACCOUNT_SID;
    });

    it("respects explicit sms_enabled=false even when twilio is configured", async () => {
      mockFindMany.mockResolvedValue([
        { key: "twilio_account_sid", value: "ACtest" },
        { key: "sms_enabled", value: "false" },
      ]);
      const { getChannelConfig } = await loadModule();
      const config = await getChannelConfig();
      expect(config).toEqual({ email: true, sms: false });
    });

    it("respects explicit sms_enabled=true even without twilio credentials", async () => {
      mockFindMany.mockResolvedValue([{ key: "sms_enabled", value: "true" }]);
      const { getChannelConfig } = await loadModule();
      const config = await getChannelConfig();
      expect(config.sms).toBe(true);
    });

    it("respects email_enabled=false", async () => {
      mockFindMany.mockResolvedValue([{ key: "email_enabled", value: "false" }]);
      const { getChannelConfig } = await loadModule();
      const config = await getChannelConfig();
      expect(config.email).toBe(false);
    });

    it("allows both channels disabled simultaneously", async () => {
      mockFindMany.mockResolvedValue([
        { key: "email_enabled", value: "false" },
        { key: "sms_enabled", value: "false" },
      ]);
      const { getChannelConfig } = await loadModule();
      const config = await getChannelConfig();
      expect(config).toEqual({ email: false, sms: false });
    });
  });

  describe("isChannelEnabled", () => {
    it("returns true for email when email_enabled is not set", async () => {
      mockFindMany.mockResolvedValue([]);
      const { isChannelEnabled } = await loadModule();
      expect(await isChannelEnabled("email")).toBe(true);
    });

    it("returns false for email when email_enabled=false", async () => {
      mockFindMany.mockResolvedValue([{ key: "email_enabled", value: "false" }]);
      const { isChannelEnabled } = await loadModule();
      expect(await isChannelEnabled("email")).toBe(false);
    });

    it("returns false for sms when no twilio and no explicit override", async () => {
      mockFindMany.mockResolvedValue([]);
      const { isChannelEnabled } = await loadModule();
      expect(await isChannelEnabled("sms")).toBe(false);
    });

    it("returns true for sms when twilio_account_sid is present", async () => {
      mockFindMany.mockResolvedValue([{ key: "twilio_account_sid", value: "ACtest" }]);
      const { isChannelEnabled } = await loadModule();
      expect(await isChannelEnabled("sms")).toBe(true);
    });
  });
});
