import type { Metadata } from "next";
import RegisterForm from "./RegisterForm";
import { isOpenRegistrationActive } from "@/lib/auth";
import { CaptchaProvider } from "@/components/ui/CaptchaProvider";
import { getCaptchaSiteKey } from "@/lib/captcha";
import { getSessionUser } from "@/lib/session-user";
import { headers } from "next/headers";

export const metadata: Metadata = { title: "Create Account" };

export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  const [openRegistration, sessionUser] = await Promise.all([
    isOpenRegistrationActive(),
    getSessionUser(),
  ]);
  return (
    <CaptchaProvider
      siteKey={getCaptchaSiteKey()}
      bypass={sessionUser?.role === "ADMIN"}
      nonce={nonce}
    >
      <RegisterForm openRegistration={openRegistration} />
    </CaptchaProvider>
  );
}
