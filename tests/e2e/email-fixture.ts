import { createServer, type Socket } from "node:net";
import type { Pool } from "pg";

/** Local-only SMTP sink: acknowledge deliveries without storing private payloads. */
export async function startEmailFixture(pool: Pool) {
  const sockets = new Set<Socket>();
  const server = createServer((socket) => {
    sockets.add(socket);
    socket.on("error", () => {});
    socket.once("close", () => sockets.delete(socket));
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
        } else if (/^(EHLO|HELO)/i.test(line)) socket.write("250-fixture\r\n250 AUTH PLAIN\r\n");
        else if (/^(MAIL FROM:|RCPT TO:|RSET|NOOP)/i.test(line)) socket.write("250 OK\r\n");
        else if (/^AUTH/i.test(line)) socket.write("235 authenticated\r\n");
        else if (line === "DATA") {
          inData = true;
          socket.write("354 message\r\n");
        } else if (line === "QUIT") socket.end("221 bye\r\n");
        else socket.write("500 unsupported\r\n");
      }
    });
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("SMTP fixture did not bind");
  const config: Record<string, string> = {
    email_provider: "smtp",
    smtp_host: "127.0.0.1",
    smtp_port: String(address.port),
    smtp_secure: "false",
  };
  const old = await pool.query<{ key: string; value: string }>(
    'SELECT key, value FROM "SystemConfig" WHERE key = ANY($1::text[])',
    [Object.keys(config)]
  );
  const stop = async () => {
    for (const socket of sockets) socket.destroy();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  };
  try {
    for (const [key, value] of Object.entries(config))
      await pool.query(
        'INSERT INTO "SystemConfig" (key,value) VALUES ($1,$2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value',
        [key, value]
      );
  } catch (error) {
    await stop();
    throw error;
  }
  // Playwright invokes this while tearing down its setup process.
  return async () => {
    await stop();
    const { Pool } = await import("pg");
    const cleanup = new Pool({ connectionString: process.env.DATABASE_URL });
    try {
      await cleanup.query('DELETE FROM "SystemConfig" WHERE key = ANY($1::text[])', [
        Object.keys(config),
      ]);
      for (const { key, value } of old.rows)
        await cleanup.query(
          'INSERT INTO "SystemConfig" (key,value) VALUES ($1,$2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value',
          [key, value]
        );
    } finally {
      await cleanup.end();
    }
  };
}
