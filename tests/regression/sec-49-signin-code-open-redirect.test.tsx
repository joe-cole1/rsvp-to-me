// @vitest-environment jsdom
// Root cause (SEC-49, PR #862 / CodeQL js/client-side-unvalidated-url-redirection):
// isSafeRedirect only rejected "//" and "/\" as a prefix. URL parsing strips
// ASCII tab/CR/LF anywhere, so "/\t/evil.example" passed and then resolved to
// https://evil.example/. The magic-link route prefixes the app origin, which
// hid this, but code sign-in navigated to the relative path with
// window.location.assign(), turning /auth/sign-in?redirect=/%09/evil.example into
// an open redirect after a genuine sign-in.
import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "../components/render";
import SignInForm from "@/app/auth/sign-in/SignInForm";
import { isSafeRedirect, safeRedirectPath } from "@/lib/safe-redirect";

const mocks = vi.hoisted(() => ({ send: vi.fn(), verify: vi.fn() }));
vi.mock("@/app/actions/auth", () => ({
  sendMagicLinkAction: mocks.send,
  registerHostAction: vi.fn(),
  verifySignInCodeAction: mocks.verify,
}));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams() }));
vi.mock("@/components/ui/CaptchaProvider", () => ({
  useCaptcha: () => ({
    runWithCaptcha: (_action: string, callback: (token: string) => unknown) => callback("token"),
  }),
}));
afterEach(() => vi.unstubAllGlobals());

const BYPASSES = ["/\t/evil.example", "/\n/evil.example", "/\r/evil.example", "/\t\\evil.example"];

describe("SEC-49 sign-in redirect validation", () => {
  it.each(BYPASSES)("the URL parser really sends %j off-origin", (path) => {
    expect(new URL(path, "https://app.example").origin).not.toBe("https://app.example");
  });

  it.each(BYPASSES)("isSafeRedirect rejects %j", (path) => {
    expect(isSafeRedirect(path)).toBe(false);
    expect(safeRedirectPath(path)).toBe("/dashboard");
  });

  it("code sign-in navigates to the dashboard instead of an off-origin redirect", async () => {
    mocks.send.mockResolvedValue({ success: true });
    mocks.verify.mockResolvedValue({ success: true });
    render(<SignInForm openRegistration redirect={"/\t/evil.example"} />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "host@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Send sign-in link and code" }));
    await screen.findByLabelText("6-digit code");

    const assign = vi.fn();
    const originalWindow = window;
    vi.stubGlobal(
      "window",
      new Proxy(originalWindow, {
        get: (target, property) =>
          property === "location" ? { assign } : Reflect.get(target, property),
      })
    );
    fireEvent.change(screen.getByLabelText("6-digit code"), { target: { value: "012345" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => expect(assign).toHaveBeenCalledWith("/dashboard"));
    // The server action never receives, and so can never echo, the redirect.
    expect(mocks.verify).toHaveBeenCalledWith("host@example.com", "012345");
  });
});
