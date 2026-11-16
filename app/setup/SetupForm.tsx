"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { startAdminSetupAction } from "@/app/actions/auth";
import SignInCodeForm from "@/app/auth/SignInCodeForm";
import { AppShell } from "@/components/ui/AppShell";
import { AppCard } from "@/components/ui/AppPrimitives";
import { APP_SHELL_THEME as T } from "@/lib/theme";
import { Button, buttonProps } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { InlineAlert } from "@/components/ui/Feedback";
import { useCaptcha } from "@/components/ui/CaptchaProvider";

export default function SetupForm({ configured }: { configured: boolean }) {
  const t = useTranslations("Ui.Auth");
  const { runWithCaptcha } = useCaptcha();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const feedback = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (error) feedback.current?.focus();
  }, [error]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      const result = await runWithCaptcha("register", (token) =>
        startAdminSetupAction(email, name, token)
      );
      if (result.success) setSubmitted(true);
      else setError(result.error ?? t("somethingWentWrong"));
    } catch {
      setError(t("somethingWentWrong"));
    } finally {
      setPending(false);
    }
  }

  return (
    <AppShell center>
      <div style={{ width: "100%", maxWidth: "400px" }}>
        <AppCard style={{ padding: "24px" }}>
          <h1 style={{ color: T.textPrimary, fontSize: "24px", margin: "0 0 16px" }}>
            {t("setupTitle")}
          </h1>
          {!configured ? (
            <>
              <p style={{ color: T.textSecondary, fontSize: "14px", lineHeight: 1.6 }}>
                {t("setupConfigure")}
              </p>
              <p style={{ color: T.textSecondary, fontSize: "14px", lineHeight: 1.6 }}>
                {t("setupNoSamples")}
              </p>
            </>
          ) : submitted ? (
            <>
              <h2 style={{ color: T.textPrimary, fontSize: "20px" }}>{t("checkYourEmail")}</h2>
              <p style={{ color: T.textSecondary, fontSize: "14px", lineHeight: 1.6 }}>
                {t("setupCheckEmail")}
              </p>
              <SignInCodeForm identifier={email} redirect="/admin" />
              <Button
                theme={T}
                variant="link"
                onClick={() => {
                  setSubmitted(false);
                  setError(null);
                }}
              >
                {t("setupChangeEmail")}
              </Button>
            </>
          ) : (
            <>
              <p style={{ color: T.textSecondary, fontSize: "14px", lineHeight: 1.6 }}>
                {t("setupDescription")}
              </p>
              <form onSubmit={submit}>
                <Field theme={T} label={t("yourName")}>
                  <Input
                    theme={T}
                    autoComplete="name"
                    required
                    maxLength={100}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={pending}
                  />
                </Field>
                <Field theme={T} label={t("emailAddress")} hint={t("setupEmailHint")}>
                  <Input
                    theme={T}
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={pending}
                  />
                </Field>
                {error && (
                  <div ref={feedback} tabIndex={-1}>
                    <InlineAlert theme={T}>{error}</InlineAlert>
                  </div>
                )}
                <Button theme={T} type="submit" variant="primary" disabled={pending} fullWidth>
                  {pending ? t("sending") : t("setupSend")}
                </Button>
              </form>
            </>
          )}
          <div style={{ marginTop: "24px" }}>
            <a href="/auth/sign-in" {...buttonProps(T, { variant: "link" })}>
              {t("goToSignIn")}
            </a>
          </div>
        </AppCard>
      </div>
    </AppShell>
  );
}
