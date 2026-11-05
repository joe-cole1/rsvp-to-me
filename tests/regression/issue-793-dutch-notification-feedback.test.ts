// Root cause (#793, November 2026): the Dutch catalog omitted all four event-update
// delivery-feedback messages, so the catalog loader silently fell back to English.
import { describe, expect, it } from "vitest";
import { createTranslator } from "next-intl";
import { loadMessages } from "@/i18n/catalogs";
import english from "@/messages/en-US.json";
import dutch from "@/messages/nl-NL.json";

const englishFeedback = english.Ui.Event.NotificationDeliveryFeedback;
const keys = Object.keys(englishFeedback) as (keyof typeof englishFeedback)[];

describe("#793 Dutch event-update delivery feedback", () => {
  it.each(keys)("ships a native Dutch %s message without relying on fallback", (key) => {
    const message = dutch.Ui.Event.NotificationDeliveryFeedback?.[key];

    expect(message).toBeTypeOf("string");
    expect(message?.trim()).not.toBe("");
    expect(message).not.toBe(englishFeedback[key]);
  });

  it("formats all four delivery counts in the selected Dutch catalog", async () => {
    const t = createTranslator({
      locale: "nl-NL",
      messages: await loadMessages("nl-NL"),
      namespace: "Ui.Event.NotificationDeliveryFeedback",
    });

    expect(t("summary", { accepted: 2, skipped: 3, failed: 5, uncertain: 7 })).toBe(
      "Mededeling geplaatst. Meldingen: 2 geaccepteerd, 3 overgeslagen, 5 mislukt, 7 onzeker."
    );
  });
});
