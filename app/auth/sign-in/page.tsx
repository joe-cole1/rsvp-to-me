import type { Metadata } from "next";
import SignInForm from "./SignInForm";
import { isOpenRegistrationActive } from "@/lib/auth";
import { CaptchaProvider } from "@/components/ui/CaptchaProvider";
import { getCaptchaSiteKey } from "@/lib/captcha";
import { getSessionUser } from "@/lib/session-user";

export const metadata: Metadata = { title: "Sign In" };

export const dynamic = "force-dynamic";

export default async function SignInPage(props: { searchParams: Promise<{ redirect?: string }> }) {
  const { redirect } = await props.searchParams;
  const [openRegistration, sessionUser] = await Promise.all([
    isOpenRegistrationActive(),
    getSessionUser(),
  ]);
  return (
    <CaptchaProvider siteKey={getCaptchaSiteKey()} bypass={sessionUser?.role === "ADMIN"}>
      <SignInForm openRegistration={openRegistration} redirect={redirect} />
    </CaptchaProvider>
  );
}
