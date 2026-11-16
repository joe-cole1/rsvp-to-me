import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "./render";
import SetupForm from "@/app/setup/SetupForm";
const m = vi.hoisted(() => ({ setup: vi.fn(), captcha: vi.fn() }));
vi.mock("@/app/actions/auth", () => ({
  startAdminSetupAction: m.setup,
  sendMagicLinkAction: vi.fn(),
  verifySignInCodeAction: vi.fn(),
}));
vi.mock("@/components/ui/CaptchaProvider", () => ({
  useCaptcha: () => ({ runWithCaptcha: m.captcha }),
}));
beforeEach(() => {
  vi.clearAllMocks();
  m.setup.mockResolvedValue({ success: true });
  m.captcha.mockImplementation((_action, run) => run("captcha-fixture"));
});
async function submit() {
  fireEvent.change(screen.getByLabelText("Your name"), { target: { value: "Owner" } });
  fireEvent.change(screen.getByLabelText("Email address"), {
    target: { value: "owner@example.test" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Send setup link and code" }));
}
describe("initial administrator setup", () => {
  it("explains missing configuration without exposing a form or configured address", () => {
    render(<SetupForm configured={false} />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Set up RSVP to Me");
    expect(screen.getByText(/Set INITIAL_ADMIN_EMAIL/)).toBeVisible();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to sign in" })).toHaveAttribute(
      "href",
      "/auth/sign-in"
    );
  });
  it("uses the shared challenge after explicit submission without an invite", async () => {
    render(<SetupForm configured />);
    expect(screen.queryByLabelText("Invite code")).not.toBeInTheDocument();
    await submit();
    expect(await screen.findByRole("heading", { name: "Check your email" })).toBeVisible();
    expect(m.setup).toHaveBeenCalledWith("owner@example.test", "Owner", "captcha-fixture");
    expect(screen.getByLabelText("6-digit code")).toHaveAttribute("autocomplete", "one-time-code");
    fireEvent.click(screen.getByRole("button", { name: "Use a different email" }));
    expect(screen.getByLabelText("Email address")).toHaveValue("owner@example.test");
  });
  it("announces a failed request, focuses feedback, and allows retry", async () => {
    m.setup.mockResolvedValueOnce({ success: false, error: "Email delivery failed." });
    render(<SetupForm configured />);
    await submit();
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Email delivery failed.");
    await waitFor(() => expect(alert.parentElement).toHaveFocus());
    await submit();
    expect(await screen.findByRole("heading", { name: "Check your email" })).toBeVisible();
  });
});
