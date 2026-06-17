"use client";

import { useState, useTransition } from "react";
import { ArrowLeft, Check, Plus, X } from "lucide-react";
import { ACCENT_PRESETS, BASE_THEMES, type BaseTheme } from "@/lib/theme";
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

export function SettingsPage({ event, isOwner }: { event: EventInput; isOwner: boolean }) {
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // ── Theme ──
  const [base, setBase] = useState<BaseTheme>(event.theme?.baseTheme ?? "DARK");
  const [accent, setAccent] = useState(event.theme?.accentColor ?? "#a855f7");

  // ── RSVP Options ──
  const [plusOneAllowed, setPlusOneAllowed] = useState(event.plusOneAllowed);
  const [plusOneMax, setPlusOneMax] = useState(event.plusOneMax);
  const [approvalRequired, setApprovalRequired] = useState(event.approvalRequired);
  const [maybeEnabled, setMaybeEnabled] = useState(event.maybeEnabled);
  const [capacity, setCapacity] = useState(event.capacity?.toString() ?? "");
  const [rsvpDeadline, setRsvpDeadline] = useState(
    event.rsvpDeadline ? new Date(event.rsvpDeadline).toISOString().slice(0, 16) : ""
  );

  // ── Display & Privacy ──
  const [commentsEnabled, setCommentsEnabled] = useState(event.commentsEnabled);
  const [guestListVis, setGuestListVis] = useState(event.guestListVis);
  const [showTimestamps, setShowTimestamps] = useState(event.showTimestamps);
  const [visibility, setVisibility] = useState(event.visibility);
  const [password, setPassword] = useState(event.password ?? "");

  // ── Reminders ──
  const rs = event.reminderSettings;
  const [emailWeekBefore, setEmailWeekBefore] = useState(rs?.emailWeekBefore ?? false);
  const [emailDayBefore, setEmailDayBefore] = useState(rs?.emailDayBefore ?? true);
  const [emailHoursBefore, setEmailHoursBefore] = useState(rs?.emailHoursBefore ?? 2);
  const [smsWeekBefore, setSmsWeekBefore] = useState(rs?.smsWeekBefore ?? false);
  const [smsDayBefore, setSmsDayBefore] = useState(rs?.smsDayBefore ?? false);
  const [smsHoursBefore, setSmsHoursBefore] = useState(rs?.smsHoursBefore ?? 0);
  const [nudgeUnresponded, setNudgeUnresponded] = useState(rs?.nudgeUnresponded ?? true);
  const [postEventPrompt, setPostEventPrompt] = useState(rs?.postEventPrompt ?? false);

  // ── Co-hosts ──
  const [coHosts, setCoHosts] = useState<CoHostEntry[]>(event.coHosts);
  const [cohostEmail, setCohostEmail] = useState("");
  const [cohostError, setCohostError] = useState<string | null>(null);

  // ── Questionnaire ──
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

  const flash = (section: string) => {
    setSaved(section);
    setErr(null);
    setTimeout(() => setSaved(null), 2000);
  };

  const saveTheme = () => startTransition(async () => {
    await saveEventTheme(event.id, base, accent);
    flash("theme");
  });

  const saveRsvpOptions = () => startTransition(async () => {
    await saveEventSettings(event.id, {
      plusOneAllowed, plusOneMax, approvalRequired, maybeEnabled,
      capacity: capacity ? Number(capacity) : null,
      rsvpDeadline: rsvpDeadline || null,
    });
    flash("rsvp");
  });

  const saveDisplayPrivacy = () => startTransition(async () => {
    await saveEventSettings(event.id, {
      commentsEnabled, guestListVis, showTimestamps, visibility,
      password: password || null,
    });
    flash("display");
  });

  const saveReminders = () => startTransition(async () => {
    await saveReminderSettings(event.id, {
      emailWeekBefore, emailDayBefore, emailHoursBefore,
      smsWeekBefore, smsDayBefore, smsHoursBefore,
      nudgeUnresponded, postEventPrompt,
    });
    flash("reminders");
  });

  const saveQuestionnaire = () => startTransition(async () => {
    await saveEventSettings(event.id, { questionnaireEnabled });
    flash("questionnaire");
  });

  const handleAddCohost = () => startTransition(async () => {
    setCohostError(null);
    const result = await addCoHost(event.id, cohostEmail.trim());
    if (!result.success) { setCohostError(result.error ?? "Error"); return; }
    setCoHosts((prev) => [...prev, {
      id: result.cohostId!,
      user: { id: result.cohostId!, name: result.name ?? null, email: result.email! },
    }]);
    setCohostEmail("");
  });

  const handleRemoveCohost = (cohostRecordId: string) => startTransition(async () => {
    await removeCoHost(cohostRecordId);
    setCoHosts((prev) => prev.filter((c) => c.id !== cohostRecordId));
  });

  const handleAddField = () => startTransition(async () => {
    if (!newFieldLabel.trim()) return;
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
      setNewFieldLabel("");
      setNewFieldType("TEXT");
      setNewFieldRequired(false);
      setNewFieldOptions("");
      setAddingField(false);
    }
  });

  const handleUpdateFieldType = (fieldId: string, fieldType: RsvpFieldEntry["fieldType"]) => startTransition(async () => {
    await updateRsvpField(fieldId, { fieldType });
    setFields((prev) => prev.map((x) => x.id === fieldId ? { ...x, fieldType } : x));
  });

  const handleUpdateFieldRequired = (fieldId: string, required: boolean) => startTransition(async () => {
    await updateRsvpField(fieldId, { required });
    setFields((prev) => prev.map((x) => x.id === fieldId ? { ...x, required } : x));
  });

  const handleUpdateFieldLabel = (fieldId: string) => startTransition(async () => {
    const label = (labelDrafts[fieldId] ?? "").trim();
    if (!label) return;
    await updateRsvpField(fieldId, { label });
    setFields((prev) => prev.map((x) => x.id === fieldId ? { ...x, label } : x));
  });

  const handleUpdateFieldOptions = (fieldId: string) => startTransition(async () => {
    const options = optionsDrafts[fieldId] ?? "";
    await updateRsvpField(fieldId, { options });
    setFields((prev) => prev.map((x) => x.id === fieldId ? { ...x, options } : x));
  });

  const handleDeleteField = (fieldId: string) => startTransition(async () => {
    await deleteRsvpField(fieldId);
    setFields((prev) => prev.filter((x) => x.id !== fieldId));
  });

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0f", color: "#fff", fontFamily: "inherit" }}>
      <div style={{ position: "sticky", top: 0, background: "rgba(10,10,15,0.9)", backdropFilter: "blur(12px)", borderBottom: "1px solid rgba(255,255,255,0.08)", padding: "16px 20px", display: "flex", alignItems: "center", gap: "12px", zIndex: 10 }}>
        <a href={`/e/${event.slug}`} style={{ display: "flex", alignItems: "center", color: "rgba(255,255,255,0.6)", textDecoration: "none" }}>
          <ArrowLeft size={20} />
        </a>
        <h1 style={{ fontSize: "17px", fontWeight: 700 }}>Event Settings</h1>
      </div>

      <div style={{ maxWidth: "480px", margin: "0 auto", padding: "24px 16px 80px" }}>

        {/* ── Theme ── */}
        <Section title="Theme" onSave={saveTheme} saved={saved === "theme"} isPending={isPending}>
          <div style={{ marginBottom: "20px" }}>
            <Label>Style</Label>
            <div style={{ display: "flex", gap: "10px" }}>
              {BASE_THEMES.map((bt) => (
                <button key={bt.id} onClick={() => setBase(bt.id)} style={{ flex: 1, padding: 0, border: `2px solid ${base === bt.id ? "#fff" : "rgba(255,255,255,0.1)"}`, borderRadius: "16px", cursor: "pointer", overflow: "hidden", background: "none", transition: "border-color 0.15s" }}>
                  <div style={{ height: "44px", background: bt.preview }} />
                  <div style={{ padding: "6px 4px", color: "#fff", fontSize: "10px", fontWeight: 600, background: "rgba(255,255,255,0.05)" }}>{bt.label}</div>
                </button>
              ))}
            </div>
          </div>
          <Label>Accent Color</Label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
            {ACCENT_PRESETS.map((p) => (
              <button key={p.value} onClick={() => setAccent(p.value)} title={p.name} style={{ width: "32px", height: "32px", borderRadius: "50%", background: p.value, border: `3px solid ${accent === p.value ? "#fff" : "transparent"}`, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {accent === p.value && <Check size={12} color="#fff" strokeWidth={3} />}
              </button>
            ))}
            <label style={{ width: "32px", height: "32px", borderRadius: "50%", border: `3px solid ${!ACCENT_PRESETS.some(p => p.value === accent) ? "#fff" : "transparent"}`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", background: ACCENT_PRESETS.some(p => p.value === accent) ? "rgba(255,255,255,0.1)" : accent, position: "relative", overflow: "hidden" }}>
              🎨
              <input type="color" value={accent} onChange={(e) => setAccent(e.target.value)} style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer" }} />
            </label>
          </div>
        </Section>

        {/* ── Hosts ── */}
        {isOwner && (
          <Section title="Hosts" noSave>
            <div style={{ marginBottom: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                <div style={AV}>{event.slug[0]?.toUpperCase()}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "14px", fontWeight: 600 }}>You</div>
                  <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)" }}>Host</div>
                </div>
              </div>
              {coHosts.map((ch) => (
                <div key={ch.id} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                  <div style={AV}>{(ch.user.name ?? ch.user.email)[0].toUpperCase()}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: "14px", fontWeight: 600 }}>{ch.user.name ?? ch.user.email}</div>
                    <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)" }}>{ch.user.email} · Co-host</div>
                  </div>
                  <button onClick={() => handleRemoveCohost(ch.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.3)", padding: "4px" }} title="Remove co-host">
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
                style={INP}
              />
              <button onClick={handleAddCohost} disabled={!cohostEmail.trim() || isPending} style={SMALL_BTN}>Add</button>
            </div>
            {cohostError && <div style={{ fontSize: "13px", color: "#f87171", marginTop: "8px" }}>{cohostError}</div>}
          </Section>
        )}

        {/* ── RSVP Options ── */}
        <Section title="RSVP Options" onSave={saveRsvpOptions} saved={saved === "rsvp"} isPending={isPending}>
          <Toggle label="Allow plus-ones" value={plusOneAllowed} onChange={setPlusOneAllowed} />
          {plusOneAllowed && (
            <div style={{ marginBottom: "16px" }}>
              <Label>Max plus-ones per guest</Label>
              <div style={{ display: "flex", gap: "8px" }}>
                {[1, 2, 3, 5].map((n) => (
                  <button key={n} onClick={() => setPlusOneMax(n)} style={{ padding: "8px 16px", borderRadius: "8px", border: "none", cursor: "pointer", background: plusOneMax === n ? "#a855f7" : "rgba(255,255,255,0.08)", color: plusOneMax === n ? "#fff" : "rgba(255,255,255,0.6)", fontFamily: "inherit", fontWeight: 600 }}>{n}</button>
                ))}
              </div>
            </div>
          )}
          <Toggle label="Require host approval for each RSVP" value={approvalRequired} onChange={setApprovalRequired} />
          <Toggle label="Guests can RSVP «Maybe»" value={maybeEnabled} onChange={setMaybeEnabled} />
          <div style={{ marginBottom: "16px" }}>
            <Label>Capacity limit (optional)</Label>
            <input type="number" placeholder="No limit" value={capacity} onChange={(e) => setCapacity(e.target.value)} style={INP} />
          </div>
          <div>
            <Label>RSVP deadline (optional)</Label>
            <input type="datetime-local" value={rsvpDeadline} onChange={(e) => setRsvpDeadline(e.target.value)} style={{ ...INP, colorScheme: "dark" }} />
          </div>
        </Section>

        {/* ── Questionnaire ── */}
        <Section title="Questionnaire" onSave={saveQuestionnaire} saved={saved === "questionnaire"} isPending={isPending}>
          <Toggle label="Ask guests custom questions" value={questionnaireEnabled} onChange={setQuestionnaireEnabled} />

          {fields.length > 0 && (
            <div style={{ marginTop: "16px", display: "flex", flexDirection: "column", gap: "10px" }}>
              {fields.map((f) => (
                <div key={f.id} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "14px", padding: "14px" }}>
                  {/* Top row: type select + required + delete */}
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
                    <select
                      value={f.fieldType}
                      onChange={(e) => handleUpdateFieldType(f.id, e.target.value as RsvpFieldEntry["fieldType"])}
                      style={{ flex: 1, padding: "6px 10px", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "8px", color: "#fff", fontFamily: "inherit", fontSize: "12px", cursor: "pointer" }}
                    >
                      <option value="TEXT">Short text</option>
                      <option value="TEXTAREA">Long text</option>
                      <option value="SELECT">Multiple choice</option>
                      <option value="CHECKBOX">Checkboxes</option>
                    </select>
                    <label style={{ display: "flex", alignItems: "center", gap: "5px", cursor: "pointer", fontSize: "12px", color: "rgba(255,255,255,0.6)", whiteSpace: "nowrap" }}>
                      <input
                        type="checkbox"
                        checked={f.required}
                        onChange={(e) => handleUpdateFieldRequired(f.id, e.target.checked)}
                        style={{ accentColor: "#a855f7" }}
                      />
                      Required
                    </label>
                    <button onClick={() => handleDeleteField(f.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.3)", padding: "4px", flexShrink: 0, display: "flex", alignItems: "center" }}>
                      <X size={15} />
                    </button>
                  </div>
                  {/* Label input */}
                  <input
                    value={labelDrafts[f.id] ?? f.label}
                    onChange={(e) => setLabelDrafts((prev) => ({ ...prev, [f.id]: e.target.value }))}
                    onBlur={() => handleUpdateFieldLabel(f.id)}
                    placeholder="Question text"
                    style={{ ...INP, marginBottom: (f.fieldType === "SELECT" || f.fieldType === "CHECKBOX") ? "8px" : 0 }}
                  />
                  {/* Options textarea for SELECT/CHECKBOX */}
                  {(f.fieldType === "SELECT" || f.fieldType === "CHECKBOX") && (
                    <textarea
                      value={optionsDrafts[f.id] ?? (f.options ?? "")}
                      onChange={(e) => setOptionsDrafts((prev) => ({ ...prev, [f.id]: e.target.value }))}
                      onBlur={() => handleUpdateFieldOptions(f.id)}
                      placeholder="Options, one per line"
                      style={{ ...INP, resize: "none", marginTop: "4px" } as React.CSSProperties}
                      rows={3}
                    />
                  )}
                </div>
              ))}
            </div>
          )}

          {addingField ? (
            <div style={{ marginTop: "12px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "14px", padding: "14px", display: "flex", flexDirection: "column", gap: "8px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <select value={newFieldType} onChange={(e) => setNewFieldType(e.target.value as typeof newFieldType)} style={{ flex: 1, padding: "6px 10px", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "8px", color: "#fff", fontFamily: "inherit", fontSize: "12px", cursor: "pointer" }}>
                  <option value="TEXT">Short text</option>
                  <option value="TEXTAREA">Long text</option>
                  <option value="SELECT">Multiple choice</option>
                  <option value="CHECKBOX">Checkboxes</option>
                </select>
                <label style={{ display: "flex", alignItems: "center", gap: "5px", cursor: "pointer", fontSize: "12px", color: "rgba(255,255,255,0.6)", whiteSpace: "nowrap" }}>
                  <input type="checkbox" checked={newFieldRequired} onChange={(e) => setNewFieldRequired(e.target.checked)} style={{ accentColor: "#a855f7" }} />
                  Required
                </label>
              </div>
              <input value={newFieldLabel} onChange={(e) => setNewFieldLabel(e.target.value)} placeholder="Question text *" style={INP} />
              {(newFieldType === "SELECT" || newFieldType === "CHECKBOX") && (
                <textarea value={newFieldOptions} onChange={(e) => setNewFieldOptions(e.target.value)} placeholder="Options, one per line" style={{ ...INP, resize: "none" } as React.CSSProperties} rows={3} />
              )}
              <div style={{ display: "flex", gap: "6px" }}>
                <button onClick={handleAddField} disabled={!newFieldLabel.trim() || isPending} style={{ ...SMALL_BTN, flex: 1 }}>Add Question</button>
                <button onClick={() => setAddingField(false)} style={{ ...SMALL_BTN, background: "rgba(255,255,255,0.08)" }}>Cancel</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setAddingField(true)} style={{ marginTop: "12px", display: "flex", alignItems: "center", gap: "6px", background: "rgba(255,255,255,0.06)", border: "1px dashed rgba(255,255,255,0.15)", borderRadius: "10px", padding: "10px 14px", color: "rgba(255,255,255,0.5)", cursor: "pointer", fontFamily: "inherit", fontSize: "13px", width: "100%" }}>
              <Plus size={14} /> Add Question
            </button>
          )}
        </Section>

        {/* ── Display & Privacy ── */}
        <Section title="Display & Privacy" onSave={saveDisplayPrivacy} saved={saved === "display"} isPending={isPending}>
          <Toggle label="Allow guest comments" value={commentsEnabled} onChange={setCommentsEnabled} />
          <Toggle label="Show RSVP timestamps" value={showTimestamps} onChange={setShowTimestamps} />
          <div style={{ marginBottom: "16px" }}>
            <Label>Guest list visibility</Label>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {([["ALL", "Everyone can see"], ["GUESTS_ONLY", "Going guests only"], ["HOST_ONLY", "Host only"]] as const).map(([val, label]) => (
                <label key={val} style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer" }}>
                  <input type="radio" checked={guestListVis === val} onChange={() => setGuestListVis(val)} style={{ accentColor: "#a855f7" }} />
                  <span style={{ fontSize: "14px", color: "rgba(255,255,255,0.8)" }}>{label}</span>
                </label>
              ))}
            </div>
          </div>
          <div style={{ marginBottom: "16px" }}>
            <Label>Event visibility</Label>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {([["PUBLIC", "Public — findable by anyone"], ["UNLISTED", "Unlisted — only people with the link"], ["PRIVATE", "Private — invite only"]] as const).map(([val, label]) => (
                <label key={val} style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer" }}>
                  <input type="radio" checked={visibility === val} onChange={() => setVisibility(val)} style={{ accentColor: "#a855f7" }} />
                  <span style={{ fontSize: "14px", color: "rgba(255,255,255,0.8)" }}>{label}</span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <Label>Event password (optional)</Label>
            <input type="text" placeholder="Leave blank for no password" value={password} onChange={(e) => setPassword(e.target.value)} style={INP} autoComplete="off" />
            {password && <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.35)", marginTop: "6px" }}>Guests must enter this password to view the event.</div>}
          </div>
        </Section>

        {/* ── Auto-Reminders ── */}
        <Section title="Auto-Reminders" onSave={saveReminders} saved={saved === "reminders"} isPending={isPending}>
          <div style={{ fontSize: "13px", color: "rgba(255,255,255,0.4)", marginBottom: "16px" }}>
            Reminders are sent to guests who provided their email or phone number.
          </div>
          <div style={{ marginBottom: "20px" }}>
            <Label>Email reminders</Label>
            <Toggle label="1 week before" value={emailWeekBefore} onChange={setEmailWeekBefore} />
            <Toggle label="1 day before" value={emailDayBefore} onChange={setEmailDayBefore} />
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
              <span style={{ fontSize: "14px", color: "rgba(255,255,255,0.8)", flex: 1 }}>Hours before</span>
              <select value={emailHoursBefore} onChange={(e) => setEmailHoursBefore(Number(e.target.value))} style={{ padding: "6px 10px", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", color: "#fff", fontFamily: "inherit" }}>
                <option value={0}>Off</option>
                <option value={1}>1 hour</option>
                <option value={2}>2 hours</option>
                <option value={4}>4 hours</option>
              </select>
            </div>
          </div>
          <div style={{ marginBottom: "20px" }}>
            <Label>SMS reminders</Label>
            <Toggle label="1 week before" value={smsWeekBefore} onChange={setSmsWeekBefore} />
            <Toggle label="1 day before" value={smsDayBefore} onChange={setSmsDayBefore} />
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
              <span style={{ fontSize: "14px", color: "rgba(255,255,255,0.8)", flex: 1 }}>Hours before</span>
              <select value={smsHoursBefore} onChange={(e) => setSmsHoursBefore(Number(e.target.value))} style={{ padding: "6px 10px", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", color: "#fff", fontFamily: "inherit" }}>
                <option value={0}>Off</option>
                <option value={1}>1 hour</option>
                <option value={2}>2 hours</option>
              </select>
            </div>
          </div>
          <Toggle label="Nudge guests who haven't RSVP'd (3 days before)" value={nudgeUnresponded} onChange={setNudgeUnresponded} />
          <Toggle label="Post-event photo upload prompt" value={postEventPrompt} onChange={setPostEventPrompt} />
        </Section>

        {err && <div style={{ color: "#f87171", fontSize: "13px", textAlign: "center" }}>{err}</div>}
      </div>
    </div>
  );
}

// ── Style constants ────────────────────────────────────────────────────────────

const INP: React.CSSProperties = {
  width: "100%",
  padding: "10px 14px",
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: "10px",
  color: "#fff",
  fontFamily: "inherit",
  fontSize: "14px",
  outline: "none",
  boxSizing: "border-box",
};

const SMALL_BTN: React.CSSProperties = {
  padding: "8px 16px",
  background: "#a855f7",
  color: "#fff",
  border: "none",
  borderRadius: "8px",
  cursor: "pointer",
  fontFamily: "inherit",
  fontSize: "13px",
  fontWeight: 700,
  whiteSpace: "nowrap",
};

const AV: React.CSSProperties = {
  width: "32px",
  height: "32px",
  borderRadius: "50%",
  background: "#a855f7",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: "13px",
  fontWeight: 700,
  color: "#fff",
  flexShrink: 0,
};

// ── Sub-components ─────────────────────────────────────────────────────────────

function Label({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: "12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "rgba(255,255,255,0.4)", marginBottom: "10px" }}>{children}</div>;
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
      <span style={{ fontSize: "14px", color: "rgba(255,255,255,0.8)" }}>{label}</span>
      <button onClick={() => onChange(!value)} style={{ width: "44px", height: "24px", borderRadius: "100px", border: "none", cursor: "pointer", background: value ? "#a855f7" : "rgba(255,255,255,0.15)", position: "relative", transition: "background 0.2s", flexShrink: 0 }}>
        <span style={{ position: "absolute", top: "3px", left: value ? "23px" : "3px", width: "18px", height: "18px", borderRadius: "50%", background: "#fff", transition: "left 0.2s" }} />
      </button>
    </div>
  );
}

function Section({ title, children, onSave, saved, isPending, noSave }: { title: string; children: React.ReactNode; onSave?: () => void; saved?: boolean; isPending?: boolean; noSave?: boolean }) {
  return (
    <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "20px", padding: "20px", marginBottom: "16px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
        <h2 style={{ fontSize: "15px", fontWeight: 700 }}>{title}</h2>
        {!noSave && onSave && (
          <button onClick={onSave} disabled={isPending} style={{ padding: "6px 16px", background: saved ? "#22c55e" : "#a855f7", color: "#fff", border: "none", borderRadius: "8px", cursor: "pointer", fontSize: "13px", fontWeight: 700, fontFamily: "inherit", display: "flex", alignItems: "center", gap: "4px", transition: "background 0.2s" }}>
            {saved ? <><Check size={13} /> Saved</> : isPending ? "Saving…" : "Save"}
          </button>
        )}
      </div>
      {children}
    </div>
  );
}
