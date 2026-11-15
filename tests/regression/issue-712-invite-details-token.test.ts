/**
 * #712 (2026-10-12): invitation details links lost the recipient's RSVP context.
 * Root cause: sendEventInviteEmail built a generic event URL instead of carrying
 * the edit token already supplied in the recipient's RSVP URL.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { sendMail } = vi.hoisted(() => ({
  sendMail: vi.fn().mockImplementation(async (mail: { to: string }) => ({
    messageId: "issue-712-test",
    accepted: [mail.to],
    rejected: [],
  })),
}));

vi.mock("nodemailer", () => ({
  default: { createTransport: () => ({ sendMail }) },
}));
vi.mock("@/lib/db", () => ({
  db: {
    systemConfig: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(null),
    },
  },
}));

interface DeliveredEmail {
  to: string;
  html: string;
  text: string;
}

const origin = "https://invite.example.com";
const slug = "birthday-party";

async function invite(token: string | undefined, maybeEnabled = true, to = "alice@example.com") {
  const { sendEventInviteEmail } = await import("@/lib/email");
  const rsvpUrl = new URL(`${origin}/e/${slug}/rsvp`);
  if (token !== undefined) rsvpUrl.searchParams.set("token", token);
  await sendEventInviteEmail(to, {
    locale: "en-US",
    guestName: "Alice",
    hostName: "Bob",
    eventTitle: "Birthday Party",
    eventSlug: slug,
    startAt: new Date("2026-11-01T12:00:00Z"),
    rsvpBaseUrl: rsvpUrl.toString(),
    maybeEnabled,
  });
  return sendMail.mock.calls.at(-1)![0] as DeliveredEmail;
}

function expectRecipientLinks(mail: DeliveredEmail, token: string, maybeEnabled: boolean) {
  const expectedDetails = new URL(`${origin}/e/${slug}`);
  expectedDetails.searchParams.set("token", token);
  const hrefs = [...mail.html.matchAll(/href="([^"]+)"/g)].map((match) =>
    match[1].replaceAll("&amp;", "&")
  );
  expect(hrefs).toContain(expectedDetails.toString());
  expect(mail.text).toContain(expectedDetails.toString());
  const statusLinks = hrefs.filter((href) => new URL(href).searchParams.has("status"));
  expect(statusLinks.map((href) => new URL(href).searchParams.get("status"))).toEqual(
    maybeEnabled ? ["GOING", "MAYBE", "NO"] : ["GOING", "NO"]
  );
  for (const href of statusLinks) {
    expect(new URL(href).searchParams.get("token")).toBe(token);
    expect(mail.text).toContain(href);
  }
}

describe("#712 invitation details preserve recipient RSVP tokens", () => {
  beforeEach(() => {
    vi.resetModules();
    sendMail.mockClear();
    vi.stubEnv("NEXT_PUBLIC_APP_URL", origin);
    vi.stubEnv("SMTP_HOST", "smtp.example.com");
    vi.stubEnv("CLOUDFLARE_WORKER_EMAIL_URL", "");
    vi.stubEnv("CLOUDFLARE_WORKER_API_SECRET", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.each([true, false])("preserves the token with Maybe enabled=%s", async (maybeEnabled) => {
    expectRecipientLinks(
      await invite("recipient-token", maybeEnabled),
      "recipient-token",
      maybeEnabled
    );
  });

  it("round-trips URL-encoded token characters", async () => {
    const token = "recipient+token/with?reserved=&characters";
    expectRecipientLinks(await invite(token), token, true);
  });

  it("keeps different recipients' tokens separate", async () => {
    const first = await invite("alice-token");
    const second = await invite("carol-token", true, "carol@example.com");
    expect(first.to).toBe("alice@example.com");
    expect(second.to).toBe("carol@example.com");
    expectRecipientLinks(first, "alice-token", true);
    expectRecipientLinks(second, "carol-token", true);
    expect(second.html).not.toContain("alice-token");
    expect(second.text).not.toContain("alice-token");
  });

  it("keeps a generic event link when the valid RSVP URL has no token", async () => {
    const mail = await invite(undefined);
    expect(mail.html).toContain(`href="${origin}/e/${slug}"`);
    expect(mail.text).toContain(`${origin}/e/${slug}`);
    expect(mail.html).not.toContain("token=");
  });
});
