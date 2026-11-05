import { describe, expect, it } from "vitest";
import {
  CATEGORIES,
  PreferenceInput,
  applyTableRow,
  deliveryRoutes,
  legacySettings,
  maskDestination,
  resolvePreference,
  type Settings,
} from "@/lib/notifications/preferences";

const profile = (): Settings => ({
  channels: ["email", "sms"],
  blockedChannels: [],
  categories: [],
});
const event = (): Settings => ({ channels: [], blockedChannels: [], categories: [] });
describe("notification preference inheritance", () => {
  it.each(CATEGORIES)("checks every channel for %s by default", (category) => {
    expect(resolvePreference(category, profile())).toEqual({ channels: ["email", "sms"] });
  });
  it("resolves the event row, then the profile row, then the profile default", () => {
    const p = profile();
    p.categories.push({ category: "updates", channels: ["sms"] });
    const e = event();
    expect(resolvePreference("updates", p).channels).toEqual(["sms"]);
    expect(resolvePreference("updates", p, e).channels).toEqual(["sms"]);
    expect(resolvePreference("reminders", p, e).channels).toEqual(["email", "sms"]);
    e.categories.push({ category: "updates", channels: ["email"] });
    expect(resolvePreference("updates", p, e)).toEqual({ channels: ["email"] });
  });
  it("an empty row turns a message off, and an event row can turn it back on", () => {
    const p = profile();
    p.categories.push({ category: "updates", channels: [] });
    expect(resolvePreference("updates", p).channels).toEqual([]);
    const e = event();
    e.categories.push({ category: "updates", channels: ["sms", "email"] });
    // Registry order, whatever order was stored.
    expect(resolvePreference("updates", p, e).channels).toEqual(["email", "sms"]);
  });
  it("applies profile and event hard blocks after explicit event rows", () => {
    const p = profile();
    p.blockedChannels = ["email"];
    const e = event();
    e.blockedChannels = ["sms"];
    e.categories.push({ category: "updates", channels: ["email", "sms"] });
    expect(resolvePreference("updates", p, e).channels).toEqual([]);
  });
  it("following the profile again restores inheritance without changing profile state", () => {
    const p = profile();
    const e = event();
    e.categories.push({ category: "updates", channels: [] });
    expect(resolvePreference("updates", p, e).channels).toEqual([]);
    expect(resolvePreference("updates", p, event())).toEqual(resolvePreference("updates", p));
  });
  it.each(["EMAIL", "SMS", "BOTH"] as const)(
    "translates %s conservatively for every flag combination",
    (notificationChannel) => {
      for (const emailNotifications of [true, false])
        for (const smsNotifications of [true, false]) {
          const policy = resolvePreference(
            "updates",
            legacySettings({ notificationChannel, emailNotifications, smsNotifications })
          );
          expect(policy.channels).toEqual(
            (notificationChannel === "EMAIL"
              ? ["email"]
              : notificationChannel === "SMS"
                ? ["sms"]
                : ["email", "sms"]
            ).filter((channel) => (channel === "email" ? emailNotifications : smsNotifications))
          );
        }
    }
  );
  it("validates duplicate, unknown and foreign fields on the server", () => {
    const valid = { revision: 0, categories: [{ category: "updates", channels: ["email"] }] };
    expect(PreferenceInput.safeParse(valid).success).toBe(true);
    // An empty row turns a message off; no rows at all means "follow the profile".
    expect(
      PreferenceInput.safeParse({ ...valid, categories: [{ category: "updates", channels: [] }] })
        .success
    ).toBe(true);
    expect(PreferenceInput.safeParse({ ...valid, categories: [] }).success).toBe(true);
    for (const override of [
      { categories: [{ category: "updates", channels: ["email", "email"] }] },
      { categories: [{ category: "updates", channels: ["telegram"] }] },
      { categories: [{ category: "updates", channels: [], mode: "all" }] },
      { mode: "preferred" },
      { revision: -1 },
      { userId: "victim" },
      {
        categories: [
          { category: "updates", channels: [] },
          { category: "updates", channels: ["sms"] },
        ],
      },
    ])
      expect(PreferenceInput.safeParse({ ...valid, ...override }).success).toBe(false);
  });
  it("masks destinations for authorized DTOs", () => {
    // First and last characters keep two addresses with the same initial distinct.
    expect(maskDestination("email", "private@example.com")).toBe("p•••e@example.com");
    expect(maskDestination("email", "ab@example.com")).toBe("a•••@example.com");
    expect(maskDestination("sms", "+15551234567")).toBe("•••• 4567");
  });
});

describe("table rows", () => {
  it("writes visible channels and keeps hidden ones as they were", () => {
    // SMS is not offered right now; checking or unchecking email must not touch it.
    expect(applyTableRow(["email", "sms"], [], ["email"])).toEqual(["sms"]);
    expect(applyTableRow([], ["email"], ["email"])).toEqual(["email"]);
    expect(applyTableRow(["sms"], ["email", "sms"], ["email", "sms"])).toEqual(["email", "sms"]);
    // A channel the site doesn't offer can't be checked from the table.
    expect(applyTableRow([], ["sms"], ["email"])).toEqual([]);
  });
});

describe("delivery routes", () => {
  it("unproved contacts share one message, tried in order", () => {
    expect(deliveryRoutes(["email", "sms"])).toEqual([["email", "sms"]]);
    expect(deliveryRoutes(["email"])).toEqual([["email"]]);
    expect(deliveryRoutes([])).toEqual([]);
  });
  it("every proved contact gets its own copy", () => {
    expect(deliveryRoutes(["email", "sms"], ["email", "sms"])).toEqual([["email"], ["sms"]]);
    // A proved phone gets its own copy; the unproved email still gets one message.
    expect(deliveryRoutes(["email", "sms"], ["sms"])).toEqual([["sms"], ["email"]]);
    // Proof of a channel that isn't checked sends nothing there.
    expect(deliveryRoutes(["email"], ["sms"])).toEqual([["email"]]);
  });
});
