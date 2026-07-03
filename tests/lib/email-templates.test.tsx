import { describe, it, expect } from "vitest";
import { renderEmail, substitutePlaceholders, splitParagraphs } from "@/emails/render";
import {
  buildSampleEmail,
  EMAIL_TEMPLATE_META,
  mergedToggles,
  TEMPLATE_IDS,
} from "@/emails/registry";
import { InviteEmail } from "@/emails/templates/InviteEmail";
import { sampleEventDetails } from "@/emails/registry";
import { DEFAULT_TOGGLES } from "@/emails/types";
import { resolveEmailTheme, appShellEmailTheme } from "@/lib/email-theme";

const theme = resolveEmailTheme(null);

describe("emails/render.ts helpers", () => {
  it("substitutes known placeholders and leaves unknown ones literal", () => {
    expect(substitutePlaceholders("Hi {guestName} — {unknown}", { guestName: "Alex" })).toBe(
      "Hi Alex — {unknown}"
    );
  });

  it("splits body copy into trimmed non-empty paragraphs", () => {
    expect(splitParagraphs("one\n\n  two  \r\nthree\n")).toEqual(["one", "two", "three"]);
  });
});

describe("email templates", () => {
  it("renders every template with html, plain text, and color-scheme metas", async () => {
    for (const id of TEMPLATE_IDS) {
      const { subject, element } = buildSampleEmail(id, theme);
      const { html, text } = await renderEmail(element);
      expect(subject.length, id).toBeGreaterThan(0);
      expect(subject, id).not.toContain("{");
      expect(html, id).toContain('name="color-scheme"');
      expect(html, id).toContain('name="supported-color-schemes"');
      expect(text.length, id).toBeGreaterThan(10);
    }
  });

  it("invite contains RSVP status links, event link, and calendar/map links", async () => {
    const { element } = buildSampleEmail("invite", theme);
    const { html, text } = await renderEmail(element);
    expect(html).toContain("status=GOING");
    expect(html).toContain("status=MAYBE");
    expect(html).toContain("status=NO");
    expect(html).toContain("/e/sample-event");
    expect(html).toContain("calendar.google.com/calendar/render");
    expect(html).toContain("/e/sample-event/calendar.ics");
    expect(html).toContain("google.com/maps/search");
    expect(text).toContain("status=GOING");
  });

  it("invite omits the Maybe link when maybeEnabled is false", async () => {
    const event = sampleEventDetails();
    const element = (
      <InviteEmail
        theme={theme}
        body="Hey!"
        toggles={DEFAULT_TOGGLES}
        event={event}
        hostName="Joe"
        rsvpBaseUrl="http://localhost:3000/e/sample-event/rsvp?invite=x"
        maybeEnabled={false}
        eventUrl="http://localhost:3000/e/sample-event"
      />
    );
    const { html } = await renderEmail(element);
    expect(html).toContain("status=GOING");
    expect(html).not.toContain("status=MAYBE");
  });

  it("structural toggles hide their blocks", async () => {
    const off = {
      showCalendarLinks: false,
      showMapLink: false,
      showHostFlourish: false,
      showCoverImage: false,
    };
    const { element } = buildSampleEmail("invite", theme, off);
    const { html } = await renderEmail(element);
    expect(html).not.toContain("calendar.google.com");
    expect(html).not.toContain("google.com/maps/search");
    expect(html).not.toContain("Hosted by");
  });

  it("renders the cover image only when the theme has one and the toggle is on", async () => {
    const themed = resolveEmailTheme({
      baseTheme: "DARK",
      gradientFrom: "#7c3aed",
      gradientTo: "#1e40af",
      accentColor: "#a855f7",
      coverImageUrl: "/api/uploads/cover.jpg",
    });
    const on = await renderEmail(buildSampleEmail("invite", themed).element);
    expect(on.html).toContain("http://localhost:3000/api/uploads/cover.jpg");
    const off = await renderEmail(
      buildSampleEmail("invite", themed, { showCoverImage: false }).element
    );
    expect(off.html).not.toContain("/api/uploads/cover.jpg");
  });

  it("escapes HTML in admin-provided copy (structural XSS protection)", async () => {
    const { element } = buildSampleEmail("invite", theme, {
      body: 'Hey {guestName} <script>alert("x")</script>',
    });
    const { html } = await renderEmail(element);
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("confirmation contains the edit-token link and status heading", async () => {
    const { element } = buildSampleEmail("rsvpConfirmation", theme);
    const { html, text } = await renderEmail(element);
    expect(html).toContain("rsvp?token=sample-token");
    // html-to-text uppercases headings in the plain-text part
    expect(text.toUpperCase()).toContain("YOU'RE GOING!");
  });

  it("magic link and welcome render the sign-in URL in html and text parts", async () => {
    for (const id of ["magicLink", "welcome"] as const) {
      const { element } = buildSampleEmail(id, appShellEmailTheme());
      const { html, text } = await renderEmail(element);
      expect(html, id).toContain("/auth/verify?token=sample-token");
      expect(text, id).toContain("/auth/verify?token=sample-token");
    }
  });
});

describe("registry metadata", () => {
  it("covers all template ids with defaults", () => {
    for (const id of TEMPLATE_IDS) {
      const meta = EMAIL_TEMPLATE_META[id];
      expect(meta.id).toBe(id);
      expect(meta.defaultSubject.length).toBeGreaterThan(0);
      if (meta.bodyEditable) expect(meta.defaultBody.length).toBeGreaterThan(0);
    }
  });

  it("mergedToggles only honors overrides for applicable toggles", () => {
    const t = mergedToggles("hostRsvpAlert", { showCoverImage: false });
    expect(t.showCoverImage).toBe(true); // not applicable to this template
    const inv = mergedToggles("invite", { showCoverImage: false });
    expect(inv.showCoverImage).toBe(false);
  });
});
