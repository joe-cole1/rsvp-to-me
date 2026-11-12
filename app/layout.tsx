import { NextIntlClientProvider } from "next-intl";
import { getRequestLocale, getRequestTranslator } from "@/i18n/server";
import { loadMessages } from "@/i18n/catalogs";
import { locales } from "@/i18n/config";
import { getSessionUser } from "@/lib/session-user";
import GlobalHeader from "@/components/ui/GlobalHeader";
import type { Metadata } from "next";
import { connection } from "next/server";
import { themeFontVariables } from "./fonts";
import "./globals.css";

const baseMetadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
  title: {
    default: "RSVP to Me",
    template: "%s | RSVP to Me",
  },
  manifest: "/site.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "48x48" },
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    apple: "/apple-icon.png",
  },
  openGraph: {
    type: "website",
    siteName: "RSVP to Me",
  },
};

export async function generateMetadata(): Promise<Metadata> {
  const t = await getRequestTranslator();
  return { ...baseMetadata, description: t("Ui.Common.siteDescription") };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await connection();
  const locale = await getRequestLocale();
  const messages = await loadMessages(locale);
  const user = await getSessionUser();

  return (
    <html
      lang={locale}
      dir={locales[locale].dir}
      className={`${themeFontVariables} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <NextIntlClientProvider locale={locale} messages={{ Ui: messages.Ui }}>
          <GlobalHeader user={user} />
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
