"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { sendMagicLinkAction, verifySignInCodeAction } from "@/app/actions/auth";
import { useCaptcha } from "@/components/ui/CaptchaProvider";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { InlineAlert } from "@/components/ui/Feedback";
import { safeRedirectPath } from "@/lib/safe-redirect";
import { APP_SHELL_THEME as T } from "@/lib/theme";

export default function SignInCodeForm({
  identifier,
  redirect,
}: {
  identifier: string;
  redirect?: string;
}) {
  const tr = useTranslations("Ui.Auth");
  const errors = useTranslations("Ui.Errors.Auth");
  const { runWithCaptcha } = useCaptcha();
  const [code, setCode] = useState("");
  const [pending, setPending] = useState<"verify" | "resend" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resent, setResent] = useState(false);

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    if (pending || code.length !== 6) return;
    setPending("verify");
    setError(null);
    setResent(false);
    try {
      const result = await verifySignInCodeAction(identifier, code);
      if (result.success) {
        window.location.assign(safeRedirectPath(redirect));
      } else {
        setError(result.error);
      }
    } catch {
      setError(errors("invalidCode"));
    } finally {
      setPending(null);
    }
  }

  async function resend() {
    if (pending) return;
    setPending("resend");
    setError(null);
    setResent(false);
    try {
      const result = await runWithCaptcha("signin", (token) =>
        sendMagicLinkAction(identifier, redirect, token)
      );
      if (result.success) {
        setCode("");
        setResent(true);
      } else {
        setError(
          result.error === "auth_failed"
            ? tr("somethingWentWrong")
            : (result.error ?? tr("somethingWentWrong"))
        );
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : tr("securityCheckFailed"));
    } finally {
      setPending(null);
    }
  }

  return (
    <form onSubmit={verify} style={{ marginTop: "24px", textAlign: "left" }}>
      <Field theme={T} label={tr("signInCode")} hint={tr("codeExpiry")}>
        <Input
          theme={T}
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          required
          value={code}
          disabled={pending !== null}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
        />
      </Field>
      {error && <InlineAlert theme={T}>{error}</InlineAlert>}
      {resent && (
        <InlineAlert theme={T} tone="success">
          {tr("codeResent")}
        </InlineAlert>
      )}
      <Button
        theme={T}
        variant="primary"
        type="submit"
        fullWidth
        disabled={pending !== null || code.length !== 6}
      >
        {pending === "verify" ? tr("signingIn") : tr("signIn")}
      </Button>
      <div style={{ marginTop: "16px", textAlign: "center" }}>
        <Button theme={T} variant="link" type="button" disabled={pending !== null} onClick={resend}>
          {pending === "resend" ? tr("sending") : tr("resend")}
        </Button>
      </div>
    </form>
  );
}
