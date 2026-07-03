"use client";

import { useEffect, useState } from "react";
import { Send } from "lucide-react";
import type { ResolvedTheme } from "@/lib/theme";
import {
  getEventEmailPreview,
  sendEventEmailTest,
  getEventEmailTemplates,
} from "@/app/actions/event";
import { Label, Section } from "./ui";

type EventTemplateOption = { id: string; label: string; description: string };

export function EmailsPanel({ eventId, t }: { eventId: string; t: ResolvedTheme }) {
  const [templates, setTemplates] = useState<EventTemplateOption[]>([]);
  const [selectedId, setSelectedId] = useState("invite");
  const [preview, setPreview] = useState<{ subject: string; html: string } | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    getEventEmailTemplates()
      .then(setTemplates)
      .catch(() => setStatus("Failed to load templates"));
  }, []);

  useEffect(() => {
    let cancelled = false;
    setPreview(null);
    getEventEmailPreview(eventId, selectedId as Parameters<typeof getEventEmailPreview>[1])
      .then((p) => {
        if (!cancelled) setPreview(p);
      })
      .catch(() => {
        if (!cancelled) setStatus("Failed to render preview");
      });
    return () => {
      cancelled = true;
    };
  }, [eventId, selectedId]);

  const handleSendTest = async () => {
    setSending(true);
    setStatus(null);
    try {
      const res = await sendEventEmailTest(
        eventId,
        selectedId as Parameters<typeof sendEventEmailTest>[1]
      );
      setStatus(res.success ? `Test sent to ${res.sentTo}` : (res.error ?? "Send failed"));
    } catch {
      setStatus("Send failed");
    } finally {
      setSending(false);
    }
  };

  const selected = templates.find((tpl) => tpl.id === selectedId);

  return (
    <Section title="Emails" t={t}>
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <div style={{ fontSize: "13px", color: t.textSecondary }}>
          Guests receive these emails styled with this event's theme — change the theme and the
          emails follow automatically. Email wording is managed by your site admin.
        </div>

        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "flex-end" }}>
          <div style={{ flex: "1 1 240px" }}>
            <Label t={t}>Email</Label>
            <select
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              style={{
                width: "100%",
                backgroundColor: t.inputBg,
                border: `1px solid ${t.inputBorder}`,
                borderRadius: "12px",
                padding: "10px 14px",
                color: t.inputText,
                fontSize: "13px",
                outline: "none",
                boxSizing: "border-box",
              }}
            >
              {templates.map((tpl) => (
                <option key={tpl.id} value={tpl.id}>
                  {tpl.label}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={handleSendTest}
            disabled={sending || !preview}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              backgroundColor: t.accent,
              border: "none",
              color: t.accentFg,
              borderRadius: t.btnRadius,
              padding: "10px 18px",
              fontSize: "13px",
              fontWeight: 700,
              cursor: sending ? "not-allowed" : "pointer",
              opacity: sending || !preview ? 0.6 : 1,
            }}
          >
            <Send size={14} /> Send me a test
          </button>
        </div>

        {selected && (
          <div style={{ fontSize: "12px", color: t.textMuted }}>{selected.description}</div>
        )}
        {status && <div style={{ fontSize: "12px", color: t.textSecondary }}>{status}</div>}

        {preview ? (
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
              Subject: <span style={{ color: t.textPrimary }}>{preview.subject}</span>
            </div>
            <iframe
              title="Email preview"
              sandbox=""
              srcDoc={preview.html}
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
          !status && <div style={{ fontSize: "13px", color: t.textMuted }}>Rendering preview…</div>
        )}
      </div>
    </Section>
  );
}
