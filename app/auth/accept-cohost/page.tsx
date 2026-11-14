import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import { hashToken } from "@/lib/hash";
import { getRequestTranslator } from "@/i18n/server";
import { StatePage } from "@/components/ui/StatePage";
import { Button, buttonProps } from "@/components/ui/Button";
import { APP_SHELL_THEME } from "@/lib/theme";
import { acceptCoHost } from "./actions";

export default async function AcceptCoHostPage(props: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await props.searchParams;
  if (!token || token.length > 128) redirect("/auth/sign-in?error=invalid-token");
  const returnTo = `/auth/accept-cohost?token=${encodeURIComponent(token)}`;
  const session = await getSession();
  if (!session) redirect(`/auth/sign-in?redirect=${encodeURIComponent(returnTo)}`);
  const [invitation, user, t] = await Promise.all([
    db.coHostInvitation.findUnique({ where: { token: hashToken(token) } }),
    db.user.findUnique({ where: { id: session.userId }, select: { email: true } }),
    getRequestTranslator(),
  ]);
  const matches =
    invitation &&
    invitation.expiresAt > new Date() &&
    user?.email &&
    invitation.email.toLowerCase() === user.email.toLowerCase();
  return (
    <StatePage
      title={t("Ui.Auth.CoHost.title")}
      description={t(matches ? "Ui.Auth.CoHost.confirm" : "Ui.Auth.CoHost.wrongAccount")}
      actions={
        matches ? (
          <form action={acceptCoHost}>
            <input type="hidden" name="token" value={token} />
            <Button theme={APP_SHELL_THEME} type="submit">
              {t("Ui.Auth.CoHost.accept")}
            </Button>
          </form>
        ) : (
          <a
            href={`/auth/sign-in?redirect=${encodeURIComponent(returnTo)}`}
            {...buttonProps(APP_SHELL_THEME, { variant: "secondary" })}
          >
            {t("Ui.Event.Page.signIn")}
          </a>
        )
      }
    />
  );
}
