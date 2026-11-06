"use client";
import { useLocale, useTranslations } from "next-intl";

import { useCallback, useEffect, useRef, useState } from "react";
import { RotateCcw, Send } from "lucide-react";
import { APP_SHELL } from "@/lib/theme";
import {
  getEmailTemplatesAdmin,
  previewEmailTemplateAction,
  resetAllEmailTemplatesAction,
  resetEmailTemplateAction,
  saveEmailTemplateAction,
  sendEmailTemplateTestAction,
} from "@/app/actions/admin";
import type { EmailTemplateMeta, TemplateId } from "@/emails/registry";
import type { TemplateToggleKey } from "@/emails/types";
import { appInputStyle } from "@/components/ui/AppPrimitives";

type TemplateEntry = {
  meta: EmailTemplateMeta;
  overrides: { subject?: string; body?: string } & Partial<Record<TemplateToggleKey, boolean>>;
};

type SamplePreset = { id: string; name: string; emoji: string };

const BASES = ["DARK", "SOFT", "BOLD"] as const;

const inputStyle: React.CSSProperties = {
  ...appInputStyle,
  fontSize: "13px",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "12px",
  fontWeight: 700,
  color: APP_SHELL.textSecondary,
  marginBottom: "6px",
};

export function EmailTemplatesSection() {
  const tr = useTranslations("Ui.Admin");
  const locale = useLocale();
  const tEvent = useTranslations("Ui.Event");

  const [templates, setTemplates] = useState<TemplateEntry[]>([]);
  const [selectedId, setSelectedId] = useState<TemplateId>("invite");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [toggles, setToggles] = useState<Partial<Record<TemplateToggleKey, boolean>>>({});
  // A base theme id (its defaults) or a theme preset id.
  const [sampleTheme, setSampleTheme] = useState<string>("DARK");
  const [samplePresets, setSamplePresets] = useState<SamplePreset[]>([]);
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
      .then(({ templates: loaded, samplePresets: presets }) => {
        setTemplates(loaded as TemplateEntry[]);
        setSamplePresets(presets);
      })
      .catch(() => setStatus(tr("failedToLoadTemplates")));
  }, [locale, tr]);

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
      previewEmailTemplateAction(selected.meta.id, currentOverrides(), sampleTheme)
        .then(setPreview)
        .catch(() => setPreview(null));
    }, 400);
    return () => {
      if (previewTimer.current) clearTimeout(previewTimer.current);
    };
  }, [selected, currentOverrides, sampleTheme]);

  const handleSave = async () => {
    if (!selected) return;
    setBusy(true);
    setStatus(null);
    try {
      const res = await saveEmailTemplateAction(selected.meta.id, currentOverrides());
      if (!res.success) {
        setStatus(res.error ?? tr("saveFailed"));
      } else {
        await loadTemplates();
        setStatus(tr("saved"));
      }
    } catch {
      setStatus(tr("saveFailed"));
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
      setStatus(tr("resetToDefault2"));
    } catch {
      setStatus(tr("resetFailed"));
    } finally {
      setBusy(false);
    }
  };

  const handleResetAll = async () => {
    if (!window.confirm(tr("resetAllEmailTemplatesToTheirDefaultsThisClears"))) {
      return;
    }
    setBusy(true);
    setStatus(null);
    try {
      const res = await resetAllEmailTemplatesAction();
      await loadTemplates();
      // Selection is unchanged, so seed the open editor back to defaults too.
      if (selected) {
        setSubject(selected.meta.defaultSubject);
        setBody(selected.meta.defaultBody);
        const cleared: Partial<Record<TemplateToggleKey, boolean>> = {};
        for (const key of selected.meta.toggles) cleared[key] = true;
        setToggles(cleared);
      }
      setStatus(
        res.cleared > 0
          ? tr("resetAllTemplatesCount", { count: res.cleared })
          : tr("allTemplatesWereAlreadyAtTheirDefaults")
      );
    } catch {
      setStatus(tr("resetAllFailed"));
    } finally {
      setBusy(false);
    }
  };

  const handleSendTest = async () => {
    if (!selected) return;
    setBusy(true);
    setStatus(null);
    try {
      const res = await sendEmailTemplateTestAction(selected.meta.id, sampleTheme);
      setStatus(
        res.success ? tr("testSentTo", { recipient: res.sentTo }) : (res.error ?? tr("sendFailed"))
      );
    } catch {
      setStatus(tr("sendFailed"));
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
      <div style={{ color: APP_SHELL.textSecondary, fontSize: "13px" }}>
        {tr("loadingTemplates")}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Template picker + test send */}
      <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "flex-end" }}>
        <div style={{ flex: "1 1 260px" }}>
          <label style={labelStyle}>{tr("template")}</label>
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
          <Send size={14} /> {tr("sendTestToMe")}
        </button>
        <button
          type="button"
          onClick={handleResetAll}
          disabled={busy}
          title={tr("clearEverySavedOverrideAndRestoreAllShippedDefaults")}
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
          <RotateCcw size={14} /> {tr("resetAllToDefault")}
        </button>
      </div>

      <p style={{ color: APP_SHELL.textSecondary, fontSize: "12px", margin: 0 }}>
        {selected.meta.description}
      </p>

      <div style={{ display: "flex", gap: "20px", flexWrap: "wrap" }}>
        {/* Editor column */}
        <div style={{ flex: "1 1 320px", display: "flex", flexDirection: "column", gap: "16px" }}>
          <div>
            <label style={labelStyle}>{tr("subject")}</label>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              style={inputStyle}
            />
          </div>

          {selected.meta.bodyEditable && (
            <div>
              <label style={labelStyle}>{tr("bodyCopy")}</label>
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
              <label style={labelStyle}>{tr("placeholdersClickToInsert")}</label>
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
              <label style={labelStyle}>{tr("contentBlocks")}</label>
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
                    {tr("templateToggle." + key)}
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
              {tr("saveTemplate")}
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
              <RotateCcw size={14} /> {tr("resetToDefault2")}
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
            <label style={{ ...labelStyle, marginBottom: 0 }}>{tr("livePreview")}</label>
            {selected.meta.eventScoped && (
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <label
                  htmlFor="email-preview-sample-theme"
                  style={{ ...labelStyle, marginBottom: 0 }}
                >
                  {tr("sampleTheme")}
                </label>
                <select
                  id="email-preview-sample-theme"
                  value={sampleTheme}
                  onChange={(e) => setSampleTheme(e.target.value)}
                  style={{ ...inputStyle, width: "auto", maxWidth: "220px", colorScheme: "dark" }}
                >
                  {[
                    ...BASES.map((base) => ({
                      value: base,
                      label: tEvent("shared.baseThemes." + base),
                    })),
                    ...samplePresets.map((p) => ({ value: p.id, label: `${p.emoji} ${p.name}` })),
                  ].map((option) => (
                    <option
                      key={option.value}
                      value={option.value}
                      style={{ backgroundColor: "#12091f", color: "#ffffff" }}
                    >
                      {option.label}
                    </option>
                  ))}
                </select>
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
                {tr.rich("subjectMessage", {
                  part0: (chunks) => <span style={{ color: APP_SHELL.textPrimary }}>{chunks}</span>,
                  value0: preview.subject,
                })}
              </div>
              <iframe
                title={tr("emailPreview")}
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
              {tr("renderingPreview")}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
