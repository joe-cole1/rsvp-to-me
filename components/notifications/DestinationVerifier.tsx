"use client";

import { useState, useTransition, type CSSProperties } from "react";
import { useTranslations } from "next-intl";
import { useCaptcha } from "@/components/ui/CaptchaProvider";
import { AppButton, AppInput, FormField } from "@/components/ui/AppPrimitives";
import { buttonStyle } from "@/components/event/invitations/styles";
import type { ResolvedTheme } from "@/lib/theme";
import type { Channel } from "@/lib/notifications/preferences";
import type { ManagementData, ManagementScope } from "@/lib/notifications/manage";
import { beginNotificationProof, completeNotificationProof } from "@/app/actions/notifications";
import { actionFailure } from "./action-error";

/**
 * Proves a destination with a one-time code: enter it, then enter the code. Verification never
 * changes consent: it only adds or replaces an address (a reusable profile address, or this
 * event's contact). The parent decides when the form is open.
 */
export function DestinationVerifier({
  scope,
  channel,
  theme,
  onVerified,
  onError,
  onCancel,
}: {
  scope: ManagementScope;
  channel: Channel;
  theme: ResolvedTheme;
  onVerified: (data: ManagementData) => void;
  onError: (message: string, code?: string) => void;
  onCancel: () => void;
}) {
  const t = useTranslations("Ui.Notifications");
  const { runWithCaptcha } = useCaptcha();
  const [destination, setDestination] = useState("");
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [pending, startTransition] = useTransition();
  const hint: CSSProperties = { margin: 0, fontSize: "13px", color: theme.textSecondary };
  const failed = (error: unknown) => {
    const { code: failure } = actionFailure(error);
    onError(t(`errors.${failure}`), failure);
  };
  const cancel = (
    <button type="button" style={buttonStyle} onClick={onCancel}>
      {t("cancel")}
    </button>
  );
  if (!challengeId)
    return (
      <>
        <FormField label={t(channel === "email" ? "newEmail" : "newPhone")}>
          <AppInput
            type={channel === "email" ? "email" : "tel"}
            autoComplete={channel === "email" ? "email" : "tel"}
            value={destination}
            onChange={(event) => setDestination(event.target.value)}
            placeholder={channel === "email" ? "you@example.com" : "+15551234567"}
          />
        </FormField>
        <p style={hint}>{t("sendHint")}</p>
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <AppButton
            type="button"
            disabled={pending || !destination.trim()}
            onClick={() =>
              startTransition(async () => {
                try {
                  const result = await runWithCaptcha("profile_edit", (token) =>
                    beginNotificationProof(scope, { channel, destination }, token)
                  );
                  if (result.success) setChallengeId(result.data.challengeId);
                  else onError(result.error, result.code);
                } catch (error) {
                  failed(error);
                }
              })
            }
          >
            {pending ? t("saving") : t("sendCode")}
          </AppButton>
          {cancel}
        </div>
      </>
    );
  return (
    <>
      <FormField label={t("code")}>
        <AppInput
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={8}
          value={code}
          onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
        />
      </FormField>
      <p style={hint}>{t("codeHint")}</p>
      <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
        <AppButton
          type="button"
          disabled={pending || !/^\d{8}$/.test(code)}
          onClick={() =>
            startTransition(async () => {
              try {
                const result = await completeNotificationProof(scope, { challengeId, code });
                if (result.success) onVerified(result.data);
                else onError(result.error, result.code);
              } catch (error) {
                failed(error);
              }
            })
          }
        >
          {pending ? t("saving") : t("verify")}
        </AppButton>
        {cancel}
      </div>
    </>
  );
}
