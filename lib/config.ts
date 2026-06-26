import { cache } from "react";
import { db } from "@/lib/db";

export type ChannelConfig = { email: boolean; sms: boolean };

export const getChannelConfig = cache(async (): Promise<ChannelConfig> => {
  const rows = await db.systemConfig.findMany({
    where: { key: { in: ["email_enabled", "sms_enabled", "twilio_account_sid"] } },
  });
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));

  const emailEnabled = map["email_enabled"] !== "false";

  const twilioConfigured = !!map["twilio_account_sid"];
  const smsEnabled =
    map["sms_enabled"] !== undefined ? map["sms_enabled"] === "true" : twilioConfigured;

  return { email: emailEnabled, sms: smsEnabled };
});

export const isChannelEnabled = async (channel: "email" | "sms"): Promise<boolean> => {
  const cfg = await getChannelConfig();
  return channel === "email" ? cfg.email : cfg.sms;
};
