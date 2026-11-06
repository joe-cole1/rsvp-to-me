"use client";
import { useState } from "react";
import { NextIntlClientProvider, useTranslations } from "next-intl";
import english from "@/messages/en-US.json";
import { loadMessages } from "@/i18n/catalogs";
import { DEFAULT_LOCALE, locales, type Locale } from "@/i18n/config";
import { AppTopNav } from "@/components/ui/AppNav";
import { APP_SHELL_THEME } from "@/lib/theme";
import { Button } from "@/components/ui/Button";

export function GlobalErrorContent({
  reset,
  onLocaleChange,
}: {
  reset: () => void;
  onLocaleChange: (locale: Locale) => Promise<void>;
}) {
  const t = useTranslations("Ui.Errors.Common");
  return (
    <>
      <AppTopNav user={null} onLocaleChange={onLocaleChange} />
      <div style={{ margin: "80px auto", textAlign: "center", padding: 32, maxWidth: 400 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
        <h1 style={{ color: "#fff", fontSize: 22, fontWeight: 800, marginBottom: 8 }}>
          {t("title")}
        </h1>
        <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 14, marginBottom: 24 }}>
          {t("globalDescription")}
        </p>
        <Button theme={APP_SHELL_THEME} variant="primary" onClick={reset}>
          {t("reload")}
        </Button>
      </div>
    </>
  );
}
export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [locale, setLocale] = useState<Locale>(DEFAULT_LOCALE);
  const [messages, setMessages] = useState(english.Ui);
  async function selectLocale(value: Locale) {
    const catalog = await loadMessages(value);
    setMessages(catalog.Ui);
    setLocale(value);
  }
  return (
    <html lang={locale} dir={locales[locale].dir}>
      <body
        style={{ margin: 0, minHeight: "100vh", background: "#0a0a0f", fontFamily: "sans-serif" }}
      >
        <NextIntlClientProvider locale={locale} messages={{ Ui: messages }}>
          <GlobalErrorContent reset={reset} onLocaleChange={selectLocale} />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
