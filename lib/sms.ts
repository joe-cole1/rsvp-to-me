import twilio from "twilio";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

function getClient() {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) return null;
  return twilio(sid, token);
}

const FROM = process.env.TWILIO_PHONE_NUMBER ?? "";

async function send(to: string, body: string) {
  const client = getClient();
  if (!client) {
    console.log("[sms:dev]", { to, body });
    return;
  }
  return client.messages.create({ from: FROM, to, body });
}

export async function sendRsvpConfirmationSms(
  to: string,
  opts: {
    guestName: string;
    eventTitle: string;
    eventSlug: string;
    status: "GOING" | "MAYBE" | "NO";
    editToken: string;
  }
) {
  const editUrl = `${APP_URL}/e/${opts.eventSlug}/rsvp?token=${opts.editToken}`;
  const statusLabel = opts.status === "GOING" ? "Going ✓" : opts.status === "MAYBE" ? "Maybe" : "Can't Go";
  return send(
    to,
    `${opts.guestName}, you're ${statusLabel} for ${opts.eventTitle}! Update your RSVP: ${editUrl}`
  );
}

export async function sendSmsBlast(
  phones: string[],
  opts: { eventTitle: string; eventSlug: string; message: string; hostName: string }
) {
  const eventUrl = `${APP_URL}/e/${opts.eventSlug}`;
  const body = `${opts.hostName} (${opts.eventTitle}): ${opts.message} ${eventUrl}`;
  await Promise.allSettled(phones.map((p) => send(p, body)));
  return phones.length;
}
