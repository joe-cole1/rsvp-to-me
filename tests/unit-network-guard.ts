// Unit tests must replace fetch with a local mock. Never send fixture tokens,
// recipient addresses, or message bodies to real email/SMS/captcha providers.
// Assign the fallback directly so vi.unstubAllGlobals restores this guard.
import { afterEach, expect } from "vitest";

let unmockedRequests: string[] = [];
const localFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const url = new URL(
    typeof input === "string" ? input : input instanceof URL ? input.href : input.url
  );
  // ImageResponse probes bundled WASM/font assets through file/data URLs.
  // These cannot contact a provider; Node's file-URL rejection lets its
  // filesystem fallback run normally.
  if (url.protocol === "file:" || url.protocol === "data:") return localFetch(input, init);
  unmockedRequests.push(url.origin);
  throw new Error("Unit-test fetch is offline. Mock the provider response in this test.");
};

afterEach(() => {
  const attemptedRequests = unmockedRequests;
  unmockedRequests = [];
  expect(attemptedRequests, "Unit tests must not make unmocked fetch requests").toEqual([]);
});
