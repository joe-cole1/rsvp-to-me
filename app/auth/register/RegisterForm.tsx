"use client";
import { useTranslations } from "next-intl";

import { useState } from "react";
import { registerHostAction } from "@/app/actions/auth";
import SignInCodeForm from "../SignInCodeForm";
import { AppShell } from "@/components/ui/AppShell";
import { APP_SHELL, APP_SHELL_THEME as T } from "@/lib/theme";
import { AppCard } from "@/components/ui/AppPrimitives";
import { Button, buttonProps } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { InlineAlert } from "@/components/ui/Feedback";
import { useCaptcha } from "@/components/ui/CaptchaProvider";

export default function RegisterForm({ openRegistration }: { openRegistration: boolean }) {
  const tr = useTranslations("Ui.Auth");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { runWithCaptcha } = useCaptcha();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    let result;
    try {
      result = await runWithCaptcha("register", (token) =>
        registerHostAction(email, name, openRegistration ? "" : code, token)
      );
    } catch (reason) {
      setLoading(false);
      setError(reason instanceof Error ? reason.message : tr("securityCheckFailed"));
      return;
    }
    setLoading(false);
    if (result.success) {
      setSubmitted(true);
    } else {
      setError(result.error ?? tr("somethingWentWrong"));
    }
  };

  return (
    <AppShell center>
      <div style={{ width: "100%", maxWidth: "400px" }}>
        <div style={{ textAlign: "center", marginBottom: "40px" }}>
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
            {tr("createAnAccount")}
          </p>
        </div>

        <AppCard style={{ borderRadius: APP_SHELL.authCardRadius, padding: "32px" }}>
          {submitted ? (
            <div style={{ textAlign: "center" }}>
              <h2
                style={{
                  color: APP_SHELL.textPrimary,
                  fontSize: "20px",
                  fontWeight: 700,
                  marginBottom: "8px",
                }}
              >
                {tr("checkYourEmail")}
              </h2>
              <p
                style={{
                  color: APP_SHELL.textSecondary,
                  fontSize: "14px",
                  lineHeight: 1.6,
                  marginBottom: "24px",
                }}
              >
                {tr("checkYourEmailForAMagicLinkToSign")}
              </p>
              <SignInCodeForm identifier={email} />
              <a href="/auth/sign-in" {...buttonProps(T, { variant: "link" })}>
                {tr("goToSignIn")}
              </a>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <Field theme={T} label={tr("yourName")}>
                <Input
                  theme={T}
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={tr("janeSmith")}
                />
              </Field>
              <Field theme={T} label={tr("emailAddress")}>
                <Input
                  theme={T}
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={tr("youExampleCom")}
                />
              </Field>
              {!openRegistration && (
                <Field theme={T} label={tr("inviteCode")}>
                  <Input
                    theme={T}
                    type="text"
                    required
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder={tr("enterYourInviteCode")}
                  />
                </Field>
              )}

              {error && <InlineAlert theme={T}>{error}</InlineAlert>}

              <Button theme={T} variant="primary" type="submit" disabled={loading} fullWidth>
                {loading ? tr("creatingAccount") : tr("createAccount")}
              </Button>

              <div style={{ textAlign: "center", marginTop: "20px" }}>
                {tr.rich("alreadyHaveAnAccountSignInMessage", {
                  part0: (chunks) => (
                    <a
                      href="/auth/sign-in"
                      style={{
                        color: APP_SHELL.textMuted,
                        fontSize: "13px",
                        textDecoration: "none",
                      }}
                    >
                      {chunks}
                    </a>
                  ),
                  part1: (chunks) => <span style={{ color: T.accentText }}>{chunks}</span>,
                })}
              </div>
            </form>
          )}
        </AppCard>
      </div>
    </AppShell>
  );
}
