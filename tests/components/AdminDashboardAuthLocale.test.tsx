import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "./render";
import dutch from "@/messages/nl-NL.json";
import SignInForm from "@/app/auth/sign-in/SignInForm";
import RegisterForm from "@/app/auth/register/RegisterForm";
import { DashboardClient } from "@/components/dashboard/DashboardClient";
import { AdminSidebar } from "@/app/(app)/admin/tabs/AdminSidebar";
const { sendMagicLink } = vi.hoisted(() => ({ sendMagicLink: vi.fn() }));
vi.mock("@/app/actions/auth", () => ({
  sendMagicLinkAction: sendMagicLink,
  registerHostAction: vi.fn(),
}));
vi.mock("@/components/ui/CaptchaProvider", () => ({
  useCaptcha: () => ({
    runWithCaptcha: (_action: string, callback: (token: null) => unknown) => callback(null),
  }),
}));

describe("admin, dashboard and auth locale rendering", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  it("preserves English default dashboard copy and user names", () => {
    render(
      <DashboardClient
        initialEvents={[]}
        initialInvites={[]}
        recentActivities={[]}
        userName="Alex <custom>"
        userRole="HOST"
        openRegistration={false}
      />
    );
    expect(
      screen.getByRole("heading", { name: "Welcome back, Alex <custom>!" })
    ).toBeInTheDocument();
    expect(screen.getByText("New event")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Host one!" })).toHaveAttribute(
      "href",
      "/dashboard/events/new"
    );
  });
  it("renders Dutch dashboard navigation without translating technical URLs or user content", () => {
    render(
      <DashboardClient
        initialEvents={[]}
        initialInvites={[]}
        recentActivities={[]}
        userName="Alex <custom>"
        userRole="GUEST"
        openRegistration
      />,
      { locale: "nl-NL", messages: dutch }
    );
    expect(
      screen.getByRole("heading", { name: "Welkom terug, Alex <custom>!" })
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Aankomend/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Organiseer er een!" })).toHaveAttribute(
      "href",
      "/auth/register"
    );
  });
  it("sends a Dutch sign-in form and renders the complete recipient confirmation", async () => {
    sendMagicLink.mockResolvedValue({ success: true });
    render(<SignInForm openRegistration />, { locale: "nl-NL", messages: dutch });
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "alex@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Inloglink en code versturen" }));
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Bekijk je e-mail" })).toBeInTheDocument()
    );
    expect(screen.getByText("alex@example.com")).toBeInTheDocument();
    expect(screen.getByText(/beide verlopen over 15 minuten/)).toBeInTheDocument();
    expect(sendMagicLink).toHaveBeenCalledWith("alex@example.com", undefined, null);
  });
  it("shows English registration defaults and Dutch invite code labels", () => {
    const english = render(<RegisterForm openRegistration={false} />);
    expect(screen.getByRole("button", { name: "Create account" })).toBeInTheDocument();
    english.unmount();
    render(<RegisterForm openRegistration={false} />, { locale: "nl-NL", messages: dutch });
    expect(screen.getByText("Uitnodigingscode")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Account aanmaken" })).toBeInTheDocument();
  });
  it("keeps admin tab IDs stable while displaying Dutch labels", () => {
    const change = vi.fn();
    render(<AdminSidebar activeTab="overview" handleTabChange={change} setFeedback={vi.fn()} />, {
      locale: "nl-NL",
      messages: dutch,
    });
    fireEvent.click(screen.getByRole("button", { name: /Gebruikersbeheer/ }));
    expect(change).toHaveBeenCalledWith("users");
  });
});
