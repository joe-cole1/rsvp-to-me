"use client";

import { useTranslations } from "next-intl";

import { useEffect, useState } from "react";
import { Send } from "lucide-react";
import type { ResolvedTheme } from "@/lib/theme";
import {
  getEventEmailPreview,
  sendEventEmailTest,
  getEventEmailTemplates,
} from "@/app/actions/event";
import { Section } from "./ui";
import { Button } from "@/components/ui/Button";
import { Field, Select } from "@/components/ui/Field";
import { useCaptcha } from "@/components/ui/CaptchaProvider";

type EventTemplateOption = { id: string; label: string; description: string };

export function EmailsPanel({ eventId, t }: { eventId: string; t: ResolvedTheme }) {
  const translate = useTranslations("Ui.Event.EmailsPanel");

  const [templates, setTemplates] = useState<EventTemplateOption[]>([]);
  const [selectedId, setSelectedId] = useState("invite");
  // Tag the preview with the template it was rendered for, so a stale result
  // from a previous selection is never shown (no synchronous clear needed).
  const [preview, setPreview] = useState<{ id: string; subject: string; html: string } | null>(
    null
  );
  const [status, setStatus] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const { runWithCaptcha } = useCaptcha();

  useEffect(() => {
    getEventEmailTemplates()
      .then(setTemplates)
      .catch(() => setStatus(translate("failedLoadTemplates")));
  }, [translate]);

  useEffect(() => {
    let cancelled = false;
    getEventEmailPreview(eventId, selectedId as Parameters<typeof getEventEmailPreview>[1])
      .then((p) => {
        if (!cancelled) setPreview({ id: selectedId, ...p });
      })
      .catch(() => {
        if (!cancelled) setStatus(translate("failedRenderPreview"));
      });
    return () => {
      cancelled = true;
    };
  }, [eventId, selectedId, translate]);

  const currentPreview = preview?.id === selectedId ? preview : null;

  const handleSendTest = async () => {
    setSending(true);
    setStatus(null);
    try {
      const res = await runWithCaptcha("email_test", (token) =>
        sendEventEmailTest(eventId, selectedId as Parameters<typeof sendEventEmailTest>[1], token)
      );
      setStatus(
        res.success
          ? translate("testSent", { destination: res.sentTo })
          : (res.error ?? translate("sendFailed"))
      );
    } catch (reason) {
      setStatus(reason instanceof Error ? reason.message : translate("sendFailed"));
    } finally {
      setSending(false);
    }
  };

  const selected = templates.find((tpl) => tpl.id === selectedId);

  return (
    <Section title={translate("emails")} t={t}>
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <div style={{ fontSize: "13px", color: t.textSecondary }}>
          {translate("guestsReceiveTheseEmailsStyledEvent")}
        </div>

        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "flex-end" }}>
          <Field
            theme={t}
            label={translate("email")}
            style={{ flex: "1 1 240px", marginBottom: 0 }}
          >
            <Select theme={t} value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
              {templates.map((tpl) => (
                <option key={tpl.id} value={tpl.id}>
                  {tpl.label}
                </option>
              ))}
            </Select>
          </Field>
          <Button
            theme={t}
            variant="secondary"
            type="button"
            onClick={handleSendTest}
            disabled={sending || !currentPreview}
          >
            <Send size={14} aria-hidden="true" /> {translate("sendMeTest")}
          </Button>
        </div>

        {selected && (
          <div style={{ fontSize: "12px", color: t.textMuted }}>{selected.description}</div>
        )}
        <div role="status" style={{ fontSize: "13px", color: t.textSecondary }}>
          {status}
        </div>

        {currentPreview ? (
          <div>
            <div
              style={{
                fontSize: "12px",
                color: t.textSecondary,
                marginBottom: "6px",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {translate("subject")}{" "}
              <span style={{ color: t.textPrimary }}>{currentPreview.subject}</span>
            </div>
            <iframe
              title={translate("emailPreview")}
              sandbox=""
              srcDoc={currentPreview.html}
              style={{
                width: "100%",
                height: "520px",
                border: `1px solid ${t.cardBorder}`,
                borderRadius: "12px",
                backgroundColor: "#f4f4f7",
              }}
            />
          </div>
        ) : (
          !status && (
            <div style={{ fontSize: "13px", color: t.textMuted }}>
              {translate("renderingPreview")}
            </div>
          )
        )}
      </div>
    </Section>
  );
}
