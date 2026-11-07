"use client";
import { useTranslations } from "next-intl";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { sendMagicLinkAction } from "@/app/actions/auth";
import { AppShell } from "@/components/ui/AppShell";
import { APP_SHELL, APP_SHELL_THEME as T } from "@/lib/theme";
import { AppCard } from "@/components/ui/AppPrimitives";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { InlineAlert } from "@/components/ui/Feedback";
import { useCaptcha } from "@/components/ui/CaptchaProvider";

function looksLikePhone(s: string): boolean {
  return /^\+?[\d\s\-().]{7,}$/.test(s.trim()) && s.replace(/\D/g, "").length >= 7;
}

function TokenError() {
  const tr = useTranslations("Ui.Auth");

  const searchParams = useSearchParams();
  if (searchParams.get("error") !== "invalid-token") return null;
  return (
    <InlineAlert theme={T} style={{ marginBottom: "20px" }}>
      {tr("thatLinkHasExpiredOrAlreadyBeenUsedRequest")}
    </InlineAlert>
  );
}

export default function SignInForm({
  openRegistration,
  redirect,
}: {
  openRegistration: boolean;
  redirect?: string;
}) {
  const tr = useTranslations("Ui.Auth");

  const [identifier, setIdentifier] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [authFailed, setAuthFailed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { runWithCaptcha } = useCaptcha();

  const isPhone = looksLikePhone(identifier);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setAuthFailed(false);
    setLoading(true);
    let result;
    try {
      result = await runWithCaptcha("signin", (token) =>
        sendMagicLinkAction(identifier, redirect, token)
      );
    } catch (reason) {
      setLoading(false);
      setError(reason instanceof Error ? reason.message : tr("securityCheckFailed"));
      return;
    }
    setLoading(false);
    if (result.error === "auth_failed") {
      setAuthFailed(true);
    } else if (result.success) {
      setSubmitted(true);
    } else {
      setError(result.error ?? tr("somethingWentWrong"));
    }
  };

  return (
    <AppShell center>
      <div style={{ width: "100%", maxWidth: "400px" }}>
        <div style={{ textAlign: "center", marginBottom: "40px" }}>
          <div style={{ fontSize: "36px", marginBottom: "12px" }}>🎉</div>
          <h1
            style={{
              color: APP_SHELL.textPrimary,
              fontSize: "28px",
              fontWeight: 800,
              marginBottom: "8px",
            }}
          >
            {tr("rsvp")}
          </h1>
          <p style={{ color: APP_SHELL.textSecondary, fontSize: "15px" }}>
            {tr("signInWithAMagicLink")}
          </p>
        </div>

        <AppCard style={{ borderRadius: APP_SHELL.authCardRadius, padding: "32px" }}>
          <Suspense>
            <TokenError />
          </Suspense>
          {submitted ? (
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: "48px", marginBottom: "16px" }}>{isPhone ? "📱" : "📬"}</div>
              <h2
                style={{
                  color: APP_SHELL.textPrimary,
                  fontSize: "20px",
                  fontWeight: 700,
                  marginBottom: "8px",
                }}
              >
                {isPhone ? tr("checkYourTexts") : tr("checkYourEmail")}
              </h2>
              <p style={{ color: APP_SHELL.textSecondary, fontSize: "14px", lineHeight: 1.6 }}>
                {tr.rich("weSentAMagicLinkToClickItMessage", {
                  part0: (chunks) => (
                    <strong style={{ color: "rgba(255,255,255,0.8)" }}>{chunks}</strong>
                  ),
                  value0: identifier,
                })}
              </p>
            </div>
          ) : authFailed ? (
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: "48px", marginBottom: "16px" }}>📭</div>
              <h2
                style={{
                  color: APP_SHELL.textPrimary,
                  fontSize: "20px",
                  fontWeight: 700,
                  marginBottom: "8px",
                }}
              >
                {tr("signInFailed")}
              </h2>
              <p
                style={{
                  color: APP_SHELL.textSecondary,
                  fontSize: "14px",
                  lineHeight: 1.6,
                  marginBottom: "20px",
                }}
              >
                {tr.rich("weCouldnTCompleteYourRequestIfYourMessage", {
                  part0: (chunks) => (
                    <code
                      style={{
                        background: "rgba(255,255,255,0.08)",
                        borderRadius: "4px",
                        padding: "1px 5px",
                        fontSize: "12px",
                        color: "rgba(255,255,255,0.7)",
                      }}
                    >
                      {chunks}
                    </code>
                  ),
                })}
              </p>
              <Button
                theme={T}
                variant="secondary"
                onClick={() => {
                  setAuthFailed(false);
                  setIdentifier("");
                }}
              >
                {tr("tryAgain")}
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <Field theme={T} label={tr("emailOrPhoneNumber")} style={{ marginBottom: "20px" }}>
                <Input
                  theme={T}
                  type="text"
                  required
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder={tr("youExampleComOr15550000000")}
                />
              </Field>

              {error && <InlineAlert theme={T}>{error}</InlineAlert>}

              <Button theme={T} variant="primary" type="submit" disabled={loading} fullWidth>
                {loading ? tr("sending") : tr("sendMagicLink")}
              </Button>

              <div style={{ textAlign: "center", marginTop: "20px" }}>
                <a
                  href="/auth/register"
                  style={{ color: APP_SHELL.textMuted, fontSize: "13px", textDecoration: "none" }}
                >
                  {openRegistration ? tr("noAccount") : tr("newHost")}{" "}
                  <span style={{ color: T.accentText }}>{tr("createOne")}</span>
                </a>
              </div>
            </form>
          )}
        </AppCard>
      </div>
    </AppShell>
  );
}
