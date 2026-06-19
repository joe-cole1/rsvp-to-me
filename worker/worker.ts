// WARNING: If you modify this file, make sure to also update the static worker code template
// in app/admin/AdminClient.tsx to keep them in sync.

import type { SendEmail, Message, ExportedHandler } from "@cloudflare/workers-types";

interface Env {
  SEND_EMAIL: SendEmail;
  WORKER_API_SECRET?: string;
  INBOUND_FORWARD_TO?: string;
}

interface WorkerSendPayload {
  from: string;
  to: string | string[];
  bcc?: string | string[];
  replyTo?: string;
  subject: string;
  html?: string;
  text?: string;
}

function extractRawEmail(fromStr: string): string {
  const match = fromStr.match(/<([^>]+)>/);
  return match ? match[1].trim() : fromStr.trim();
}

export default {
  async email(message: Message, env: Env) {
    if (!env.INBOUND_FORWARD_TO) {
      throw new Error("INBOUND_FORWARD_TO environment variable is not set.");
    }
    await message.forward(env.INBOUND_FORWARD_TO);
    await env.SEND_EMAIL.send({
      from: extractRawEmail(message.to),
      to: message.from,
      subject: `Re: ${message.headers.get("subject") ?? "Your RSVP"}`,
      text: "Thanks for your reply. The event host has been notified.",
    });
  },

  async fetch(request: Request, env: Env): Promise<Response> {
    if (!env.WORKER_API_SECRET) {
      return new Response("Unauthorized: WORKER_API_SECRET environment variable is not set.", { status: 401 });
    }
    if (request.headers.get("Authorization") !== `Bearer ${env.WORKER_API_SECRET}`) {
      return new Response("Unauthorized", { status: 401 });
    }
    if (request.method !== "POST" || new URL(request.url).pathname !== "/send") {
      return new Response("Not found", { status: 404 });
    }

    try {
      const body: WorkerSendPayload = await request.json();
      if (!body.from || !body.to || !body.subject || (!body.html && !body.text)) {
        return new Response("Missing required fields", { status: 422 });
      }

      const rawFrom = extractRawEmail(body.from);
      const rawReplyTo = body.replyTo ? extractRawEmail(body.replyTo) : undefined;

      const recipients = Array.isArray(body.to) ? body.to : [body.to];
      const bcc = body.bcc ? (Array.isArray(body.bcc) ? body.bcc : [body.bcc]) : [];
      const allRecipients = [...recipients, ...bcc];

      await Promise.all(
        allRecipients.map((to) =>
          env.SEND_EMAIL.send({
            from: rawFrom,
            to,
            subject: body.subject,
            html: body.html,
            text: body.text,
            replyTo: rawReplyTo,
          })
        )
      );

      return Response.json({ ok: true });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Internal Server Error";
      return new Response(message, { status: 500 });
    }
  },
} satisfies ExportedHandler<Env>;
