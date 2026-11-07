// @vitest-environment jsdom
// Root cause: extracting trimmed guide fragments removed the spaces before
// inline provider labels, joining words such as "UnderPermissions" in both locales.
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "../components/render";
import dutch from "@/messages/nl-NL.json";
import { EmailTab } from "@/app/(app)/admin/tabs/EmailTab";

vi.mock("@/app/(app)/admin/tabs/EmailTemplatesSection", () => ({
  EmailTemplatesSection: () => null,
}));

function props(emailProvider: string): ComponentProps<typeof EmailTab> {
  const setter = vi.fn();
  return {
    config: {},
    handleToggleEmailEnabled: setter,
    handleSaveEmailConfig: setter,
    emailProvider,
    setEmailProvider: setter,
    emailFrom: "RSVP <rsvp@example.com>",
    setEmailFrom: setter,
    smtpHost: "",
    setSmtpHost: setter,
    smtpPort: "587",
    setSmtpPort: setter,
    smtpSecure: false,
    setSmtpSecure: setter,
    smtpUser: "",
    setSmtpUser: setter,
    smtpPass: "",
    setSmtpPass: setter,
    cfAccountId: "",
    setCfAccountId: setter,
    cfApiToken: "",
    setCfApiToken: setter,
    cfWorkerUrl: "",
    setCfWorkerUrl: setter,
    suggestedSubdomain: "example",
    cfWorkerSecret: "",
    setCfWorkerSecret: setter,
    secretCopied: false,
    setSecretCopied: setter,
    cfInboundForwardTo: "admin@example.com",
    setCfInboundForwardTo: setter,
    copied: false,
    setCopied: setter,
    showCode: false,
    setShowCode: setter,
    isPending: false,
    isTestingEmail: false,
    handleTestEmailConfig: vi.fn(async () => {}),
  };
}

const cases = [
  {
    locale: "en-US" as const,
    messages: undefined,
    setup: "Email Setup",
    permission: "Under Permissions, select:",
    variables: "Under the Environment Variables table:",
    bindings: "Scroll down to the Bindings section on the same page:",
    route: ", and click Add Route:",
    fallback:
      "Click Add variable again: set Name to INBOUND_FORWARD_TO, leave Type as Text, and paste your Admin Fallback Email (e.g. admin@example.com).",
  },
  {
    locale: "nl-NL" as const,
    messages: dutch,
    setup: "E-mailinstellingen",
    permission: "Onder Permissions, kies:",
    variables: "Onder de Environment Variables tabel:",
    bindings: "Scrol naar de Bindings sectie op dezelfde pagina:",
    route: ", en klik op Add Route:",
    fallback:
      "Klik op Add variable opnieuw: stel Name in op INBOUND_FORWARD_TO, laat Type staan op Text, en plak je terugvaladres voor beheerder (bijvoorbeeld admin@example.com).",
  },
];
function readable(element: Element): string {
  return element.textContent?.replace(/\s+/g, " ").trim() ?? "";
}

describe("localized admin email guide spacing", () => {
  it.each(cases)("translates both section subtitles in $locale", ({ locale, messages }) => {
    render(<EmailTab {...props("cloudflare_api")} />, { locale, messages });
    const setupSubtitle =
      locale === "en-US"
        ? "Guest notifications toggle, delivery provider, and connection test"
        : "Gastmeldingen in- of uitschakelen, bezorgprovider en verbindingstest";
    const templatesSubtitle =
      locale === "en-US"
        ? "Customize copy and content blocks, preview each themed email, and send yourself a test"
        : "Pas tekst en inhoudsblokken aan, bekijk e-mails met elk thema en stuur jezelf een testmail";
    expect(screen.getByText(setupSubtitle).textContent).toBe(setupSubtitle);
    expect(screen.getByText(templatesSubtitle).textContent).toBe(templatesSubtitle);
  });
  it.each(cases)(
    "separates API guide provider labels in $locale",
    ({ locale, messages, setup, permission }) => {
      const { container } = render(<EmailTab {...props("cloudflare_api")} />, { locale, messages });
      fireEvent.click(screen.getByRole("button", { name: new RegExp(setup) }));
      const instruction = [...container.querySelectorAll("li")].find((item) =>
        readable(item).startsWith(permission)
      );
      expect(instruction).toBeDefined();
    }
  );

  it.each(cases)(
    "separates worker guide labels in $locale",
    ({ locale, messages, setup, variables, bindings, route, fallback }) => {
      const { container } = render(<EmailTab {...props("cloudflare")} />, { locale, messages });
      fireEvent.click(screen.getByRole("button", { name: new RegExp(setup) }));
      const instructions = [...container.querySelectorAll("li")].map(readable);
      expect(instructions.some((text) => text.startsWith(variables))).toBe(true);
      expect(instructions.some((text) => text.startsWith(bindings))).toBe(true);
      expect(instructions.some((text) => text.includes(route))).toBe(true);
      expect(instructions).toContain(fallback);
    }
  );
});
