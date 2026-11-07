"use client";

import { useTranslations } from "next-intl";
import { APP_SHELL_THEME } from "@/lib/theme";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { InlineAlert } from "@/components/ui/Feedback";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { verifyEventPassword } from "@/app/actions/event";
import { useCaptcha } from "@/components/ui/CaptchaProvider";

export function PasswordGate({ slug }: { slug: string }) {
  const translate = useTranslations("Ui.Event.PasswordGate");

  const [pw, setPw] = useState("");
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { runWithCaptcha } = useCaptcha();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pw.trim() || loading) return;
    setError(false);
    setLoading(true);
    try {
      const res = await runWithCaptcha("event_password", (token) =>
        verifyEventPassword(slug, pw.trim(), token)
      );
      if (res.success) {
        router.refresh();
      } else {
        setError(true);
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0a0a0f",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        fontFamily: "inherit",
      }}
    >
      <div
        style={{
          background: "rgba(255,255,255,0.05)",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: "20px",
          padding: "32px 28px",
          width: "100%",
          maxWidth: "360px",
          color: "#fff",
        }}
      >
        <div style={{ fontSize: "32px", textAlign: "center", marginBottom: "16px" }}>🔒</div>
        <h1 style={{ fontSize: "20px", fontWeight: 700, textAlign: "center", marginBottom: "8px" }}>
          {translate("privateEvent")}
        </h1>
        <p
          style={{
            color: "rgba(255,255,255,0.5)",
            fontSize: "14px",
            textAlign: "center",
            marginBottom: "24px",
          }}
        >
          {translate("enterPasswordViewEvent")}
        </p>
        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <Input
            theme={APP_SHELL_THEME}
            type="text"
            aria-label={translate("eventPassword")}
            placeholder={translate("eventPassword")}
            value={pw}
            onChange={(e) => {
              setPw(e.target.value);
              setError(false);
            }}
            aria-invalid={error || undefined}
            autoFocus
            disabled={loading}
          />
          {error && (
            <InlineAlert theme={APP_SHELL_THEME} style={{ marginBottom: 0 }}>
              {translate("incorrectPassword")}
            </InlineAlert>
          )}
          <Button
            theme={APP_SHELL_THEME}
            variant="primary"
            type="submit"
            fullWidth
            disabled={!pw.trim() || loading}
          >
            {loading ? translate("verifying") : translate("enterEvent")}
          </Button>
        </form>
      </div>
    </div>
  );
}
