import type { EmailI18nProps } from "../i18n";

export function NotificationVerificationEmail({ code, i18n }: EmailI18nProps & { code: string }) {
  return (
    <html lang={i18n?.locale}>
      <body>
        <h1>{i18n?.t("Notifications.verificationSubject")}</h1>
        <p>{i18n?.t("Notifications.verificationBody", { code })}</p>
      </body>
    </html>
  );
}
