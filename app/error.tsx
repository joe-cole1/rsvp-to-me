"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { APP_SHELL_THEME } from "@/lib/theme";
import { Button, buttonProps } from "@/components/ui/Button";

export default function RootError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("Ui.Errors.Common");
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "32px",
      }}
    >
      <div
        style={{
          textAlign: "center",
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: "24px",
          padding: "40px 32px",
          maxWidth: "400px",
          width: "100%",
        }}
      >
        <div style={{ fontSize: "48px", marginBottom: "16px" }}>⚠️</div>
        <h2
          style={{
            color: "#ffffff",
            fontSize: "20px",
            fontWeight: 800,
            marginBottom: "8px",
            margin: "0 0 8px",
          }}
        >
          {t("title")}
        </h2>
        <p
          style={{
            color: "rgba(255,255,255,0.5)",
            fontSize: "14px",
            lineHeight: 1.6,
            marginBottom: "24px",
          }}
        >
          {t("description")}
        </p>
        <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
          <Button theme={APP_SHELL_THEME} variant="primary" onClick={() => reset()}>
            {t("retry")}
          </Button>
          <Link href="/" {...buttonProps(APP_SHELL_THEME, { variant: "secondary" })}>
            {t("home")}
          </Link>
        </div>
      </div>
    </div>
  );
}
