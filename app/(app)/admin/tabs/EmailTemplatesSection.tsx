"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { RotateCcw, Send } from "lucide-react";
import { APP_SHELL } from "@/lib/theme";
import {
  getEmailTemplatesAdmin,
  previewEmailTemplateAction,
  resetEmailTemplateAction,
  saveEmailTemplateAction,
  sendEmailTemplateTestAction,
} from "@/app/actions/admin";
import type { EmailTemplateMeta, TemplateId } from "@/emails/registry";
import type { TemplateToggleKey } from "@/emails/types";

type TemplateEntry = {
  meta: EmailTemplateMeta;
  overrides: { subject?: string; body?: string } & Partial<Record<TemplateToggleKey, boolean>>;
};

const TOGGLE_LABELS: Record<TemplateToggleKey, string> = {
  showCoverImage: "Cover image",
  showHostFlourish: "Hosted-by flourish",
  showMapLink: "Google Maps link",
  showCalendarLinks: "Add-to-calendar links",
};

const BASES = ["DARK", "SOFT", "BOLD"] as const;

const inputStyle: React.CSSProperties = {
  width: "100%",
  backgroundColor: APP_SHELL.inputBg,
  border: `1px solid ${APP_SHELL.inputBorder}`,
  borderRadius: APP_SHELL.inputRadius,
  padding: "10px 14px",
  color: APP_SHELL.textPrimary,
  fontSize: "13px",
  outline: "none",
  boxSizing: "border-box",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "12px",
  fontWeight: 700,
  color: APP_SHELL.textSecondary,
  marginBottom: "6px",
};

export function EmailTemplatesSection() {
  const [templates, setTemplates] = useState<TemplateEntry[]>([]);
  const [selectedId, setSelectedId] = useState<TemplateId>("invite");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [toggles, setToggles] = useState<Partial<Record<TemplateToggleKey, boolean>>>({});
  const [sampleBase, setSampleBase] = useState<(typeof BASES)[number]>("DARK");
  const [preview, setPreview] = useState<{ subject: string; html: string } | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const previewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [seededId, setSeededId] = useState<string | null>(null);

  const selected = templates.find((t) => t.meta.id === selectedId);

  const loadTemplates = useCallback(async () => {
    const { templates: loaded } = await getEmailTemplatesAdmin();
    setTemplates(loaded as TemplateEntry[]);
    return loaded as TemplateEntry[];
  }, []);

  useEffect(() => {
    // setState only in the async callback (not synchronously in the effect body).
    getEmailTemplatesAdmin()
      .then(({ templates: loaded }) => setTemplates(loaded as TemplateEntry[]))
      .catch(() => setStatus("Failed to load templates"));
  }, []);

  // Seed the editor from the selected template's saved copy when the selection
  // changes. Adjusting state during render (React's documented pattern) instead
  // of in an effect avoids a cascading-render setState-in-effect.
  if (selected && seededId !== selectedId) {
    setSeededId(selectedId);
    setSubject(selected.overrides.subject ?? selected.meta.defaultSubject);
    setBody(selected.overrides.body ?? selected.meta.defaultBody);
    const seeded: Partial<Record<TemplateToggleKey, boolean>> = {};
    for (const key of selected.meta.toggles) {
      seeded[key] = selected.overrides[key] ?? true;
    }
    setToggles(seeded);
    setStatus(null);
  }

  const currentOverrides = useCallback(() => {
    if (!selected) return {};
    const o: TemplateEntry["overrides"] = {};
    if (subject.trim() && subject !== selected.meta.defaultSubject) o.subject = subject;
    if (selected.meta.bodyEditable && body.trim() && body !== selected.meta.defaultBody) {
      o.body = body;
    }
    for (const key of selected.meta.toggles) {
      if (toggles[key] === false) o[key] = false;
    }
    return o;
  }, [selected, subject, body, toggles]);

  // Debounced live preview of the (possibly unsaved) editor state
  useEffect(() => {
    if (!selected) return;
    if (previewTimer.current) clearTimeout(previewTimer.current);
    previewTimer.current = setTimeout(() => {
      previewEmailTemplateAction(selected.meta.id, currentOverrides(), sampleBase)
        .then(setPreview)
        .catch(() => setPreview(null));
    }, 400);
    return () => {
      if (previewTimer.current) clearTimeout(previewTimer.current);
    };
  }, [selected, currentOverrides, sampleBase]);

  const handleSave = async () => {
    if (!selected) return;
    setBusy(true);
    setStatus(null);
    try {
      const res = await saveEmailTemplateAction(selected.meta.id, currentOverrides());
      if (!res.success) {
        setStatus(res.error ?? "Save failed");
      } else {
        await loadTemplates();
        setStatus("Saved");
      }
    } catch {
      setStatus("Save failed");
    } finally {
      setBusy(false);
    }
  };

  const handleReset = async () => {
    if (!selected) return;
    setBusy(true);
    setStatus(null);
    try {
      await resetEmailTemplateAction(selected.meta.id);
      await loadTemplates();
      // Selection didn't change, so seed the editor back to defaults here.
      setSubject(selected.meta.defaultSubject);
      setBody(selected.meta.defaultBody);
      const cleared: Partial<Record<TemplateToggleKey, boolean>> = {};
      for (const key of selected.meta.toggles) cleared[key] = true;
      setToggles(cleared);
      setStatus("Reset to default");
    } catch {
      setStatus("Reset failed");
    } finally {
      setBusy(false);
    }
  };

  const handleSendTest = async () => {
    if (!selected) return;
    setBusy(true);
    setStatus(null);
    try {
      const res = await sendEmailTemplateTestAction(selected.meta.id, sampleBase);
      setStatus(res.success ? `Test sent to ${res.sentTo}` : (res.error ?? "Send failed"));
    } catch {
      setStatus("Send failed");
    } finally {
      setBusy(false);
    }
  };

  const insertPlaceholder = (name: string) => {
    if (!selected) return;
    if (selected.meta.bodyEditable) {
      setBody((b) => `${b}${b.endsWith(" ") || b === "" ? "" : " "}{${name}}`);
    } else {
      setSubject((s) => `${s}${s.endsWith(" ") || s === "" ? "" : " "}{${name}}`);
    }
  };

  if (!selected) {
    return (
      <div style={{ color: APP_SHELL.textSecondary, fontSize: "13px" }}>Loading templates…</div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Template picker + test send */}
      <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "flex-end" }}>
        <div style={{ flex: "1 1 260px" }}>
          <label style={labelStyle}>Template</label>
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value as TemplateId)}
            style={{ ...inputStyle, colorScheme: "dark" }}
          >
            {templates.map((t) => (
              <option
                key={t.meta.id}
                value={t.meta.id}
                style={{ backgroundColor: "#12091f", color: "#ffffff" }}
              >
                {t.meta.label}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={handleSendTest}
          disabled={busy}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            backgroundColor: "transparent",
            border: `1px solid ${APP_SHELL.accent}`,
            color: APP_SHELL.accent,
            borderRadius: "10px",
            padding: "10px 16px",
            fontSize: "13px",
            fontWeight: 700,
            cursor: busy ? "not-allowed" : "pointer",
            opacity: busy ? 0.6 : 1,
          }}
        >
          <Send size={14} /> Send test to me
        </button>
      </div>

      <p style={{ color: APP_SHELL.textSecondary, fontSize: "12px", margin: 0 }}>
        {selected.meta.description}
      </p>

      <div style={{ display: "flex", gap: "20px", flexWrap: "wrap" }}>
        {/* Editor column */}
        <div style={{ flex: "1 1 320px", display: "flex", flexDirection: "column", gap: "16px" }}>
          <div>
            <label style={labelStyle}>Subject</label>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              style={inputStyle}
            />
          </div>

          {selected.meta.bodyEditable && (
            <div>
              <label style={labelStyle}>Body copy</label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={5}
                style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }}
              />
            </div>
          )}

          {selected.meta.placeholders.length > 0 && (
            <div>
              <label style={labelStyle}>Placeholders (click to insert)</label>
              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                {selected.meta.placeholders.map((name) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => insertPlaceholder(name)}
                    style={{
                      backgroundColor: APP_SHELL.cardBg2,
                      border: `1px solid ${APP_SHELL.cardBorder}`,
                      color: APP_SHELL.textSecondary,
                      borderRadius: "999px",
                      padding: "4px 10px",
                      fontSize: "12px",
                      cursor: "pointer",
                    }}
                  >
                    {"{"}
                    {name}
                    {"}"}
                  </button>
                ))}
              </div>
            </div>
          )}

          {selected.meta.toggles.length > 0 && (
            <div>
              <label style={labelStyle}>Content blocks</label>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {selected.meta.toggles.map((key) => (
                  <label
                    key={key}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      color: APP_SHELL.textPrimary,
                      fontSize: "13px",
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={toggles[key] !== false}
                      onChange={(e) => setToggles((t) => ({ ...t, [key]: e.target.checked }))}
                      style={{ accentColor: APP_SHELL.accent }}
                    />
                    {TOGGLE_LABELS[key]}
                  </label>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={handleSave}
              disabled={busy}
              style={{
                backgroundColor: APP_SHELL.accent,
                border: "none",
                color: "#fff",
                borderRadius: "10px",
                padding: "10px 20px",
                fontSize: "13px",
                fontWeight: 700,
                cursor: busy ? "not-allowed" : "pointer",
                opacity: busy ? 0.6 : 1,
              }}
            >
              Save Template
            </button>
            <button
              type="button"
              onClick={handleReset}
              disabled={busy}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                backgroundColor: "transparent",
                border: `1px solid ${APP_SHELL.cardBorder}`,
                color: APP_SHELL.textSecondary,
                borderRadius: "10px",
                padding: "10px 16px",
                fontSize: "13px",
                fontWeight: 700,
                cursor: busy ? "not-allowed" : "pointer",
                opacity: busy ? 0.6 : 1,
              }}
            >
              <RotateCcw size={14} /> Reset to default
            </button>
          </div>

          {status && (
            <div style={{ fontSize: "12px", color: APP_SHELL.textSecondary }}>{status}</div>
          )}
        </div>

        {/* Preview column */}
        <div style={{ flex: "1 1 380px", minWidth: 0 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "6px",
              gap: "8px",
              flexWrap: "wrap",
            }}
          >
            <label style={{ ...labelStyle, marginBottom: 0 }}>Live preview</label>
            {selected.meta.eventScoped && (
              <div style={{ display: "flex", gap: "4px" }}>
                {BASES.map((base) => (
                  <button
                    key={base}
                    type="button"
                    onClick={() => setSampleBase(base)}
                    style={{
                      backgroundColor: sampleBase === base ? APP_SHELL.accent : "transparent",
                      border: `1px solid ${sampleBase === base ? APP_SHELL.accent : APP_SHELL.cardBorder}`,
                      color: sampleBase === base ? "#fff" : APP_SHELL.textSecondary,
                      borderRadius: "999px",
                      padding: "3px 10px",
                      fontSize: "11px",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    {base === "DARK" ? "Dark" : base === "SOFT" ? "Soft" : "Bold"}
                  </button>
                ))}
              </div>
            )}
          </div>
          {preview ? (
            <>
              <div
                style={{
                  fontSize: "12px",
                  color: APP_SHELL.textSecondary,
                  marginBottom: "6px",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                Subject: <span style={{ color: APP_SHELL.textPrimary }}>{preview.subject}</span>
              </div>
              <iframe
                title="Email preview"
                sandbox=""
                srcDoc={preview.html}
                style={{
                  width: "100%",
                  height: "480px",
                  border: `1px solid ${APP_SHELL.cardBorder}`,
                  borderRadius: "12px",
                  backgroundColor: "#f4f4f7",
                }}
              />
            </>
          ) : (
            <div style={{ color: APP_SHELL.textSecondary, fontSize: "13px" }}>
              Rendering preview…
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
