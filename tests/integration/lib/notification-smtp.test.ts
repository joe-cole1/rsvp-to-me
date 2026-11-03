import { createServer, type Socket } from "node:net";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createEmailNotificationAdapter } from "@/lib/email";
import { createTransportContext, TRANSPORT_TIMEOUT_MS } from "@/lib/notifications/transport";
import type { EventUpdateMessage } from "@/lib/notifications/types";

const config = vi.hoisted(() => ({ value: {} as Record<string, string> }));
vi.mock("@/lib/config", () => ({
  getSystemConfigMap: async () => config.value,
  isChannelEnabled: async () => true,
}));
vi.mock("@/lib/db", () => ({ db: { systemConfig: { findUnique: async () => null } } }));
vi.mock("@/lib/redis", () => ({ isRedisEnabled: () => false }));

const message: EventUpdateMessage = {
  kind: "event_update",
  id: "fixture-update",
  eventSlug: "fixture-party",
  eventTitle: "Fixture party",
  body: "Fixture update",
  hostName: "Fixture host",
};
const sockets = new Set<Socket>();
const servers: ReturnType<typeof createServer>[] = [];
afterEach(async () => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  for (const socket of sockets) socket.destroy();
  sockets.clear();
  await Promise.all(
    servers.splice(0).map((server) => new Promise<void>((resolve) => server.close(() => resolve())))
  );
});

async function fixtureServer(onConnection: (socket: Socket) => void) {
  const server = createServer((socket) => {
    sockets.add(socket);
    socket.on("error", () => {});
    socket.once("close", () => sockets.delete(socket));
    onConnection(socket);
  });
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Fixture did not bind TCP");
  config.value = {
    email_provider: "smtp",
    smtp_host: "127.0.0.1",
    smtp_port: String(address.port),
    smtp_secure: "false",
    email_from: "Fixture <site@example.com>",
  };
  // The local fixture must never inherit credentials or reach an external relay.
  for (const key of [
    "SMTP_HOST",
    "SMTP_USER",
    "SMTP_PASS",
    "CLOUDFLARE_WORKER_EMAIL_URL",
    "CLOUDFLARE_WORKER_API_SECRET",
  ])
    vi.stubEnv(key, "");
}

describe("notification SMTP socket lifecycle", () => {
  it("uses a real local SMTP acknowledgement and per-recipient rejection", async () => {
    await fixtureServer((socket) => {
      socket.write("220 fixture ESMTP\r\n");
      let buffer = "",
        inData = false;
      socket.on("data", (chunk) => {
        buffer += chunk.toString();
        while (buffer.includes("\r\n")) {
          const end = buffer.indexOf("\r\n");
          const line = buffer.slice(0, end);
          buffer = buffer.slice(end + 2);
          if (inData) {
            if (line === ".") {
              inData = false;
              socket.write("250 accepted\r\n");
            }
          } else if (line.startsWith("EHLO") || line.startsWith("HELO"))
            socket.write("250 fixture\r\n");
          else if (line.startsWith("MAIL FROM")) socket.write("250 sender accepted\r\n");
          else if (line.startsWith("RCPT TO"))
            socket.write(
              line.includes("rejected@example.com")
                ? "550 rejected\r\n"
                : "250 recipient accepted\r\n"
            );
          else if (line === "DATA") {
            inData = true;
            socket.write("354 send data\r\n");
          } else if (line === "QUIT") socket.end("221 bye\r\n");
        }
      });
    });
    const adapter = await createEmailNotificationAdapter();
    const outcomes = await adapter.deliver(
      message,
      [
        { recipientId: "accepted", destination: "accepted@example.com", locale: "en-US" },
        { recipientId: "rejected", destination: "rejected@example.com", locale: "en-US" },
      ],
      createTransportContext()
    );
    expect(outcomes.map((outcome) => outcome.status)).toEqual(["accepted", "failed"]);
  });

  it("destroys a real stalled connection at the dispatch deadline", async () => {
    let connected!: () => void;
    let closed!: () => void;
    const connection = new Promise<void>((resolve) => {
      connected = resolve;
    });
    const closure = new Promise<void>((resolve) => {
      closed = resolve;
    });
    await fixtureServer((socket) => {
      // Deliberately withhold the SMTP greeting. Drain data to observe FIN/close.
      socket.resume();
      socket.once("close", closed);
      connected();
    });
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const pending = (await createEmailNotificationAdapter()).deliver(
      message,
      [{ recipientId: "fixture-guest", destination: "guest@example.com", locale: "en-US" }],
      createTransportContext()
    );
    await connection;
    await vi.advanceTimersByTimeAsync(TRANSPORT_TIMEOUT_MS);
    expect((await pending)[0].status).toBe("uncertain");
    await closure;
    expect(sockets.size).toBe(0);
  });
});
