"use client";

import { useState, useTransition } from "react";
import { addRSVP, updateRSVP } from "@/app/actions/event";
import type { ResolvedTheme } from "@/lib/theme";

type RsvpField = { id: string; label: string; fieldType: string; required: boolean; options: string | null };

const STATUS_LABELS = { GOING: "Going", MAYBE: "Maybe", NO: "Can't go" } as const;
const STATUS_EMOJIS = { GOING: "🎉", MAYBE: "🤔", NO: "😔" } as const;

function StatusButton({ s, active, t, onClick }: { s: "GOING" | "MAYBE" | "NO"; active: boolean; t: ResolvedTheme; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1, padding: "14px 8px", border: active ? "none" : `1px solid ${t.inputBorder}`,
        borderRadius: t.btnRadius, cursor: "pointer", fontFamily: "inherit", fontSize: "13px",
        fontWeight: 700, background: active ? t.accent : t.inputBg,
        color: active ? t.accentFg : t.textSecondary,
        boxShadow: active ? t.accentShadow : "none",
      }}
    >
      <div style={{ fontSize: "22px", marginBottom: "5px" }}>{STATUS_EMOJIS[s]}</div>
      {STATUS_LABELS[s]}
    </button>
  );
}

type EventData = {
  id: string;
  slug: string;
  title: string;
  startAt: Date;
  endAt: Date | null;
  timezone: string;
  locationName: string | null;
  plusOneAllowed: boolean;
  plusOneMax: number;
  maybeEnabled: boolean;
  questionnaireEnabled: boolean;
  rsvpFields: RsvpField[];
};

type ExistingRsvp = {
  id: string;
  editToken: string;
  guestName: string;
  status: "GOING" | "MAYBE" | "NO";
  plusOneCount: number;
  note: string | null;
  plusOneGuests: { name: string; order: number }[];
  answers: { rsvpFieldId: string; value: string }[];
};

export function RsvpFlow({
  event,
  theme,
  initialStatus,
  existingRsvp,
  returnPath,
}: {
  event: EventData;
  theme: ResolvedTheme;
  initialStatus?: "GOING" | "MAYBE" | "NO";
  existingRsvp?: ExistingRsvp;
  returnPath?: string;
}) {
  const t = theme;
  const isEdit = !!existingRsvp;

  const [step, setStep] = useState(1);
  const [status, setStatus] = useState<"GOING" | "MAYBE" | "NO">(
    existingRsvp?.status ?? initialStatus ?? "GOING"
  );
  const [name, setName] = useState(existingRsvp?.guestName ?? "");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState(existingRsvp?.note ?? "");
  const [plusOneNames, setPlusOneNames] = useState<string[]>(
    existingRsvp?.plusOneGuests.slice().sort((a, b) => a.order - b.order).map((g) => g.name) ?? []
  );
  const [answers, setAnswers] = useState<Record<string, string>>(
    existingRsvp
      ? Object.fromEntries(existingRsvp.answers.map((a) => [a.rsvpFieldId, a.value]))
      : {}
  );
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const hasQuestionnaire = event.questionnaireEnabled && event.rsvpFields.length > 0;
  const maxStep = hasQuestionnaire ? 2 : 1;

  const plusOneCount = plusOneNames.filter((n) => n.trim()).length;

  const addPlusOne = () => {
    if (plusOneNames.length < event.plusOneMax) {
      setPlusOneNames((prev) => [...prev, ""]);
    }
  };

  const removePlusOne = (i: number) => {
    setPlusOneNames((prev) => prev.filter((_, idx) => idx !== i));
  };

  const setAnswerValue = (fieldId: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [fieldId]: value }));
  };

  const checkboxToggle = (fieldId: string, opt: string) => {
    const current = (answers[fieldId] ?? "").split(",").filter(Boolean);
    const checked = current.includes(opt);
    const next = checked ? current.filter((x) => x !== opt) : [...current, opt];
    setAnswerValue(fieldId, next.join(","));
  };

  const requiredUnanswered = event.rsvpFields.filter(
    (f) => f.required && !answers[f.id]?.trim()
  );

  const canProceedStep1 = name.trim().length > 0;

  const handleContinue = () => {
    if (step < maxStep) { setStep(2); return; }
    submit();
  };

  const submit = () => {
    startTransition(async () => {
      setError(null);
      if (isEdit && existingRsvp) {
        const result = await updateRSVP(existingRsvp.editToken, {
          status,
          plusOneCount,
          plusOneGuestNames: plusOneNames.filter((n) => n.trim()),
          note: note.trim() || undefined,
          answers,
        });
        if (!result.success) { setError(result.error ?? "Something went wrong"); return; }
      } else {
        const result = await addRSVP({
          eventId: event.id,
          guestName: name.trim(),
          guestEmail: email.trim() || undefined,
          guestPhone: phone.trim() || undefined,
          status,
          plusOneCount,
          plusOneGuestNames: plusOneNames.filter((n) => n.trim()),
          note: note.trim() || undefined,
          answers,
        });
        if (!result.success) { setError(result.error ?? "Something went wrong"); return; }
        if (result.editToken && typeof window !== "undefined") {
          const url = new URL(window.location.href);
          url.searchParams.set("token", result.editToken);
          url.searchParams.delete("status");
          window.history.replaceState({}, "", url.toString());
        }
      }
      setDone(true);
    });
  };

  const dateStr = new Date(event.startAt).toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", timeZone: event.timezone,
  });

  // ── Done screen ────────────────────────────────────────────────────────────
  if (done) {
    return (
      <div style={{ minHeight: "100vh", background: t.pageBg, color: t.textPrimary, fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}>
        <div style={{ width: "100%", maxWidth: "400px", textAlign: "center" }}>
          <div style={{ fontSize: "52px", marginBottom: "16px" }}>
            {status === "GOING" ? "🎉" : status === "MAYBE" ? "🤔" : "😔"}
          </div>
          <h2 style={{ fontSize: "22px", fontWeight: 800, marginBottom: "8px" }}>
            {isEdit ? "RSVP updated!" : status === "GOING" ? "You're in!" : status === "MAYBE" ? "Noted!" : "Got it."}
          </h2>
          <p style={{ color: t.textSecondary, fontSize: "15px", marginBottom: "28px" }}>
            {status === "GOING" ? "See you there!" : status === "MAYBE" ? "Hope you can make it." : "Sorry you can't make it."}
          </p>
          <a
            href={returnPath ?? `/e/${event.slug}`}
            style={{ display: "block", background: t.accent, color: t.accentFg, textDecoration: "none", borderRadius: t.btnRadius, padding: "14px", fontWeight: t.btnFontWeight as React.CSSProperties["fontWeight"], fontSize: "15px", textAlign: "center", boxShadow: t.accentShadow }}
          >
            {returnPath ? "Back to guest list" : "Back to event"}
          </a>
        </div>
      </div>
    );
  }

  // ── Shared layout wrapper ─────────────────────────────────────────────────
  const S = {
    page: { minHeight: "100vh", background: t.pageBg, color: t.textPrimary, fontFamily: "inherit", paddingBottom: "80px" } as React.CSSProperties,
    header: { padding: "16px 20px 0", maxWidth: "540px", margin: "0 auto" } as React.CSSProperties,
    body: { maxWidth: "540px", margin: "0 auto", padding: "24px 20px 0" } as React.CSSProperties,
    footer: { position: "fixed", bottom: 0, left: 0, right: 0, background: t.pageBg, borderTop: `1px solid ${t.cardBorder}`, padding: "14px 20px", display: "flex", gap: "10px", justifyContent: "flex-end", zIndex: 50 } as React.CSSProperties,
    inp: { width: "100%", padding: "13px 16px", background: t.inputBg, border: `1px solid ${t.inputBorder}`, borderRadius: "12px", color: t.textPrimary, fontFamily: "inherit", fontSize: "15px", outline: "none", boxSizing: "border-box" } as React.CSSProperties,
    label: { display: "block", fontSize: "12px", fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.07em", color: t.textMuted, marginBottom: "8px" },
    group: { marginBottom: "20px" } as React.CSSProperties,
    cancelBtn: { padding: "12px 22px", background: "transparent", border: `1px solid ${t.cardBorder}`, borderRadius: t.btnRadius, color: t.textMuted, fontFamily: "inherit", fontSize: "14px", fontWeight: 600, cursor: "pointer" } as React.CSSProperties,
    primaryBtn: { padding: "12px 28px", background: t.accent, border: "none", borderRadius: t.btnRadius, color: t.accentFg, fontFamily: "inherit", fontSize: "14px", fontWeight: t.btnFontWeight as React.CSSProperties["fontWeight"], cursor: "pointer", boxShadow: t.accentShadow } as React.CSSProperties,
  };

  // ── Step 1: Details ────────────────────────────────────────────────────────
  if (step === 1) {
    return (
      <div style={S.page}>
        <div style={S.header}>
          <a href={`/e/${event.slug}`} style={{ color: t.textMuted, fontSize: "13px", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "4px", padding: "12px 0" }}>
            ← Back
          </a>
          <div style={{ marginBottom: "20px" }}>
            <div style={{ fontSize: "12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: t.accent, marginBottom: "4px" }}>
              {isEdit ? "Update RSVP" : "RSVP"}
            </div>
            <h1 style={{ fontSize: "22px", fontWeight: 800, margin: "0 0 4px", lineHeight: 1.2 }}>{event.title}</h1>
            <p style={{ color: t.textSecondary, fontSize: "14px", margin: 0 }}>
              {dateStr}{event.locationName ? ` · ${event.locationName}` : ""}
            </p>
          </div>
        </div>

        <div style={S.body}>
          {/* Status buttons */}
          <div style={{ ...S.group }}>
            <div style={{ display: "flex", gap: "10px" }}>
              <StatusButton s="GOING" active={status === "GOING"} t={t} onClick={() => setStatus("GOING")} />
              {event.maybeEnabled && <StatusButton s="MAYBE" active={status === "MAYBE"} t={t} onClick={() => setStatus("MAYBE")} />}
              <StatusButton s="NO" active={status === "NO"} t={t} onClick={() => setStatus("NO")} />
            </div>
          </div>

          {/* RSVP as */}
          <div style={S.group}>
            <div style={S.label}>RSVP as</div>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {isEdit ? (
                <div style={{ ...S.inp, color: t.textSecondary }}>{name}</div>
              ) : (
                <input style={S.inp} placeholder="Your name *" value={name} onChange={(e) => setName(e.target.value)} />
              )}
              {!isEdit && (
                <>
                  <input style={S.inp} type="email" placeholder="Email (optional — for updates)" value={email} onChange={(e) => setEmail(e.target.value)} />
                  <input style={S.inp} type="tel" placeholder="Phone (optional — for SMS updates)" value={phone} onChange={(e) => setPhone(e.target.value)} />
                </>
              )}
            </div>
          </div>

          {/* Plus ones — only for GOING */}
          {event.plusOneAllowed && event.plusOneMax > 0 && status === "GOING" && (
            <div style={S.group}>
              <div style={S.label}>Guests</div>
              {plusOneNames.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "10px" }}>
                  {plusOneNames.map((n, i) => (
                    <div key={i} style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                      <input
                        style={{ ...S.inp, flex: 1 }}
                        placeholder={`Guest ${i + 1} name`}
                        value={n}
                        onChange={(e) => {
                          const next = [...plusOneNames];
                          next[i] = e.target.value;
                          setPlusOneNames(next);
                        }}
                      />
                      <button
                        onClick={() => removePlusOne(i)}
                        style={{ background: "none", border: "none", cursor: "pointer", color: t.textMuted, padding: "8px", flexShrink: 0, fontSize: "18px", lineHeight: 1 }}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {plusOneNames.length < event.plusOneMax && (
                <button
                  onClick={addPlusOne}
                  style={{ display: "flex", alignItems: "center", gap: "8px", background: t.inputBg, border: `1px dashed ${t.cardBorder}`, borderRadius: "12px", padding: "12px 16px", color: t.textMuted, cursor: "pointer", fontFamily: "inherit", fontSize: "14px", width: "100%" }}
                >
                  <span style={{ fontSize: "18px", lineHeight: 1 }}>+</span>
                  {plusOneNames.length === 0 ? "Add guests" : "Add another guest"}
                </button>
              )}
              {plusOneNames.length === 0 && (
                <p style={{ fontSize: "12px", color: t.textMuted, margin: "8px 0 0" }}>
                  Add guests for them to receive updates
                </p>
              )}
            </div>
          )}

          {/* Note */}
          <div style={S.group}>
            <div style={S.label}>Message for host (optional)</div>
            <textarea
              style={{ ...S.inp, resize: "none" } as React.CSSProperties}
              rows={3}
              placeholder="Leave a note…"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          {error && <p style={{ color: "#f87171", fontSize: "13px", marginBottom: "16px" }}>{error}</p>}
        </div>

        <div style={S.footer}>
          <a href={`/e/${event.slug}`} style={{ ...S.cancelBtn, textDecoration: "none", display: "inline-flex", alignItems: "center" }}>
            Cancel
          </a>
          <button
            onClick={handleContinue}
            disabled={!canProceedStep1 || isPending}
            style={{ ...S.primaryBtn, opacity: (!canProceedStep1 || isPending) ? 0.5 : 1 }}
          >
            {isPending ? "Saving…" : step < maxStep ? "Continue →" : isEdit ? "Update RSVP" : "Confirm RSVP"}
          </button>
        </div>
      </div>
    );
  }

  // ── Step 2: Questionnaire ──────────────────────────────────────────────────
  return (
    <div style={S.page}>
      <div style={S.header}>
        <button
          onClick={() => setStep(1)}
          style={{ background: "none", border: "none", cursor: "pointer", color: t.textMuted, fontSize: "13px", padding: "12px 0", display: "inline-flex", alignItems: "center", gap: "4px", fontFamily: "inherit" }}
        >
          ← Back
        </button>
        <div style={{ marginBottom: "8px" }}>
          <h1 style={{ fontSize: "20px", fontWeight: 800, margin: "0 0 4px" }}>Questions from the host</h1>
          <p style={{ color: t.textMuted, fontSize: "13px", margin: 0 }}>Only the host can see your answers</p>
        </div>
      </div>

      <div style={S.body}>
        {event.rsvpFields.map((f) => (
          <div key={f.id} style={{ marginBottom: "20px" }}>
            <label style={{ display: "block", fontSize: "14px", fontWeight: 600, color: t.textSecondary, marginBottom: "8px" }}>
              {f.label}
              {f.required && <span style={{ color: t.accent }}> *</span>}
            </label>
            {f.fieldType === "TEXTAREA" ? (
              <textarea
                style={{ ...S.inp, resize: "none" } as React.CSSProperties}
                rows={3}
                value={answers[f.id] ?? ""}
                onChange={(e) => setAnswerValue(f.id, e.target.value)}
              />
            ) : f.fieldType === "SELECT" ? (
              <select
                style={{ ...S.inp, cursor: "pointer" }}
                value={answers[f.id] ?? ""}
                onChange={(e) => setAnswerValue(f.id, e.target.value)}
              >
                <option value="">Select…</option>
                {(f.options ?? "").split("\n").filter(Boolean).map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            ) : f.fieldType === "CHECKBOX" ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {(f.options ?? "").split("\n").filter(Boolean).map((opt) => (
                  <label key={opt} style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer", fontSize: "14px" }}>
                    <input
                      type="checkbox"
                      checked={(answers[f.id] ?? "").split(",").includes(opt)}
                      onChange={() => checkboxToggle(f.id, opt)}
                      style={{ accentColor: t.accent, width: "16px", height: "16px" }}
                    />
                    {opt}
                  </label>
                ))}
              </div>
            ) : (
              <input
                style={S.inp}
                value={answers[f.id] ?? ""}
                onChange={(e) => setAnswerValue(f.id, e.target.value)}
              />
            )}
          </div>
        ))}

        {error && <p style={{ color: "#f87171", fontSize: "13px", marginBottom: "16px" }}>{error}</p>}
      </div>

      <div style={S.footer}>
        <button onClick={() => setStep(1)} style={S.cancelBtn}>← Back</button>
        <button
          onClick={submit}
          disabled={requiredUnanswered.length > 0 || isPending}
          style={{ ...S.primaryBtn, opacity: (requiredUnanswered.length > 0 || isPending) ? 0.5 : 1 }}
        >
          {isPending ? "Saving…" : isEdit ? "Update RSVP" : "Submit"}
        </button>
      </div>
    </div>
  );
}
