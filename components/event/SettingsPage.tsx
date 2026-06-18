"use client";

import { useState, useTransition, useEffect } from "react";
import { ArrowLeft, Check, Plus, X } from "lucide-react";
import { ACCENT_PRESETS, BASE_THEMES, type BaseTheme, resolveTheme, type ResolvedTheme } from "@/lib/theme";
import {
  saveEventSettings,
  saveEventTheme,
  saveReminderSettings,
  addCoHost,
  removeCoHost,
  addRsvpField,
  updateRsvpField,
  deleteRsvpField,
} from "@/app/actions/event";

type CoHostEntry = { id: string; user: { id: string; name: string | null; email: string } };

type RsvpFieldEntry = {
  id: string;
  label: string;
  fieldType: "TEXT" | "TEXTAREA" | "SELECT" | "CHECKBOX";
  required: boolean;
  options: string | null;
  order: number;
};

type EventInput = {
  id: string;
  slug: string;
  commentsEnabled: boolean;
  plusOneAllowed: boolean;
  plusOneMax: number;
  plusOneNamesRequired: boolean;
  guestSharingEnabled: boolean;
  approvalRequired: boolean;
  rsvpDeadline: Date | null;
  capacity: number | null;
  guestListVis: "ALL" | "GUESTS_ONLY" | "HOST_ONLY";
  visibility: "PUBLIC" | "UNLISTED" | "PRIVATE";
  maybeEnabled: boolean;
  questionnaireEnabled: boolean;
  showTimestamps: boolean;
  password: string | null;
  theme: { baseTheme: "DARK" | "SOFT" | "BOLD"; accentColor: string; coverImageUrl: string | null } | null;
  reminderSettings: {
    emailWeekBefore: boolean; emailDayBefore: boolean; emailHoursBefore: number;
    smsWeekBefore: boolean; smsDayBefore: boolean; smsHoursBefore: number;
    nudgeUnresponded: boolean; postEventPrompt: boolean;
  } | null;
  coHosts: CoHostEntry[];
  rsvpFields: RsvpFieldEntry[];
};

interface SettingsOverrides {
  commentsEnabled?: boolean;
  plusOneAllowed?: boolean;
  plusOneMax?: number;
  plusOneNamesRequired?: boolean;
  approvalRequired?: boolean;
  rsvpDeadline?: string | null;
  capacity?: number | null;
  guestListVis?: "ALL" | "GUESTS_ONLY" | "HOST_ONLY";
  visibility?: "PUBLIC" | "UNLISTED" | "PRIVATE";
  maybeEnabled?: boolean;
  questionnaireEnabled?: boolean;
  showTimestamps?: boolean;
  password?: string | null;
  guestSharingEnabled?: boolean;
}

interface ReminderOverrides {
  emailWeekBefore?: boolean;
  emailDayBefore?: boolean;
  emailHoursBefore?: number;
  smsWeekBefore?: boolean;
  smsDayBefore?: boolean;
  smsHoursBefore?: number;
  nudgeUnresponded?: boolean;
  postEventPrompt?: boolean;
}

export function SettingsPage({ event, isOwner }: { event: EventInput; isOwner: boolean }) {
  const [isPending, startTransition] = useTransition();
  const [saveStatus, setSaveStatus] = useState<"IDLE" | "SAVING" | "SAVED" | "ERROR">("IDLE");
  const [err, setErr] = useState<string | null>(null);

  // ── Theme State ──
  const [base, setBase] = useState<BaseTheme>(event.theme?.baseTheme ?? "DARK");
  const [accent, setAccent] = useState(event.theme?.accentColor ?? "#a855f7");

  // ── RSVP Options State ──
  const [plusOneAllowed, setPlusOneAllowed] = useState(event.plusOneAllowed);
  const [plusOneMax, setPlusOneMax] = useState(event.plusOneMax);
  const [plusOneNamesRequired, setPlusOneNamesRequired] = useState(event.plusOneNamesRequired);
  const [approvalRequired, setApprovalRequired] = useState(event.approvalRequired);
  const [maybeEnabled, setMaybeEnabled] = useState(event.maybeEnabled);
  const [capacity, setCapacity] = useState(event.capacity?.toString() ?? "");
  const [rsvpDeadline, setRsvpDeadline] = useState(
    event.rsvpDeadline ? new Date(event.rsvpDeadline).toISOString().slice(0, 16) : ""
  );

  // ── Display & Privacy State ──
  const [commentsEnabled, setCommentsEnabled] = useState(event.commentsEnabled);
  const [guestSharingEnabled, setGuestSharingEnabled] = useState(event.guestSharingEnabled);
  const [guestListVis, setGuestListVis] = useState(event.guestListVis);
  const [showTimestamps, setShowTimestamps] = useState(event.showTimestamps);
  const [visibility, setVisibility] = useState(event.visibility);
  const [password, setPassword] = useState(event.password ?? "");

  // ── Reminders State ──
  const rs = event.reminderSettings;
  const [emailWeekBefore, setEmailWeekBefore] = useState(rs?.emailWeekBefore ?? false);
  const [emailDayBefore, setEmailDayBefore] = useState(rs?.emailDayBefore ?? true);
  const [emailHoursBefore, setEmailHoursBefore] = useState(rs?.emailHoursBefore ?? 2);
  const [smsWeekBefore, setSmsWeekBefore] = useState(rs?.smsWeekBefore ?? false);
  const [smsDayBefore, setSmsDayBefore] = useState(rs?.smsDayBefore ?? false);
  const [smsHoursBefore, setSmsHoursBefore] = useState(rs?.smsHoursBefore ?? 0);
  const [nudgeUnresponded, setNudgeUnresponded] = useState(rs?.nudgeUnresponded ?? true);
  const [postEventPrompt, setPostEventPrompt] = useState(rs?.postEventPrompt ?? false);

  // ── Co-hosts State ──
  const [coHosts, setCoHosts] = useState<CoHostEntry[]>(event.coHosts);
  const [cohostEmail, setCohostEmail] = useState("");
  const [cohostError, setCohostError] = useState<string | null>(null);

  // ── Questionnaire State ──
  const [questionnaireEnabled, setQuestionnaireEnabled] = useState(event.questionnaireEnabled);
  const [fields, setFields] = useState<RsvpFieldEntry[]>(event.rsvpFields);
  const [addingField, setAddingField] = useState(false);
  const [newFieldLabel, setNewFieldLabel] = useState("");
  const [newFieldType, setNewFieldType] = useState<"TEXT" | "TEXTAREA" | "SELECT" | "CHECKBOX">("TEXT");
  const [newFieldRequired, setNewFieldRequired] = useState(false);
  const [newFieldOptions, setNewFieldOptions] = useState("");
  const [labelDrafts, setLabelDrafts] = useState<Record<string, string>>(() =>
    Object.fromEntries(event.rsvpFields.map((f) => [f.id, f.label]))
  );
  const [optionsDrafts, setOptionsDrafts] = useState<Record<string, string>>(() =>
    Object.fromEntries(event.rsvpFields.map((f) => [f.id, f.options ?? ""]))
  );

  // Clear saved status after delay
  useEffect(() => {
    if (saveStatus === "SAVED" || saveStatus === "ERROR") {
      const timer = setTimeout(() => setSaveStatus("IDLE"), 2500);
      return () => clearTimeout(timer);
    }
  }, [saveStatus]);

  // ── Theme Auto-Save ──
  const triggerSaveTheme = (newBase: BaseTheme, newAccent: string) => {
    setSaveStatus("SAVING");
    setErr(null);
    startTransition(async () => {
      try {
        await saveEventTheme(event.id, newBase, newAccent);
        setSaveStatus("SAVED");
      } catch {
        setSaveStatus("ERROR");
        setErr("Failed to save theme settings.");
      }
    });
  };

  // ── Settings Auto-Save ──
  const triggerSaveSettings = (overrides: SettingsOverrides) => {
    setSaveStatus("SAVING");
    setErr(null);
    const data = {
      plusOneAllowed: overrides.plusOneAllowed !== undefined ? overrides.plusOneAllowed : plusOneAllowed,
      plusOneMax: overrides.plusOneMax !== undefined ? overrides.plusOneMax : plusOneMax,
      plusOneNamesRequired: overrides.plusOneNamesRequired !== undefined ? overrides.plusOneNamesRequired : plusOneNamesRequired,
      guestSharingEnabled: overrides.guestSharingEnabled !== undefined ? overrides.guestSharingEnabled : guestSharingEnabled,
      approvalRequired: overrides.approvalRequired !== undefined ? overrides.approvalRequired : approvalRequired,
      maybeEnabled: overrides.maybeEnabled !== undefined ? overrides.maybeEnabled : maybeEnabled,
      capacity: overrides.capacity !== undefined ? overrides.capacity : (capacity.trim() ? Number(capacity) : null),
      rsvpDeadline: overrides.rsvpDeadline !== undefined ? overrides.rsvpDeadline : (rsvpDeadline || null),
      commentsEnabled: overrides.commentsEnabled !== undefined ? overrides.commentsEnabled : commentsEnabled,
      guestListVis: overrides.guestListVis !== undefined ? overrides.guestListVis : guestListVis,
      showTimestamps: overrides.showTimestamps !== undefined ? overrides.showTimestamps : showTimestamps,
      visibility: overrides.visibility !== undefined ? overrides.visibility : visibility,
      password: overrides.password !== undefined ? overrides.password : (password.trim() || null),
      questionnaireEnabled: overrides.questionnaireEnabled !== undefined ? overrides.questionnaireEnabled : questionnaireEnabled,
    };
    startTransition(async () => {
      try {
        const res = await saveEventSettings(event.id, data);
        if (res && !res.success) {
          setSaveStatus("ERROR");
          setErr(res.error ?? "Failed to save settings.");
        } else {
          setSaveStatus("SAVED");
        }
      } catch {
        setSaveStatus("ERROR");
        setErr("Failed to save settings.");
      }
    });
  };

  // ── Reminders Auto-Save ──
  const triggerSaveReminders = (overrides: ReminderOverrides) => {
    setSaveStatus("SAVING");
    setErr(null);
    const data = {
      emailWeekBefore: overrides.emailWeekBefore !== undefined ? overrides.emailWeekBefore : emailWeekBefore,
      emailDayBefore: overrides.emailDayBefore !== undefined ? overrides.emailDayBefore : emailDayBefore,
      emailHoursBefore: overrides.emailHoursBefore !== undefined ? overrides.emailHoursBefore : emailHoursBefore,
      smsWeekBefore: overrides.smsWeekBefore !== undefined ? overrides.smsWeekBefore : smsWeekBefore,
      smsDayBefore: overrides.smsDayBefore !== undefined ? overrides.smsDayBefore : smsDayBefore,
      smsHoursBefore: overrides.smsHoursBefore !== undefined ? overrides.smsHoursBefore : smsHoursBefore,
      nudgeUnresponded: overrides.nudgeUnresponded !== undefined ? overrides.nudgeUnresponded : nudgeUnresponded,
      postEventPrompt: overrides.postEventPrompt !== undefined ? overrides.postEventPrompt : postEventPrompt,
    };
    startTransition(async () => {
      try {
        await saveReminderSettings(event.id, data);
        setSaveStatus("SAVED");
      } catch {
        setSaveStatus("ERROR");
        setErr("Failed to save reminders.");
      }
    });
  };

  // ── Co-hosts Actions ──
  const handleAddCohost = () => {
    setSaveStatus("SAVING");
    setCohostError(null);
    startTransition(async () => {
      try {
        const result = await addCoHost(event.id, cohostEmail.trim());
        if (!result.success) {
          setCohostError(result.error ?? "Error adding co-host");
          setSaveStatus("ERROR");
          return;
        }
        setCoHosts((prev) => [...prev, {
          id: result.cohostId!,
          user: { id: result.cohostId!, name: result.name ?? null, email: result.email! },
        }]);
        setCohostEmail("");
        setSaveStatus("SAVED");
      } catch {
        setCohostError("An unexpected error occurred.");
        setSaveStatus("ERROR");
      }
    });
  };

  const handleRemoveCohost = (cohostRecordId: string) => {
    setSaveStatus("SAVING");
    startTransition(async () => {
      try {
        await removeCoHost(cohostRecordId);
        setCoHosts((prev) => prev.filter((c) => c.id !== cohostRecordId));
        setSaveStatus("SAVED");
      } catch {
        setSaveStatus("ERROR");
      }
    });
  };

  // ── Questionnaire Actions ──
  const handleAddField = () => {
    if (!newFieldLabel.trim()) return;
    setSaveStatus("SAVING");
    startTransition(async () => {
      try {
        const result = await addRsvpField(event.id, {
          label: newFieldLabel.trim(),
          fieldType: newFieldType,
          required: newFieldRequired,
          options: (newFieldType === "SELECT" || newFieldType === "CHECKBOX") ? newFieldOptions : undefined,
          order: fields.length,
        });
        if (result.success) {
          setFields((prev) => [...prev, {
            id: result.id!,
            label: newFieldLabel.trim(),
            fieldType: newFieldType,
            required: newFieldRequired,
            options: (newFieldType === "SELECT" || newFieldType === "CHECKBOX") ? newFieldOptions : null,
            order: prev.length,
          }]);
          setLabelDrafts((prev) => ({ ...prev, [result.id!]: newFieldLabel.trim() }));
          setOptionsDrafts((prev) => ({ ...prev, [result.id!]: newFieldOptions }));
          setNewFieldLabel("");
          setNewFieldType("TEXT");
          setNewFieldRequired(false);
          setNewFieldOptions("");
          setAddingField(false);
          setSaveStatus("SAVED");
        } else {
          setSaveStatus("ERROR");
        }
      } catch {
        setSaveStatus("ERROR");
      }
    });
  };

  const handleUpdateFieldType = (fieldId: string, fieldType: RsvpFieldEntry["fieldType"]) => {
    setSaveStatus("SAVING");
    startTransition(async () => {
      try {
        await updateRsvpField(fieldId, { fieldType });
        setFields((prev) => prev.map((x) => x.id === fieldId ? { ...x, fieldType } : x));
        setSaveStatus("SAVED");
      } catch {
        setSaveStatus("ERROR");
      }
    });
  };

  const handleUpdateFieldRequired = (fieldId: string, required: boolean) => {
    setSaveStatus("SAVING");
    startTransition(async () => {
      try {
        await updateRsvpField(fieldId, { required });
        setFields((prev) => prev.map((x) => x.id === fieldId ? { ...x, required } : x));
        setSaveStatus("SAVED");
      } catch {
        setSaveStatus("ERROR");
      }
    });
  };

  const handleUpdateFieldLabel = (fieldId: string) => {
    const label = (labelDrafts[fieldId] ?? "").trim();
    if (!label) return;
    setSaveStatus("SAVING");
    startTransition(async () => {
      try {
        await updateRsvpField(fieldId, { label });
        setFields((prev) => prev.map((x) => x.id === fieldId ? { ...x, label } : x));
        setSaveStatus("SAVED");
      } catch {
        setSaveStatus("ERROR");
      }
    });
  };

  const handleUpdateFieldOptions = (fieldId: string) => {
    const options = optionsDrafts[fieldId] ?? "";
    setSaveStatus("SAVING");
    startTransition(async () => {
      try {
        await updateRsvpField(fieldId, { options });
        setFields((prev) => prev.map((x) => x.id === fieldId ? { ...x, options } : x));
        setSaveStatus("SAVED");
      } catch {
        setSaveStatus("ERROR");
      }
    });
  };

  const handleDeleteField = (fieldId: string) => {
    setSaveStatus("SAVING");
    startTransition(async () => {
      try {
        await deleteRsvpField(fieldId);
        setFields((prev) => prev.filter((x) => x.id !== fieldId));
        setSaveStatus("SAVED");
      } catch {
        setSaveStatus("ERROR");
      }
    });
  };

  // Resolve theme using state
  const t = resolveTheme(base, accent);

  const S = {
    page: { minHeight: "100vh", background: t.pageBg, color: t.textPrimary, fontFamily: "inherit", paddingBottom: "120px", position: "relative" as const, overflowX: "hidden" as const },
    container: { maxWidth: "480px", margin: "0 auto", padding: "24px 16px 80px", position: "relative" as const, zIndex: 1 },
    header: { position: "sticky" as const, top: 0, background: t.cardBg, borderBottom: `1px solid ${t.cardBorder}`, padding: "16px 20px", display: "flex", alignItems: "center", gap: "12px", zIndex: 10, backdropFilter: "blur(14px)" },
    inp: { width: "100%", padding: "10px 14px", background: t.inputBg, border: `1px solid ${t.inputBorder}`, borderRadius: "10px", color: t.textPrimary, fontFamily: "inherit", fontSize: "14px", outline: "none", boxSizing: "border-box", colorScheme: t.textPrimary === "#ffffff" ? "dark" : "light" } as React.CSSProperties,
    smallBtn: { padding: "8px 16px", background: t.accent, color: t.accentFg, border: "none", borderRadius: "8px", cursor: "pointer", fontFamily: "inherit", fontSize: "13px", fontWeight: 700, whiteSpace: "nowrap" } as React.CSSProperties,
    av: { width: "32px", height: "32px", borderRadius: "50%", background: t.avatarGradient, display: "flex" as const, alignItems: "center" as const, justifyContent: "center" as const, fontSize: "13px", fontWeight: 700, color: t.accentFg, flexShrink: 0 },
  };

  const renderDecorations = () => {
    if (t.pageDecoration === "dark-orbs") {
      return (
        <>
          <div style={{ position: "fixed", top: "-20%", left: "30%", width: "600px", height: "600px", borderRadius: "50%", background: `radial-gradient(circle, rgba(${accent.replace("#","")},0.12) 0%, transparent 70%)`, filter: "blur(40px)", pointerEvents: "none", zIndex: 0 }} />
          <div style={{ position: "fixed", bottom: "10%", right: "-10%", width: "400px", height: "400px", borderRadius: "50%", background: "radial-gradient(circle, rgba(99,102,241,0.1) 0%, transparent 70%)", filter: "blur(40px)", pointerEvents: "none", zIndex: 0 }} />
        </>
      );
    }
    if (t.pageDecoration === "soft-blobs") {
      return (
        <>
          <div style={{ position: "fixed", top: "-10%", right: "-10%", width: "500px", height: "500px", borderRadius: "50%", background: `radial-gradient(circle, ${t.accentBg} 0%, transparent 70%)`, filter: "blur(60px)", pointerEvents: "none", zIndex: 0 }} />
          <div style={{ position: "fixed", bottom: "20%", left: "-5%", width: "400px", height: "400px", borderRadius: "50%", background: "radial-gradient(circle, rgba(196,181,253,0.35) 0%, transparent 70%)", filter: "blur(60px)", pointerEvents: "none", zIndex: 0 }} />
        </>
      );
    }
    if (t.pageDecoration === "bold-hero") {
      return <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: `linear-gradient(160deg, ${accent} 0%, #ec4899 45%, #f5eeff 75%, #fafafa 100%)`, zIndex: 0 }} />;
    }
    return null;
  };

  return (
    <div style={S.page}>
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
      {renderDecorations()}
      
      <div style={S.header}>
        <a href={`/e/${event.slug}`} style={{ display: "flex", alignItems: "center", color: t.textSecondary, textDecoration: "none" }}>
          <ArrowLeft size={20} />
        </a>
        <h1 style={{ fontSize: "17px", fontWeight: 700, color: t.textPrimary, flex: 1 }}>Event Settings</h1>
        {saveStatus === "SAVING" && (
          <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: t.textMuted }}>
            <span style={{
              display: "inline-block", width: "12px", height: "12px",
              borderRadius: "50%", border: `2px solid ${t.accent}`,
              borderTopColor: "transparent", animation: "spin 0.6s linear infinite",
              boxSizing: "border-box"
            }} />
            Saving...
          </div>
        )}
        {saveStatus === "SAVED" && (
          <div style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "12px", color: "#22c55e", fontWeight: 600 }}>
            <Check size={14} /> Saved
          </div>
        )}
        {saveStatus === "ERROR" && (
          <div style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "12px", color: "#ef4444", fontWeight: 600 }}>
            ⚠️ Error
          </div>
        )}
      </div>

      <div style={S.container}>

        {/* ── Theme ── */}
        <Section title="Theme" t={t}>
          <div style={{ marginBottom: "20px" }}>
            <Label t={t}>Style</Label>
            <div style={{ display: "flex", gap: "10px" }}>
              {BASE_THEMES.map((bt) => (
                <button key={bt.id} onClick={() => { setBase(bt.id); triggerSaveTheme(bt.id, accent); }} style={{ flex: 1, padding: 0, border: `2px solid ${base === bt.id ? t.textPrimary : t.inputBorder}`, borderRadius: "16px", cursor: "pointer", overflow: "hidden", background: "none", transition: "border-color 0.15s" }}>
                  <div style={{ height: "44px", background: bt.preview }} />
                  <div style={{ padding: "6px 4px", color: t.textPrimary, fontSize: "10px", fontWeight: 600, background: t.inputBg }}>{bt.label}</div>
                </button>
              ))}
            </div>
          </div>
          <Label t={t}>Accent Color</Label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
            {ACCENT_PRESETS.map((p) => (
              <button key={p.value} onClick={() => { setAccent(p.value); triggerSaveTheme(base, p.value); }} title={p.name} style={{ width: "32px", height: "32px", borderRadius: "50%", background: p.value, border: `3px solid ${accent === p.value ? t.textPrimary : "transparent"}`, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {accent === p.value && <Check size={12} color={t.accentFg} strokeWidth={3} />}
              </button>
            ))}
            <label style={{ width: "32px", height: "32px", borderRadius: "50%", border: `3px solid ${!ACCENT_PRESETS.some(p => p.value === accent) ? t.textPrimary : "transparent"}`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", background: ACCENT_PRESETS.some(p => p.value === accent) ? t.inputBg : accent, position: "relative", overflow: "hidden" }}>
              🎨
              <input type="color" value={accent} onChange={(e) => { setAccent(e.target.value); triggerSaveTheme(base, e.target.value); }} style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer" }} />
            </label>
          </div>
        </Section>

        {/* ── Hosts ── */}
        {isOwner && (
          <Section title="Hosts" t={t}>
            <div style={{ marginBottom: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 0", borderBottom: `1px solid ${t.cardBorder}` }}>
                <div style={S.av}>{event.slug[0]?.toUpperCase()}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "14px", fontWeight: 600, color: t.textPrimary }}>You</div>
                  <div style={{ fontSize: "12px", color: t.textMuted }}>Host</div>
                </div>
              </div>
              {coHosts.map((ch) => (
                <div key={ch.id} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 0", borderBottom: `1px solid ${t.cardBorder}` }}>
                  <div style={S.av}>{(ch.user.name ?? ch.user.email)[0].toUpperCase()}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: "14px", fontWeight: 600, color: t.textPrimary }}>{ch.user.name ?? ch.user.email}</div>
                    <div style={{ fontSize: "12px", color: t.textMuted }}>{ch.user.email} · Co-host</div>
                  </div>
                  <button onClick={() => handleRemoveCohost(ch.id)} style={{ background: "none", border: "none", cursor: "pointer", color: t.textMuted, padding: "4px" }} title="Remove co-host">
                    <X size={16} />
                  </button>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              <input
                value={cohostEmail}
                onChange={(e) => setCohostEmail(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleAddCohost(); }}
                placeholder="Add co-host by email"
                style={S.inp}
              />
              <button onClick={handleAddCohost} disabled={!cohostEmail.trim() || isPending} style={S.smallBtn}>Add</button>
            </div>
            {cohostError && <div style={{ fontSize: "13px", color: "#f87171", marginTop: "8px" }}>{cohostError}</div>}
          </Section>
        )}

        {/* ── RSVP Options ── */}
        <Section title="RSVP Options" t={t}>
          {/* Max plus-ones select dropdown */}
          <div style={{ marginBottom: "16px" }}>
            <Label t={t}>Max plus-ones per guest</Label>
            <select
              style={{ ...S.inp, cursor: "pointer" }}
              value={plusOneAllowed ? plusOneMax : 0}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                const allowed = val > 0;
                setPlusOneAllowed(allowed);
                setPlusOneMax(allowed ? val : 0);
                triggerSaveSettings({ plusOneAllowed: allowed, plusOneMax: allowed ? val : 0 });
              }}
            >
              <option value={0}>No +1s</option>
              {Array.from({ length: 9 }, (_, i) => (
                <option key={i + 1} value={i + 1}>
                  Up to {i + 1}
                </option>
              ))}
            </select>
          </div>

          {plusOneAllowed && (
            <Toggle
              label="Require plus-one names"
              value={plusOneNamesRequired}
              onChange={(val) => {
                setPlusOneNamesRequired(val);
                triggerSaveSettings({ plusOneNamesRequired: val });
              }}
              t={t}
            />
          )}

          <Toggle label="Require host approval for each RSVP" value={approvalRequired} onChange={(val) => { setApprovalRequired(val); triggerSaveSettings({ approvalRequired: val }); }} t={t} />
          <Toggle label="Guests can RSVP «Maybe»" value={maybeEnabled} onChange={(val) => { setMaybeEnabled(val); triggerSaveSettings({ maybeEnabled: val }); }} t={t} />
          
          <div style={{ marginBottom: "16px" }}>
            <Label t={t}>Capacity limit (optional)</Label>
            <input
              type="number"
              placeholder="No limit"
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
              onBlur={() => {
                const val = capacity.trim() ? Number(capacity) : null;
                triggerSaveSettings({ capacity: val });
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  const val = capacity.trim() ? Number(capacity) : null;
                  triggerSaveSettings({ capacity: val });
                  e.currentTarget.blur();
                }
              }}
              style={S.inp}
            />
          </div>
          <div>
            <Label t={t}>RSVP deadline (optional)</Label>
            <input
              type="datetime-local"
              value={rsvpDeadline}
              onChange={(e) => setRsvpDeadline(e.target.value)}
              onBlur={() => {
                triggerSaveSettings({ rsvpDeadline: rsvpDeadline || null });
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  triggerSaveSettings({ rsvpDeadline: rsvpDeadline || null });
                  e.currentTarget.blur();
                }
              }}
              style={S.inp}
            />
          </div>
        </Section>

        {/* ── Questionnaire ── */}
        <Section title="Questionnaire" t={t}>
          <Toggle label="Ask guests custom questions" value={questionnaireEnabled} onChange={(val) => { setQuestionnaireEnabled(val); triggerSaveSettings({ questionnaireEnabled: val }); }} t={t} />

          {fields.length > 0 && (
            <div style={{ marginTop: "16px", display: "flex", flexDirection: "column", gap: "10px" }}>
              {fields.map((f) => (
                <div key={f.id} style={{ background: t.inputBg, border: `1px solid ${t.inputBorder}`, borderRadius: "14px", padding: "14px" }}>
                  {/* Top row: type select + required + delete */}
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
                    <select
                      value={f.fieldType}
                      onChange={(e) => handleUpdateFieldType(f.id, e.target.value as RsvpFieldEntry["fieldType"])}
                      style={{ flex: 1, padding: "6px 10px", background: t.cardBg, border: `1px solid ${t.inputBorder}`, borderRadius: "8px", color: t.textPrimary, fontFamily: "inherit", fontSize: "12px", cursor: "pointer", colorScheme: t.textPrimary === "#ffffff" ? "dark" : "light" }}
                    >
                      <option value="TEXT">Short text</option>
                      <option value="TEXTAREA">Long text</option>
                      <option value="SELECT">Multiple choice</option>
                      <option value="CHECKBOX">Checkboxes</option>
                    </select>
                    <label style={{ display: "flex", alignItems: "center", gap: "5px", cursor: "pointer", fontSize: "12px", color: t.textSecondary, whiteSpace: "nowrap" }}>
                      <input
                        type="checkbox"
                        checked={f.required}
                        onChange={(e) => handleUpdateFieldRequired(f.id, e.target.checked)}
                        style={{ accentColor: t.accent }}
                      />
                      Required
                    </label>
                    <button onClick={() => handleDeleteField(f.id)} style={{ background: "none", border: "none", cursor: "pointer", color: t.textMuted, padding: "4px", flexShrink: 0, display: "flex", alignItems: "center" }}>
                      <X size={15} />
                    </button>
                  </div>
                  {/* Label input */}
                  <input
                    value={labelDrafts[f.id] ?? f.label}
                    onChange={(e) => setLabelDrafts((prev) => ({ ...prev, [f.id]: e.target.value }))}
                    onBlur={() => handleUpdateFieldLabel(f.id)}
                    onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
                    placeholder="Question text"
                    style={{ ...S.inp, marginBottom: (f.fieldType === "SELECT" || f.fieldType === "CHECKBOX") ? "8px" : 0 }}
                  />
                  {/* Options textarea for SELECT/CHECKBOX */}
                  {(f.fieldType === "SELECT" || f.fieldType === "CHECKBOX") && (
                    <textarea
                      value={optionsDrafts[f.id] ?? (f.options ?? "")}
                      onChange={(e) => setOptionsDrafts((prev) => ({ ...prev, [f.id]: e.target.value }))}
                      onBlur={() => handleUpdateFieldOptions(f.id)}
                      placeholder="Options, one per line"
                      style={{ ...S.inp, resize: "none", marginTop: "4px" } as React.CSSProperties}
                      rows={3}
                    />
                  )}
                </div>
              ))}
            </div>
          )}

          {addingField ? (
            <div style={{ marginTop: "12px", background: t.inputBg, border: `1px solid ${t.inputBorder}`, borderRadius: "14px", padding: "14px", display: "flex", flexDirection: "column", gap: "8px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <select value={newFieldType} onChange={(e) => setNewFieldType(e.target.value as typeof newFieldType)} style={{ flex: 1, padding: "6px 10px", background: t.cardBg, border: `1px solid ${t.inputBorder}`, borderRadius: "8px", color: t.textPrimary, fontFamily: "inherit", fontSize: "12px", cursor: "pointer", colorScheme: t.textPrimary === "#ffffff" ? "dark" : "light" }}>
                  <option value="TEXT">Short text</option>
                  <option value="TEXTAREA">Long text</option>
                  <option value="SELECT">Multiple choice</option>
                  <option value="CHECKBOX">Checkboxes</option>
                </select>
                <label style={{ display: "flex", alignItems: "center", gap: "5px", cursor: "pointer", fontSize: "12px", color: t.textSecondary, whiteSpace: "nowrap" }}>
                  <input type="checkbox" checked={newFieldRequired} onChange={(e) => setNewFieldRequired(e.target.checked)} style={{ accentColor: t.accent }} />
                  Required
                </label>
              </div>
              <input value={newFieldLabel} onChange={(e) => setNewFieldLabel(e.target.value)} placeholder="Question text *" style={S.inp} />
              {(newFieldType === "SELECT" || newFieldType === "CHECKBOX") && (
                <textarea value={newFieldOptions} onChange={(e) => setNewFieldOptions(e.target.value)} placeholder="Options, one per line" style={{ ...S.inp, resize: "none" } as React.CSSProperties} rows={3} />
              )}
              <div style={{ display: "flex", gap: "6px" }}>
                <button onClick={handleAddField} disabled={!newFieldLabel.trim() || isPending} style={{ ...S.smallBtn, flex: 1 }}>Add Question</button>
                <button onClick={() => setAddingField(false)} style={{ ...S.smallBtn, background: t.inputBg, color: t.textSecondary, border: `1px solid ${t.inputBorder}` }}>Cancel</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setAddingField(true)} style={{ marginTop: "12px", display: "flex", alignItems: "center", gap: "6px", background: t.inputBg, border: `1px dashed ${t.accentBorder}`, borderRadius: "10px", padding: "10px 14px", color: t.textMuted, cursor: "pointer", fontFamily: "inherit", fontSize: "13px", width: "100%" }}>
              <Plus size={14} /> Add Question
            </button>
          )}
        </Section>

        {/* ── Display & Privacy ── */}
        <Section title="Display & Privacy" t={t}>
          <Toggle label="Allow guest comments" value={commentsEnabled} onChange={(val) => { setCommentsEnabled(val); triggerSaveSettings({ commentsEnabled: val }); }} t={t} />
          
          <Toggle
            label="Allow guest sharing (Copy link & QR code)"
            value={guestSharingEnabled}
            onChange={(val) => {
              setGuestSharingEnabled(val);
              triggerSaveSettings({ guestSharingEnabled: val });
            }}
            t={t}
          />

          <Toggle label="Show RSVP timestamps" value={showTimestamps} onChange={(val) => { setShowTimestamps(val); triggerSaveSettings({ showTimestamps: val }); }} t={t} />
          
          <div style={{ marginBottom: "16px" }}>
            <Label t={t}>Guest list visibility</Label>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {([["ALL", "Everyone can see"], ["GUESTS_ONLY", "Going guests only"], ["HOST_ONLY", "Host only"]] as const).map(([val, label]) => (
                <label key={val} style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer" }}>
                  <input type="radio" checked={guestListVis === val} onChange={() => { setGuestListVis(val); triggerSaveSettings({ guestListVis: val }); }} style={{ accentColor: t.accent }} />
                  <span style={{ fontSize: "14px", color: t.textSecondary }}>{label}</span>
                </label>
              ))}
            </div>
          </div>
          <div style={{ marginBottom: "16px" }}>
            <Label t={t}>Event visibility</Label>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {([["PUBLIC", "Public — findable by anyone"], ["UNLISTED", "Unlisted — only people with the link"], ["PRIVATE", "Private — invite only"]] as const).map(([val, label]) => (
                <label key={val} style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer" }}>
                  <input type="radio" checked={visibility === val} onChange={() => { setVisibility(val); triggerSaveSettings({ visibility: val }); }} style={{ accentColor: t.accent }} />
                  <span style={{ fontSize: "14px", color: t.textSecondary }}>{label}</span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <Label t={t}>Event password (optional)</Label>
            <input
              type="text"
              placeholder="Leave blank for no password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onBlur={() => {
                triggerSaveSettings({ password: password.trim() || null });
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  triggerSaveSettings({ password: password.trim() || null });
                  e.currentTarget.blur();
                }
              }}
              style={S.inp}
              autoComplete="off"
            />
            {password && <div style={{ fontSize: "12px", color: t.textMuted, marginTop: "6px" }}>Guests must enter this password to view the event.</div>}
          </div>
        </Section>

        {/* ── Auto-Reminders ── */}
        <Section title="Auto-Reminders" t={t}>
          <div style={{ fontSize: "13px", color: t.textMuted, marginBottom: "16px" }}>
            Reminders are sent to guests who provided their email or phone number.
          </div>
          <div style={{ marginBottom: "20px" }}>
            <Label t={t}>Email reminders</Label>
            <Toggle label="1 week before" value={emailWeekBefore} onChange={(val) => { setEmailWeekBefore(val); triggerSaveReminders({ emailWeekBefore: val }); }} t={t} />
            <Toggle label="1 day before" value={emailDayBefore} onChange={(val) => { setEmailDayBefore(val); triggerSaveReminders({ emailDayBefore: val }); }} t={t} />
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
              <span style={{ fontSize: "14px", color: t.textSecondary, flex: 1 }}>Hours before</span>
              <select value={emailHoursBefore} onChange={(e) => { const val = Number(e.target.value); setEmailHoursBefore(val); triggerSaveReminders({ emailHoursBefore: val }); }} style={{ padding: "6px 10px", background: t.inputBg, border: `1px solid ${t.inputBorder}`, borderRadius: "8px", color: t.textPrimary, fontFamily: "inherit", colorScheme: t.textPrimary === "#ffffff" ? "dark" : "light", cursor: "pointer" }}>
                <option value={0}>Off</option>
                <option value={1}>1 hour</option>
                <option value={2}>2 hours</option>
                <option value={4}>4 hours</option>
              </select>
            </div>
          </div>
          <div style={{ marginBottom: "20px" }}>
            <Label t={t}>SMS reminders</Label>
            <Toggle label="1 week before" value={smsWeekBefore} onChange={(val) => { setSmsWeekBefore(val); triggerSaveReminders({ smsWeekBefore: val }); }} t={t} />
            <Toggle label="1 day before" value={smsDayBefore} onChange={(val) => { setSmsDayBefore(val); triggerSaveReminders({ smsDayBefore: val }); }} t={t} />
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
              <span style={{ fontSize: "14px", color: t.textSecondary, flex: 1 }}>Hours before</span>
              <select value={smsHoursBefore} onChange={(e) => { const val = Number(e.target.value); setSmsHoursBefore(val); triggerSaveReminders({ smsHoursBefore: val }); }} style={{ padding: "6px 10px", background: t.inputBg, border: `1px solid ${t.inputBorder}`, borderRadius: "8px", color: t.textPrimary, fontFamily: "inherit", colorScheme: t.textPrimary === "#ffffff" ? "dark" : "light", cursor: "pointer" }}>
                <option value={0}>Off</option>
                <option value={1}>1 hour</option>
                <option value={2}>2 hours</option>
              </select>
            </div>
          </div>
          <Toggle label="Nudge guests who haven't RSVP'd (3 days before)" value={nudgeUnresponded} onChange={(val) => { setNudgeUnresponded(val); triggerSaveReminders({ nudgeUnresponded: val }); }} t={t} />
          <Toggle label="Post-event photo upload prompt" value={postEventPrompt} onChange={(val) => { setPostEventPrompt(val); triggerSaveReminders({ postEventPrompt: val }); }} t={t} />
        </Section>

        {err && <div style={{ color: "#f87171", fontSize: "13px", textAlign: "center", marginTop: "16px" }}>{err}</div>}
      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function Label({ children, t }: { children: React.ReactNode; t: ResolvedTheme }) {
  return <div style={{ fontSize: "12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: t.textMuted, marginBottom: "10px" }}>{children}</div>;
}

function Toggle({ label, value, onChange, t }: { label: string; value: boolean; onChange: (v: boolean) => void; t: ResolvedTheme }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
      <span style={{ fontSize: "14px", color: t.textSecondary }}>{label}</span>
      <button onClick={() => onChange(!value)} style={{ width: "44px", height: "24px", borderRadius: "100px", cursor: "pointer", background: value ? t.accent : t.inputBg, border: `1px solid ${t.inputBorder}`, position: "relative", transition: "background 0.2s", flexShrink: 0 }}>
        <span style={{ position: "absolute", top: "3px", left: value ? "23px" : "3px", width: "18px", height: "18px", borderRadius: "50%", background: value ? t.accentFg : t.textSecondary, transition: "left 0.2s" }} />
      </button>
    </div>
  );
}

function Section({ title, children, t }: { title: string; children: React.ReactNode; t: ResolvedTheme }) {
  return (
    <div style={{ background: t.cardBg, border: `1px solid ${t.cardBorder}`, borderRadius: t.cardRadius, padding: "20px", marginBottom: "16px", boxShadow: t.cardShadow, backdropFilter: "blur(12px)" }}>
      <h2 style={{ fontSize: "15px", fontWeight: 700, color: t.textPrimary, marginBottom: "20px" }}>{title}</h2>
      {children}
    </div>
  );
}
