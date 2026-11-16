import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getRequestTranslator } from "@/i18n/server";
import { getSetupState } from "@/lib/setup-state";
import { getSessionUser } from "@/lib/session-user";
import { getCaptchaSiteKey } from "@/lib/captcha";
import { CaptchaProvider } from "@/components/ui/CaptchaProvider";
import SetupForm from "./SetupForm";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getRequestTranslator();
  return { title: t("Ui.Auth.setupTitle"), robots: { index: false, follow: false } };
}

export default async function SetupPage() {
  const state = await getSetupState();
  if (!state.required) {
    const user = await getSessionUser();
    redirect(user?.role === "ADMIN" ? "/admin" : "/auth/sign-in");
  }
  return (
    <CaptchaProvider
      siteKey={getCaptchaSiteKey()}
      nonce={(await headers()).get("x-nonce") ?? undefined}
    >
      <SetupForm configured={state.configured} />
    </CaptchaProvider>
  );
}
