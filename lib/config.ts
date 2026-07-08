import { cache } from "react";
import { db } from "@/lib/db";

export type ChannelConfig = { email: boolean; sms: boolean };

export const getSystemConfigMap = cache(async (): Promise<Record<string, string>> => {
  const rows = await db.systemConfig.findMany();
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
});

export const getChannelConfig = cache(async (): Promise<ChannelConfig> => {
  const map = await getSystemConfigMap();

  const emailEnabled = map["email_enabled"] !== "false";

  const twilioConfigured = !!(map["twilio_account_sid"] || process.env.TWILIO_ACCOUNT_SID);
  const smsEnabled =
    map["sms_enabled"] !== undefined ? map["sms_enabled"] === "true" : twilioConfigured;

  return { email: emailEnabled, sms: smsEnabled };
});

export const isChannelEnabled = async (channel: "email" | "sms"): Promise<boolean> => {
  const cfg = await getChannelConfig();
  return channel === "email" ? cfg.email : cfg.sms;
};
