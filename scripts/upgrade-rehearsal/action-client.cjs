/* eslint-disable @typescript-eslint/no-require-imports */
// HTTP client for one running build of the app, used by rehearsal scenarios.
// It runs in a sidecar container started from the SAME image as the app under
// test, so it calls that build's own server actions with that build's own React
// Flight encoder/decoder: exactly what the browser sends, without a browser.
// Actions are named by source file and export (stable across builds), and
// resolved to this build's action IDs through its server-reference manifest.
const { Readable } = require("node:stream");
const assert = require("node:assert/strict");

const flight = require("/app/node_modules/next/dist/compiled/react-server-dom-webpack/client.node.js");
const manifest = require("/app/.next/server/server-reference-manifest.json");

// Action responses may include a re-rendered page whose client components this
// sidecar never loads. Resolve every client reference to an inert module.
globalThis.__webpack_require__ = () => ({});
globalThis.__webpack_chunk_load__ = () => Promise.resolve();
const moduleMap = new Proxy(
  {},
  { get: (_target, id) => new Proxy({}, { get: (_m, name) => ({ id, chunks: [], name }) }) }
);

const actions = new Map();
for (const [id, entry] of Object.entries(manifest.node)) {
  if (entry.filename && entry.exportedName) {
    actions.set(`${entry.filename}#${entry.exportedName}`, {
      id,
      workers: Object.keys(entry.workers),
    });
  }
}

function staticPath(worker) {
  if (/\[/.test(worker)) return null;
  const route = worker
    .replace(/^app/, "")
    .replace(/\/page$/, "")
    .replace(/\/\([^)]+\)/g, "");
  return route || "/";
}

class ActionError extends Error {}

function createClient(baseUrl, label = "client") {
  const jar = new Map();
  const origin = new URL(baseUrl).origin;

  function storeCookies(response) {
    for (const header of response.headers.getSetCookie()) {
      const [pair, ...attributes] = header.split(";");
      const index = pair.indexOf("=");
      const name = pair.slice(0, index).trim();
      const value = pair.slice(index + 1).trim();
      const expired = attributes.some(
        (attribute) =>
          /^\s*max-age=0\s*$/i.test(attribute) ||
          (/^\s*expires=/i.test(attribute) &&
            Date.parse(attribute.split("=").slice(1).join("=")) < Date.now())
      );
      if (expired || value === "") jar.delete(name);
      else jar.set(name, value);
    }
  }

  function cookieHeader() {
    return [...jar].map(([name, value]) => `${name}=${value}`).join("; ");
  }

  async function request(path, init = {}) {
    const response = await fetch(new URL(path, baseUrl), {
      redirect: "manual",
      ...init,
      headers: { ...(jar.size ? { cookie: cookieHeader() } : {}), ...(init.headers || {}) },
      signal: AbortSignal.timeout(30000),
    });
    storeCookies(response);
    return response;
  }

  // Follows redirects within the app, keeping cookies, like a browser would.
  async function get(path, { follow = true } = {}) {
    let response = await request(path);
    let current = new URL(path, baseUrl);
    for (
      let hops = 0;
      follow && hops < 10 && response.status >= 300 && response.status < 400;
      hops++
    ) {
      current = new URL(response.headers.get("location"), current);
      assert.equal(current.origin, origin, `${label}: redirect left the app (${current})`);
      response = await request(current.pathname + current.search);
    }
    return {
      status: response.status,
      url: current.pathname + current.search,
      text: await response.text(),
      headers: response.headers,
    };
  }

  async function action(name, args, { path } = {}) {
    const target = actions.get(name);
    if (!target) throw new ActionError(`${label}: this build has no server action ${name}`);
    const page = path ?? target.workers.map(staticPath).find(Boolean);
    if (!page) throw new ActionError(`${label}: ${name} needs an explicit page path`);
    const body = await flight.encodeReply(args);
    const response = await request(page, {
      method: "POST",
      headers: {
        accept: "text/x-component",
        "next-action": target.id,
        origin,
        ...(typeof body === "string" ? { "content-type": "text/plain;charset=UTF-8" } : {}),
      },
      body,
    });
    const redirect = response.headers.get("x-action-redirect");
    const type = response.headers.get("content-type") || "";
    if (!type.includes("text/x-component")) {
      const text = await response.text();
      if (redirect) return { redirect: redirect.split(";")[0] };
      throw new ActionError(
        `${label}: ${name} returned HTTP ${response.status}: ${text.slice(0, 300)}`
      );
    }
    const root = await flight.createFromNodeStream(Readable.fromWeb(response.body), {
      moduleMap,
      serverModuleMap: null,
      moduleLoading: null,
    });
    if (redirect) return { redirect: redirect.split(";")[0] };
    try {
      return await root.a;
    } catch (error) {
      throw new ActionError(`${label}: ${name} failed: ${error?.message || error}`);
    }
  }

  return { action, get, request, cookies: jar, label };
}

async function captured(captureUrl = "http://capture:8025") {
  const response = await fetch(`${captureUrl}/messages`, { signal: AbortSignal.timeout(10000) });
  return response.json();
}

// Waits for a captured message that matches and was not seen before `since`.
async function waitForMessage(kind, predicate, { since = 0, timeoutMs = 30000 } = {}) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const all = await captured();
    const found = all[kind].filter((message) => message.id > since).find(predicate);
    if (found) return found;
    if (Date.now() > deadline) {
      const transport = kind === "sms" ? "twilio" : "smtp";
      const rejected = all.rejected.filter((entry) => entry.transport === transport);
      throw new Error(
        `No ${kind === "sms" ? "SMS" : "email"} reached the capture within ${timeoutMs} ms` +
          (rejected.length
            ? ` (${rejected.length} rejected ${transport} logins)`
            : " (nothing was sent)")
      );
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
}

async function lastMessageId(kind) {
  const all = await captured();
  return all[kind].at(-1)?.id ?? 0;
}

// First app link with this path prefix in a captured message, as a path.
function extractLink(text, prefix, baseUrl = "http://app:3000") {
  const escaped = `${baseUrl}${prefix}`.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
  const match = new RegExp(`${escaped}[^\\s"'<>\\]\\)]*`).exec(text);
  if (!match) throw new Error(`No ${prefix} link in captured message`);
  const url = new URL(match[0].replace(/&amp;/g, "&"));
  return url.pathname + url.search;
}

module.exports = {
  createClient,
  captured,
  waitForMessage,
  lastMessageId,
  extractLink,
  ActionError,
  actions,
};
