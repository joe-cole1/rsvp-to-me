import type { EmailI18nProps } from "../i18n";

export function NotificationVerificationEmail({
  code,
  i18n,
  purpose,
}: EmailI18nProps & { code: string; purpose?: "rsvp" }) {
  return (
    <html lang={i18n?.locale}>
      <body>
        <h1>
          {i18n?.t(
            purpose === "rsvp"
              ? "Notifications.rsvpVerificationSubject"
              : "Notifications.verificationSubject"
          )}
        </h1>
        <p>
          {i18n?.t(
            purpose === "rsvp"
              ? "Notifications.rsvpVerificationBody"
              : "Notifications.verificationBody",
            { code }
          )}
        </p>
      </body>
    </html>
  );
}
