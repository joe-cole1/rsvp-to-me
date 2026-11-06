"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { InlineAlert } from "@/components/ui/Feedback";

import { Mail } from "lucide-react";
import { useState, useTransition } from "react";
import { inviteFriendAsGuest } from "@/app/actions/event";
import type { ResolvedTheme } from "@/lib/theme";
import { EventCard } from "./EventCard";
import { useCaptcha } from "@/components/ui/CaptchaProvider";

export function GuestInviteFriendCard({
  eventId,
  guestToken,
  theme: t,
}: {
  eventId: string;
  guestToken: string;
  theme: ResolvedTheme;
}) {
  const translate = useTranslations("Ui.Event.GuestInviteFriendCard");

  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const { runWithCaptcha } = useCaptcha();

  const handleSend = () => {
    const val = target.trim();
    if (!val) return;
    setStatus("idle");
    setErrorMsg("");
    startTransition(async () => {
      try {
        const res = await runWithCaptcha("guest_invite", (token) =>
          inviteFriendAsGuest(eventId, guestToken, val, token, name.trim() || undefined)
        );
        if (res.success) {
          setStatus("success");
          setTarget("");
          setName("");
          return;
        }
        setStatus("error");
        setErrorMsg(res.error ?? translate("failedSendInvitation"));
      } catch (reason) {
        setStatus("error");
        setErrorMsg(reason instanceof Error ? reason.message : translate("securityCheckFailed"));
      }
    });
  };

  return (
    <EventCard theme={t}>
      <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "12px" }}>
        <Mail size={16} style={{ color: t.accent }} />
        <span
          style={{
            fontWeight: 700,
            fontSize: "14.5px",
            color: t.textPrimary,
          }}
        >
          {translate("inviteFriend")}
        </span>
      </div>
      <p style={{ fontSize: "13px", color: t.textSecondary, margin: "0 0 12px", lineHeight: 1.4 }}>
        {translate("eventPrivateCanInviteFriendsBy")}
      </p>
      <Field theme={t} label={translate("nameOptional")} style={{ marginBottom: "10px" }}>
        <Input
          theme={t}
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={100}
          disabled={isPending}
        />
      </Field>
      <div style={{ display: "flex", gap: "8px", width: "100%" }}>
        <Input
          theme={t}
          style={{ flex: 1, width: "auto" }}
          aria-label={translate("friendEmailComOr15551234567")}
          placeholder={translate("friendEmailComOr15551234567")}
          value={target}
          disabled={isPending}
          onChange={(e) => setTarget(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && target.trim() && !isPending) handleSend();
          }}
        />
        <Button
          theme={t}
          variant="primary"
          onClick={handleSend}
          disabled={!target.trim() || isPending}
          style={{ whiteSpace: "nowrap" }}
        >
          {isPending ? translate("sending") : translate("send")}
        </Button>
      </div>
      {status === "success" && (
        <InlineAlert theme={t} tone="success" style={{ marginTop: "8px", marginBottom: 0 }}>
          {translate("invitationSentSuccessfully")}
        </InlineAlert>
      )}
      {status === "error" && (
        <InlineAlert theme={t} tone="error" style={{ marginTop: "8px", marginBottom: 0 }}>
          {errorMsg}
        </InlineAlert>
      )}
    </EventCard>
  );
}
