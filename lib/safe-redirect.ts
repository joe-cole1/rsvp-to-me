// Post-sign-in redirect validation. Server actions, route handlers and client
// navigation all share it, so it must stay free of server-only imports.

const PROBE_ORIGIN = "https://redirect.invalid";
const BACKSLASH = 0x5c;
const DELETE = 0x7f;

// WHATWG URL parsing removes ASCII tab/CR/LF anywhere and treats "\" as "/", so
// "/\t/evil.example" passes a prefix check yet resolves to another host. Reject
// those characters (and the other C0 controls) instead of reasoning about how
// each consumer normalises them.
function hasUnsafeCharacter(path: string): boolean {
  for (let i = 0; i < path.length; i++) {
    const code = path.charCodeAt(i);
    if (code < 0x20 || code === DELETE || code === BACKSLASH) return true;
  }
  return false;
}

/** Accepts only same-origin relative paths such as `/e/slug?foo=bar`. */
export function isSafeRedirect(path: string): boolean {
  if (
    typeof path !== "string" ||
    !path.startsWith("/") ||
    path.startsWith("//") ||
    path.includes(":") ||
    hasUnsafeCharacter(path)
  ) {
    return false;
  }
  try {
    return new URL(path, PROBE_ORIGIN).origin === PROBE_ORIGIN;
  } catch {
    return false;
  }
}

/** The validated redirect, or the dashboard when it is missing or unsafe. */
export function safeRedirectPath(path: string | null | undefined): string {
  return path && isSafeRedirect(path) ? path : "/dashboard";
}
