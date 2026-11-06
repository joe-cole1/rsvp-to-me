"use client";

import { useTranslations } from "next-intl";

import { useState, useTransition } from "react";
import type { ResolvedTheme } from "@/lib/theme";
import { deleteEvent } from "@/app/actions/event";
import { Dialog } from "@/components/ui/Dialog";
import { EventCard } from "@/components/event/event-page/EventCard";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { InlineAlert } from "@/components/ui/Feedback";

export function DangerZonePanel({ eventId, t }: { eventId: string; t: ResolvedTheme }) {
  const translate = useTranslations("Ui.Event.DangerZonePanel");

  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const danger = t.status.error;

  const handleDelete = () => {
    if (confirmText !== "DELETE") return;
    setError(null);
    startTransition(async () => {
      try {
        const res = await deleteEvent(eventId);
        if (res && res.success) {
          window.location.href = "/dashboard";
        } else {
          setError(translate("failedDeleteEvent"));
        }
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : translate("errorOccurred");
        setError(errMsg);
      }
    });
  };

  return (
    <>
      <EventCard
        theme={t}
        style={{
          border: `1px solid ${danger.border}`,
          padding: "20px",
        }}
      >
        <h2 style={{ fontSize: "15px", fontWeight: 700, color: danger.text, marginBottom: "12px" }}>
          {translate("dangerZone")}
        </h2>
        <p
          style={{
            fontSize: "13px",
            color: t.textSecondary,
            marginBottom: "16px",
            lineHeight: "1.5",
          }}
        >
          {translate("deleteEventPermanentlyEraseAllGuest")}
        </p>
        <Button
          theme={t}
          variant="destructive"
          fullWidth
          type="button"
          onClick={() => setShowConfirm(true)}
        >
          {translate("deleteEvent")}
        </Button>
      </EventCard>

      <Dialog
        open={showConfirm}
        onClose={() => {
          setShowConfirm(false);
          setConfirmText("");
          setError(null);
        }}
        titleId="delete-event-dialog-title"
        closeOnBackdrop={!isPending}
        panelStyle={{
          background: t.cardBg,
          border: `1px solid ${danger.border}`,
          borderRadius: t.cardRadius,
          padding: "24px",
          maxWidth: "360px",
          backdropFilter: "blur(20px)",
          boxShadow: "0 10px 40px rgba(0,0,0,0.4)",
          color: t.textPrimary,
        }}
      >
        <h3
          id="delete-event-dialog-title"
          style={{
            fontSize: "18px",
            fontWeight: 800,
            color: danger.text,
            margin: "0 0 12px",
          }}
        >
          {translate("deleteEvent2")}
        </h3>
        <p
          style={{
            fontSize: "13px",
            color: t.textSecondary,
            margin: "0 0 16px",
            lineHeight: "1.5",
          }}
        >
          {translate("actionPermanentCannotUndoneConfirmPlease")}{" "}
          <strong style={{ color: t.textPrimary }}>DELETE</strong> {translate("boxBelow")}
        </p>
        <Input
          theme={t}
          type="text"
          aria-label="DELETE"
          placeholder="DELETE"
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          style={{ marginBottom: "16px" }}
          autoComplete="off"
        />
        {error && (
          <InlineAlert theme={t} style={{ marginBottom: "12px" }}>
            {error}
          </InlineAlert>
        )}
        <div style={{ display: "flex", gap: "10px" }}>
          <Button
            theme={t}
            variant="secondary"
            type="button"
            onClick={() => {
              setShowConfirm(false);
              setConfirmText("");
              setError(null);
            }}
            disabled={isPending}
            style={{ flex: 1 }}
          >
            {translate("cancel")}
          </Button>
          <Button
            theme={t}
            variant="destructive"
            type="button"
            onClick={handleDelete}
            disabled={confirmText !== "DELETE" || isPending}
            style={{ flex: 1 }}
          >
            {isPending ? translate("deleting") : translate("confirmDelete")}
          </Button>
        </div>
      </Dialog>
    </>
  );
}
