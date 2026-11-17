"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { requestRsvpVerification, verifyRsvpVerification } from "@/app/actions/event";
import { Button } from "@/components/ui/Button";
import { EventCard } from "@/components/event/event-page/EventCard";
import { Field, Input } from "@/components/ui/Field";
import { InlineAlert } from "@/components/ui/Feedback";
import { useCaptcha } from "@/components/ui/CaptchaProvider";
import type { ResolvedTheme } from "@/lib/theme";
import type { RsvpContactReceipt } from "@/lib/rsvp-contact-proof";

export function RsvpContactVerification({
  eventId,
  contacts,
  theme,
  onVerified,
  onBack,
}: {
  eventId: string;
  contacts: { channel: "email" | "sms"; destination: string }[];
  theme: ResolvedTheme;
  onVerified: (proofs: RsvpContactReceipt[]) => void;
  onBack: () => void;
}) {
  const t = useTranslations("Ui.Rsvp.RsvpFlow");
  const [proofs, setProofs] = useState<RsvpContactReceipt[]>([]);
  const [challengeId, setChallengeId] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [pending, startTransition] = useTransition();
  const { runWithCaptcha } = useCaptcha();
  const contact = contacts[proofs.length];
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
  }, [proofs.length]);
  useEffect(() => {
    if (!cooldown) return;
    const timer = setTimeout(() => setCooldown((value) => Math.max(0, value - 1)), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);
  function send() {
    startTransition(async () => {
      setError(null);
      try {
        const result = await runWithCaptcha("rsvp_create", (token) =>
          requestRsvpVerification({ eventId, ...contact }, token)
        );
        if (!result.success) {
          setError(result.error);
          return;
        }
        setChallengeId(result.challengeId);
        setCode("");
        setCooldown(60);
      } catch {
        setError(t("somethingWentWrong"));
      }
    });
  }
  function verify() {
    startTransition(async () => {
      setError(null);
      try {
        const result = await verifyRsvpVerification({ eventId, challengeId, code });
        if (!result.success) {
          setError(result.error);
          return;
        }
        const next = [...proofs, result.proof];
        if (next.length === contacts.length) {
          onVerified(next);
          return;
        }
        setProofs(next);
        setChallengeId("");
        setCode("");
        setCooldown(0);
      } catch {
        setError(t("somethingWentWrong"));
      }
    });
  }
  return (
    <EventCard
      as="form"
      theme={theme}
      onSubmit={(event) => {
        event.preventDefault();
        if (challengeId) verify();
        else send();
      }}
    >
      <h2
        ref={heading}
        tabIndex={-1}
        style={{ fontSize: 15, fontWeight: 700, margin: "0 0 16px", color: theme.textPrimary }}
      >
        {t("verifyContact")}
      </h2>
      <p aria-current="step" style={{ color: theme.textSecondary, fontSize: 14 }}>
        {t("verificationProgress", { current: proofs.length + 1, total: contacts.length })}
      </p>
      <p style={{ color: theme.textSecondary, fontSize: 14 }}>{t("verificationInstructions")}</p>
      <p style={{ color: theme.textPrimary, overflowWrap: "anywhere" }}>{contact.destination}</p>
      {challengeId && (
        <>
          <Field theme={theme} label={t("verificationCode")}>
            <Input
              theme={theme}
              autoFocus
              autoComplete="one-time-code"
              inputMode="numeric"
              pattern="[0-9]{8}"
              required
              maxLength={8}
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
            />
          </Field>
          <InlineAlert theme={theme} tone="info">
            {t("verificationSent")}
          </InlineAlert>
          <Button
            theme={theme}
            variant="link"
            type="button"
            disabled={pending || cooldown > 0}
            onClick={send}
          >
            {cooldown > 0 ? t("resendIn", { seconds: cooldown }) : t("resendCode")}
          </Button>
        </>
      )}
      {error && <InlineAlert theme={theme}>{error}</InlineAlert>}
      <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
        <Button theme={theme} variant="secondary" type="button" disabled={pending} onClick={onBack}>
          {t("back")}
        </Button>
        <Button
          theme={theme}
          variant="primary"
          type="submit"
          disabled={pending || (!!challengeId && code.length !== 8)}
        >
          {pending ? t("saving") : challengeId ? t("verifyCode") : t("sendCode")}
        </Button>
      </div>
    </EventCard>
  );
}
