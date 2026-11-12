import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "./render";
import SignInForm from "@/app/auth/sign-in/SignInForm";
import RegisterForm from "@/app/auth/register/RegisterForm";

const mocks = vi.hoisted(() => ({
  send: vi.fn(),
  register: vi.fn(),
  verify: vi.fn(),
  captcha: vi.fn(),
}));
vi.mock("@/app/actions/auth", () => ({
  sendMagicLinkAction: mocks.send,
  registerHostAction: mocks.register,
  verifySignInCodeAction: mocks.verify,
}));
vi.mock("@/components/ui/CaptchaProvider", () => ({
  useCaptcha: () => ({ runWithCaptcha: mocks.captcha }),
}));
beforeEach(() => {
  vi.clearAllMocks();
  mocks.send.mockResolvedValue({ success: true });
  mocks.register.mockResolvedValue({ success: true });
  mocks.captcha.mockImplementation((_action: string, callback: (token: string) => unknown) =>
    callback("captcha-token")
  );
});
afterEach(() => vi.unstubAllGlobals());

async function submitSignIn(identifier = "host@example.com") {
  render(<SignInForm openRegistration redirect="/e/example" />);
  fireEvent.change(screen.getByRole("textbox"), { target: { value: identifier } });
  fireEvent.click(screen.getByRole("button", { name: "Send sign-in link and code" }));
  await screen.findByRole("heading", {
    name: identifier.includes("@") ? "Check your email" : "Check your texts",
  });
}
async function submitRegistration() {
  render(<RegisterForm openRegistration={false} />);
  fireEvent.change(screen.getByLabelText("Your name"), { target: { value: "Host" } });
  fireEvent.change(screen.getByLabelText("Email address"), {
    target: { value: "host@example.com" },
  });
  fireEvent.change(screen.getByLabelText("Invite code"), { target: { value: "invite" } });
  fireEvent.click(screen.getByRole("button", { name: "Create account" }));
  await screen.findByRole("heading", { name: "Check your email" });
}

describe("SignInForm and shared code entry", () => {
  it.each(["host@example.com", "+15551234567"])(
    "shows accessible explicit code entry for %s",
    async (identifier) => {
      await submitSignIn(identifier);
      const input = screen.getByLabelText("6-digit code");
      expect(input).toHaveAttribute("inputmode", "numeric");
      expect(input).toHaveAttribute("autocomplete", "one-time-code");
      expect(input).toHaveAttribute("maxlength", "6");
      const submit = screen.getByRole("button", { name: "Sign in" });
      expect(submit).toBeDisabled();
      fireEvent.change(input, { target: { value: "0a12b34567" } });
      expect(input).toHaveValue("012345");
      expect(submit).toBeEnabled();
      expect(mocks.verify).not.toHaveBeenCalled();
    }
  );
  it("shows verification errors and preserves the redirect", async () => {
    mocks.verify.mockResolvedValue({ success: false, error: "Invalid or expired code." });
    await submitSignIn();
    fireEvent.change(screen.getByLabelText("6-digit code"), { target: { value: "012345" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Invalid or expired code.");
    expect(mocks.verify).toHaveBeenCalledWith("host@example.com", "012345", "/e/example");
  });
  it("navigates the whole document on verified sign-in", async () => {
    const assign = vi.fn();
    mocks.verify.mockResolvedValue({ success: true, redirectTo: "/e/example" });
    await submitSignIn();
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
    await waitFor(() => expect(assign).toHaveBeenCalledWith("/e/example"));
  });
  it("resends with signin CAPTCHA, clears the old code and confirms", async () => {
    await submitSignIn();
    fireEvent.change(screen.getByLabelText("6-digit code"), { target: { value: "012345" } });
    fireEvent.click(screen.getByRole("button", { name: "Resend" }));
    expect(await screen.findByRole("status")).toHaveTextContent(
      "A new link and code have been sent."
    );
    expect(screen.getByLabelText("6-digit code")).toHaveValue("");
    expect(mocks.captcha).toHaveBeenLastCalledWith("signin", expect.any(Function));
    expect(mocks.send).toHaveBeenLastCalledWith("host@example.com", "/e/example", "captcha-token");
  });
  it("allows changing the identifier", async () => {
    await submitSignIn();
    fireEvent.click(screen.getByRole("button", { name: "Use a different email or phone" }));
    expect(screen.getByLabelText("Email or phone number")).toBeInTheDocument();
  });
  it("reports resend delivery errors next to the form", async () => {
    await submitSignIn();
    mocks.send.mockResolvedValue({ success: false, error: "auth_failed" });
    fireEvent.click(screen.getByRole("button", { name: "Resend" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Something went wrong");
  });
});

describe("RegisterForm code entry", () => {
  it("verifies without repeating registration and retains the sign-in link", async () => {
    mocks.verify.mockResolvedValue({ success: false, error: "Invalid or expired code." });
    await submitRegistration();
    fireEvent.change(screen.getByLabelText("6-digit code"), { target: { value: "012345" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    await screen.findByRole("alert");
    expect(mocks.verify).toHaveBeenCalledWith("host@example.com", "012345", undefined);
    expect(mocks.register).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("link", { name: "Go to sign in" })).toHaveAttribute(
      "href",
      "/auth/sign-in"
    );
  });
  it("resends through sendMagicLinkAction with signin CAPTCHA", async () => {
    await submitRegistration();
    fireEvent.click(screen.getByRole("button", { name: "Resend" }));
    await screen.findByRole("status");
    expect(mocks.captcha).toHaveBeenLastCalledWith("signin", expect.any(Function));
    expect(mocks.send).toHaveBeenCalledWith("host@example.com", undefined, "captcha-token");
    expect(mocks.register).toHaveBeenCalledExactlyOnceWith(
      "host@example.com",
      "Host",
      "invite",
      "captcha-token"
    );
  });
});
