/* eslint-disable @typescript-eslint/no-require-imports */
// Capture transport for the upgrade rehearsal. It runs only on the rehearsal's
// internal Docker network, where no real provider is reachable:
// - SMTP on :2525 accepts AUTH only for the configured test accounts and keeps
//   each message with the account that authenticated, so a check can prove a
//   saved credential still decrypts.
// - HTTPS on :443 answers Twilio's Messages API under the network alias
//   api.twilio.com, using a CA generated for this run only. Basic auth must match
//   the configured test account SID and token.
// - HTTP on :8025 returns everything captured as JSON for the rehearsal checks.
const net = require("node:net");
const http = require("node:http");
const https = require("node:https");
const fs = require("node:fs");

const accounts = require("./accounts.cjs");

// The bootstrap account is the environment SMTP login the baseline needs before
// an administrator can save settings. Checks require the saved account instead.
const smtpAccounts = {
  [accounts.smtp.user]: accounts.smtp.pass,
  [process.env.CAPTURE_BOOTSTRAP_SMTP_USER]: process.env.CAPTURE_BOOTSTRAP_SMTP_PASS,
};
const twilioAccounts = { [accounts.twilio.sid]: accounts.twilio.token };
const emails = [];
const sms = [];
const rejected = [];

function decodeQuotedPrintable(text) {
  return Buffer.from(
    text
      .replace(/=\r?\n/g, "")
      .replace(/=([0-9A-F]{2})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16))),
    "latin1"
  ).toString("utf8");
}

function decodeWords(value) {
  return value.replace(/=\?([^?]+)\?([BQ])\?([^?]*)\?=/gi, (_, _charset, encoding, text) =>
    encoding.toUpperCase() === "B"
      ? Buffer.from(text, "base64").toString("utf8")
      : decodeQuotedPrintable(text.replace(/_/g, " "))
  );
}

function parseHeaders(block) {
  const headers = {};
  for (const line of block.replace(/\r?\n[ \t]+/g, " ").split(/\r?\n/)) {
    const index = line.indexOf(":");
    if (index > 0)
      headers[line.slice(0, index).trim().toLowerCase()] = line.slice(index + 1).trim();
  }
  return headers;
}

// Returns the decoded text of every leaf part; enough for links and codes.
function decodeMime(raw) {
  const split = raw.search(/\r?\n\r?\n/);
  const headers = parseHeaders(split < 0 ? raw : raw.slice(0, split));
  const body = split < 0 ? "" : raw.slice(split).replace(/^\r?\n\r?\n/, "");
  const type = headers["content-type"] || "text/plain";
  const boundary = /boundary="?([^";]+)"?/i.exec(type)?.[1];
  if (/^multipart\//i.test(type) && boundary) {
    return body
      .split(`--${boundary}`)
      .slice(1)
      .filter((part) => !part.startsWith("--"))
      .flatMap((part) => decodeMime(part.replace(/^\r?\n/, "")));
  }
  const encoding = (headers["content-transfer-encoding"] || "").toLowerCase();
  const text =
    encoding === "base64"
      ? Buffer.from(body.replace(/\s+/g, ""), "base64").toString("utf8")
      : encoding === "quoted-printable"
        ? decodeQuotedPrintable(body)
        : body;
  return [{ type, text }];
}

function storeEmail(session, raw) {
  const top = raw.slice(0, raw.search(/\r?\n\r?\n/) + 1 || raw.length);
  const headers = parseHeaders(top);
  const parts = decodeMime(raw);
  emails.push({
    id: emails.length + 1,
    receivedAt: new Date().toISOString(),
    authUser: session.user,
    from: session.from,
    to: session.to,
    subject: decodeWords(headers.subject || ""),
    text: parts.map((part) => part.text).join("\n"),
  });
}

net
  .createServer((socket) => {
    const session = { user: null, from: null, to: [], data: null, login: null };
    let buffer = "";
    const reply = (line) => socket.write(`${line}\r\n`);
    const authenticate = (user, pass) => {
      if (Object.hasOwn(smtpAccounts, user) && smtpAccounts[user] === pass) {
        session.user = user;
        reply("235 2.7.0 Authentication successful");
      } else {
        rejected.push({ transport: "smtp", user, at: new Date().toISOString() });
        reply("535 5.7.8 Authentication credentials invalid");
      }
    };
    reply("220 capture ESMTP rehearsal");
    socket.on("error", () => {});
    socket.on("data", (chunk) => {
      buffer += chunk.toString("latin1");
      for (;;) {
        if (session.data !== null) {
          const end = buffer.indexOf("\r\n.\r\n");
          if (end < 0) return;
          const raw = Buffer.from(
            (session.data + buffer.slice(0, end)).replace(/\r\n\.\./g, "\r\n."),
            "latin1"
          ).toString("latin1");
          buffer = buffer.slice(end + 5);
          session.data = null;
          storeEmail(session, raw);
          session.from = null;
          session.to = [];
          reply("250 2.0.0 Captured");
          continue;
        }
        const newline = buffer.indexOf("\r\n");
        if (newline < 0) return;
        const line = buffer.slice(0, newline);
        buffer = buffer.slice(newline + 2);
        if (session.login === "user") {
          session.login = Buffer.from(line, "base64").toString("utf8");
          reply("334 UGFzc3dvcmQ6");
          continue;
        }
        if (typeof session.login === "string") {
          const user = session.login;
          session.login = null;
          authenticate(user, Buffer.from(line, "base64").toString("utf8"));
          continue;
        }
        const [verb, ...rest] = line.split(" ");
        const argument = rest.join(" ");
        switch (verb.toUpperCase()) {
          case "EHLO":
            socket.write("250-capture\r\n250-AUTH PLAIN LOGIN\r\n250 8BITMIME\r\n");
            break;
          case "HELO":
            reply("250 capture");
            break;
          case "AUTH": {
            const [mechanism, initial] = argument.split(" ");
            if (mechanism.toUpperCase() === "PLAIN" && initial) {
              const [, user, pass] = Buffer.from(initial, "base64").toString("utf8").split("\0");
              authenticate(user, pass);
            } else if (mechanism.toUpperCase() === "LOGIN") {
              session.login = "user";
              reply("334 VXNlcm5hbWU6");
            } else reply("504 5.5.4 Unsupported mechanism");
            break;
          }
          case "MAIL":
            if (!session.user) reply("530 5.7.0 Authentication required");
            else {
              session.from = /<([^>]*)>/.exec(argument)?.[1] ?? "";
              reply("250 2.1.0 OK");
            }
            break;
          case "RCPT":
            session.to.push(/<([^>]*)>/.exec(argument)?.[1] ?? "");
            reply("250 2.1.5 OK");
            break;
          case "DATA":
            session.data = "";
            reply("354 End data with <CR><LF>.<CR><LF>");
            break;
          case "RSET":
            session.from = null;
            session.to = [];
            reply("250 2.0.0 OK");
            break;
          case "NOOP":
            reply("250 2.0.0 OK");
            break;
          case "QUIT":
            reply("221 2.0.0 Bye");
            socket.end();
            return;
          default:
            reply("502 5.5.2 Command not recognized");
        }
      }
    });
  })
  .listen(2525);

function readBody(request) {
  return new Promise((resolve) => {
    let body = "";
    request.on("data", (chunk) => (body += chunk));
    request.on("end", () => resolve(body));
  });
}

https
  .createServer(
    {
      key: fs.readFileSync("/capture-tls/server.key"),
      cert: fs.readFileSync("/capture-tls/server.crt"),
    },
    async (request, response) => {
      const body = await readBody(request);
      const match = /^\/2010-04-01\/Accounts\/([^/]+)\/Messages\.json$/.exec(request.url || "");
      const [user, pass] = Buffer.from(
        (request.headers.authorization || "").replace(/^Basic /, ""),
        "base64"
      )
        .toString("utf8")
        .split(":");
      response.setHeader("content-type", "application/json");
      if (!match || request.method !== "POST") {
        response.statusCode = 404;
        response.end(JSON.stringify({ code: 20404, message: "Not found" }));
        return;
      }
      if (
        !Object.hasOwn(twilioAccounts, user) ||
        twilioAccounts[user] !== pass ||
        match[1] !== user
      ) {
        rejected.push({ transport: "twilio", user, at: new Date().toISOString() });
        response.statusCode = 401;
        response.end(JSON.stringify({ code: 20003, message: "Authenticate" }));
        return;
      }
      const form = new URLSearchParams(body);
      const sid = `SM${String(sms.length + 1).padStart(32, "0")}`;
      sms.push({
        id: sms.length + 1,
        receivedAt: new Date().toISOString(),
        authUser: user,
        to: form.get("To"),
        from: form.get("From") || form.get("MessagingServiceSid"),
        text: form.get("Body") || "",
      });
      response.statusCode = 201;
      response.end(JSON.stringify({ sid, status: "queued", to: form.get("To") }));
    }
  )
  .listen(443);

http
  .createServer((request, response) => {
    response.setHeader("content-type", "application/json");
    if (request.url === "/health") return response.end('{"status":"ok"}');
    response.end(JSON.stringify({ emails, sms, rejected }));
  })
  .listen(8025, () => console.log("[capture] SMTP :2525, Twilio HTTPS :443, API :8025"));
