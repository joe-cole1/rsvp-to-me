"use server";

import { createElement } from "react";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { rateLimit } from "@/lib/rateLimit";
import { resolveEmailTheme } from "@/lib/email-theme";
import { getEmailTemplateSettings, mergeWithDefaults } from "@/lib/email-settings";
import { renderEmail, substitutePlaceholders } from "@/emails/render";
import { EMAIL_TEMPLATE_META, mergedToggles, type TemplateId } from "@/emails/registry";
import type { EventEmailDetails } from "@/emails/components/DetailsCard";
import { InviteEmail } from "@/emails/templates/InviteEmail";
import { RsvpConfirmationEmail } from "@/emails/templates/RsvpConfirmationEmail";
import { ApprovalEmail } from "@/emails/templates/ApprovalEmail";
import { BlastEmail } from "@/emails/templates/BlastEmail";
import { HostRsvpAlertEmail } from "@/emails/templates/HostRsvpAlertEmail";
import { formatEventDateTime } from "@/lib/calendar";
import { sendRenderedEmail } from "@/lib/email";
import { assertHostOrCohost } from "./shared";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

/** Templates a host can preview for their event. */
const EVENT_TEMPLATE_IDS: TemplateId[] = [
  "invite",
  "rsvpConfirmation",
  "approval",
  "blast",
  "hostRsvpAlert",
];

const SAMPLE_GUEST = "Alex Sample";

async function renderEventEmail(eventId: string, templateId: TemplateId) {
  if (!EVENT_TEMPLATE_IDS.includes(templateId)) {
    throw new Error("Unknown event email template");
  }
  await assertHostOrCohost(eventId);

  const event = await db.event.findUnique({
    where: { id: eventId },
    include: { theme: true, host: { select: { name: true } } },
  });
  if (!event) throw new Error("Forbidden");

  // Real event data + the event's real current theme, with a sample guest.
  const theme = resolveEmailTheme(event.theme);
  const hostName = event.host.name ?? "Your host";
  const eventUrl = `${APP_URL}/e/${event.slug}`;
  const details: EventEmailDetails = {
    id: event.id,
    slug: event.slug,
    title: event.title,
    description: event.description,
    startAt: event.startAt,
    endAt: event.endAt,
    timezone: event.timezone,
    locationType: event.locationType,
    locationName: event.locationName,
    locationAddress: event.locationAddress,
    virtualUrl: event.virtualUrl,
  };

  const overrides = await getEmailTemplateSettings(templateId);
  const merged = mergeWithDefaults(templateId, overrides);
  const toggles = mergedToggles(templateId, overrides);
  const vars: Record<string, string> = {
    guestName: SAMPLE_GUEST,
    hostName,
    eventTitle: event.title,
    eventDate: formatEventDateTime(event.startAt, event.endAt, event.timezone).date,
    location: event.locationName ?? "",
    status: "Going",
    decision: "Approved",
  };
  const subject = substitutePlaceholders(merged.subject, vars);
  const body = substitutePlaceholders(merged.body, vars);

  let element: React.ReactElement;
  switch (templateId) {
    case "invite":
      element = createElement(InviteEmail, {
        theme,
        body,
        toggles,
        event: details,
        hostName,
        rsvpBaseUrl: `${eventUrl}/rsvp?token=sample-token`,
        maybeEnabled: event.maybeEnabled,
        eventUrl,
      });
      break;
    case "rsvpConfirmation":
      element = createElement(RsvpConfirmationEmail, {
        theme,
        body,
        toggles,
        event: details,
        statusLabel: "Going",
        eventUrl,
        editUrl: `${eventUrl}/rsvp?token=sample-token`,
      });
      break;
    case "approval":
      element = createElement(ApprovalEmail, {
        theme,
        toggles,
        eventTitle: event.title,
        approved: true,
        hostMessage: "Can't wait to see you there!",
        eventUrl,
      });
      break;
    case "blast":
      element = createElement(BlastEmail, {
        theme,
        toggles,
        eventTitle: event.title,
        hostName,
        message: "Quick update from your host — see the event page for details.",
        eventUrl,
      });
      break;
    default:
      element = createElement(HostRsvpAlertEmail, {
        theme,
        guestName: SAMPLE_GUEST,
        statusLabel: "Going",
        plusOneCount: 1,
        note: "So excited!",
        eventTitle: event.title,
        goingCount: 12,
        maybeCount: 3,
        noCount: 2,
        guestListUrl: `${eventUrl}#guests`,
      });
  }

  const { html, text } = await renderEmail(element);
  return { subject, html, text };
}

/** Server-rendered preview for the event settings Emails panel. */
export async function getEventEmailPreview(eventId: string, templateId: TemplateId) {
  const { subject, html } = await renderEventEmail(eventId, templateId);
  return { subject, html };
}

/** Send a sample of an event email to the signed-in host/co-host. */
export async function sendEventEmailTest(eventId: string, templateId: TemplateId) {
  const session = await getSession();
  if (!session?.email) {
    return { success: false as const, error: "Your account has no email address." };
  }
  const limit = await rateLimit(`event-email-test:${session.userId}`, 10, 3600);
  if (!limit.success) {
    return { success: false as const, error: "Too many test emails. Try again later." };
  }
  const { subject, html, text } = await renderEventEmail(eventId, templateId);
  // Send the real subject (no prefix) so the host previews exactly what guests
  // receive; it goes only to the signed-in host's own inbox.
  await sendRenderedEmail({ to: session.email, subject, html, text });
  return { success: true as const, sentTo: session.email };
}

/** Metadata for the event settings Emails panel dropdown. */
export async function getEventEmailTemplates() {
  return EVENT_TEMPLATE_IDS.map((id) => ({
    id,
    label: EMAIL_TEMPLATE_META[id].label,
    description: EMAIL_TEMPLATE_META[id].description,
  }));
}
