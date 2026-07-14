import fs from "node:fs";
import path from "node:path";
import type { BrowserContext } from "@playwright/test";

export const E2E_HOST_EMAIL = "e2e-host@test.internal";
export const PUBLIC_EVENT_SLUG = "e2e-test-event";
export const PRIVATE_EVENT_SLUG = "e2e-private-event";
export const PASSWORD_EVENT_SLUG = "e2e-password-event";
export const PASSWORD_EVENT_PASSWORD = "open-sesame";
export const CREATED_EVENT_TITLE = "E2E Created Event";
export const CREATED_EVENT_SLUG = "e2e-created-event";

export const AUTH_STATE_PATH = path.join(__dirname, "fixtures", "auth-state.json");
export const MAGIC_TOKEN_PATH = path.join(__dirname, "fixtures", "magic-token.txt");

type BrowserCookies = Parameters<BrowserContext["addCookies"]>[0];

export function readAuthCookies(): BrowserCookies {
  const state = JSON.parse(fs.readFileSync(AUTH_STATE_PATH, "utf8")) as {
    cookies: BrowserCookies;
  };
  return state.cookies;
}

export function readMagicToken(): string {
  return fs.readFileSync(MAGIC_TOKEN_PATH, "utf8").trim();
}
