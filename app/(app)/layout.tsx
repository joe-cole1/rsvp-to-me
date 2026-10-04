import { APP_SHELL } from "@/lib/theme";
import { AppTopNav } from "@/components/ui/AppNav";
import { getSessionUser } from "@/lib/session-user";
import { CaptchaProvider } from "@/components/ui/CaptchaProvider";
import { getCaptchaSiteKey } from "@/lib/captcha";
import { headers } from "next/headers";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  const sessionUser = await getSessionUser();

  return (
    <CaptchaProvider
      siteKey={getCaptchaSiteKey()}
      bypass={sessionUser?.role === "ADMIN"}
      nonce={nonce}
    >
      <div
        style={{
          minHeight: "100vh",
          background: APP_SHELL.pageBg,
          color: APP_SHELL.textPrimary,
          fontFamily: "inherit",
        }}
      >
        <AppTopNav user={sessionUser} />
        {children}
      </div>
    </CaptchaProvider>
  );
}
