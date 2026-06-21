"use client";

import { useState, useTransition } from "react";
import { addRSVP, updateRSVP } from "@/app/actions/event";
import type { ResolvedTheme } from "@/lib/theme";
import { Check } from "lucide-react";

type RsvpField = { id: string; label: string; fieldType: string; required: boolean; options: string | null };

const parseOptions = (optionsStr: string | null): string[] => {
  if (!optionsStr) return [];
  try {
    const parsed = JSON.parse(optionsStr);
    if (Array.isArray(parsed)) {
      return parsed.map(String);
    }
  } catch {
    // Fall back to newline splitting
  }
  return optionsStr.split("\n").map(s => s.trim()).filter(Boolean);
};

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
  plusOneNamesRequired: boolean;
  maybeEnabled: boolean;
  questionnaireEnabled: boolean;
  rsvpFields: RsvpField[];
  polls?: { id: string; question: string }[];
  potluckItems?: { id: string; label: string }[];
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
    initialStatus ?? existingRsvp?.status ?? "GOING"
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
  const [savedEditToken, setSavedEditToken] = useState(existingRsvp?.editToken ?? "");
  const [linkCopied, setLinkCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const hasQuestionnaire = status !== "NO" && event.questionnaireEnabled && event.rsvpFields.length > 0;
  const maxStep = hasQuestionnaire ? 2 : 1;

  const plusOneCount = status === "GOING" ? plusOneNames.length : 0;
  const plusOneGuestNames = status === "GOING"
    ? plusOneNames.map((n, i) => n.trim() || `Guest ${i + 1} of ${name.trim()}`)
    : [];

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

  const canProceedStep1 = name.trim().length > 0 &&
    (status !== "GOING" || !event.plusOneNamesRequired || plusOneNames.every((n) => n.trim().length > 0));

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
          plusOneGuestNames,
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
          plusOneGuestNames,
          note: note.trim() || undefined,
          answers,
        });
        if (!result.success) { setError(result.error ?? "Something went wrong"); return; }
        if (result.editToken) {
          setSavedEditToken(result.editToken);
          if (typeof window !== "undefined") {
            const url = new URL(window.location.href);
            url.searchParams.set("token", result.editToken);
            url.searchParams.delete("status");
            window.history.replaceState({}, "", url.toString());
          }
        }
      }
      setDone(true);
    });
  };

  const dateStr = new Date(event.startAt).toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", timeZone: event.timezone,
  });

  const renderDecorations = () => {
    if (t.pageDecoration === "dark-orbs") {
      return (
        <>
          <div style={{ position: "fixed", top: "-20%", left: "30%", width: "600px", height: "600px", borderRadius: "50%", background: t.pageDecorationBg1, filter: "blur(40px)", pointerEvents: "none", zIndex: 0 }} />
          <div style={{ position: "fixed", bottom: "10%", right: "-10%", width: "400px", height: "400px", borderRadius: "50%", background: t.pageDecorationBg2, filter: "blur(40px)", pointerEvents: "none", zIndex: 0 }} />
        </>
      );
    }
    if (t.pageDecoration === "soft-blobs") {
      return (
        <>
          <div style={{ position: "fixed", top: "-10%", right: "-10%", width: "500px", height: "500px", borderRadius: "50%", background: t.pageDecorationBg1, filter: "blur(60px)", pointerEvents: "none", zIndex: 0 }} />
          <div style={{ position: "fixed", bottom: "20%", left: "-5%", width: "400px", height: "400px", borderRadius: "50%", background: t.pageDecorationBg2, filter: "blur(60px)", pointerEvents: "none", zIndex: 0 }} />
        </>
      );
    }
    if (t.pageDecoration === "bold-hero") {
      return <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: t.pageDecorationBg1, zIndex: 0 }} />;
    }
    return null;
  };

  // ── Done screen ────────────────────────────────────────────────────────
  if (done) {
    return (
      <div style={{ minHeight: "100vh", background: t.pageBg, color: t.textPrimary, fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px", position: "relative", overflowX: "hidden" }}>
        {renderDecorations()}
        <div style={{ width: "100%", maxWidth: "400px", textAlign: "center", position: "relative", zIndex: 1 }}>
          <div style={{ fontSize: "52px", marginBottom: "16px" }}>
            {status === "GOING" ? "🎉" : status === "MAYBE" ? "🤔" : "😔"}
          </div>
          <h2 style={{ fontSize: "22px", fontWeight: 800, marginBottom: "8px" }}>
            {isEdit ? "RSVP updated!" : status === "GOING" ? "You're in!" : status === "MAYBE" ? "Noted!" : "Got it."}
          </h2>
          <p style={{ color: t.textSecondary, fontSize: "15px", marginBottom: "28px" }}>
            {status === "GOING" ? "See you there!" : status === "MAYBE" ? "Hope you can make it." : "Sorry you can't make it."}
          </p>
          {!email.trim() && !phone.trim() && savedEditToken && (
            <div style={{ background: t.inputBg, border: `1px solid ${t.cardBorder}`, borderRadius: "12px", padding: "16px", marginBottom: "24px", textAlign: "left" }}>
              <div style={{ fontSize: "12px", fontWeight: 700, textTransform: "none", color: t.accent, marginBottom: "8px" }}>⚠️ Save your Edit Link</div>
              <p style={{ fontSize: "13px", color: t.textSecondary, margin: "0 0 12px", lineHeight: 1.5 }}>
                Since you didn&apos;t add an email or phone, copy this link to change your RSVP later:
              </p>
              <div style={{ display: "flex", gap: "8px" }}>
                <input
                  style={{ width: "100%", padding: "8px 10px", background: t.cardBg, border: `1px solid ${t.inputBorder}`, borderRadius: "10px", color: t.textPrimary, fontFamily: "inherit", fontSize: "12px", outline: "none", boxSizing: "border-box" }}
                  readOnly
                  value={`${typeof window !== "undefined" ? window.location.origin : ""}/e/${event.slug}?token=${savedEditToken}`}
                />
                <button
                  onClick={() => {
                    if (typeof navigator !== "undefined") {
                      navigator.clipboard.writeText(`${window.location.origin}/e/${event.slug}?token=${savedEditToken}`);
                      setLinkCopied(true);
                      setTimeout(() => setLinkCopied(false), 2000);
                    }
                  }}
                  style={{
                    padding: "8px 12px",
                    background: linkCopied ? "#22c55e" : t.accent,
                    border: "none", borderRadius: "10px",
                    color: "#ffffff",
                    fontFamily: "inherit", fontSize: "12px", fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap",
                    display: "flex", alignItems: "center", gap: "4px",
                    transition: "all 0.15s ease-in-out"
                  }}
                >
                  {linkCopied ? <Check size={12} /> : null}
                  {linkCopied ? "Copied!" : "Copy"}
                </button>
              </div>
            </div>
          )}
          {(status === "GOING" || status === "MAYBE") && (
            (event.polls && event.polls.length > 0) ||
            (event.potluckItems && event.potluckItems.length > 0)
          ) && (
            <div style={{ background: t.inputBg, border: `1px solid ${t.cardBorder}`, borderRadius: "12px", padding: "16px", marginBottom: "24px", textAlign: "left" }}>
              <div style={{ fontSize: "12px", fontWeight: 700, textTransform: "none", color: t.accent, marginBottom: "12px" }}>👉 Next Steps</div>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {event.polls && event.polls.length > 0 && (
                  <a
                    href={`/e/${event.slug}${savedEditToken ? `?token=${savedEditToken}` : ""}#polls`}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "10px 12px",
                      background: t.cardBg,
                      border: `1px solid ${t.inputBorder}`,
                      borderRadius: "10px",
                      color: t.textPrimary,
                      textDecoration: "none",
                      fontSize: "14px",
                      fontWeight: 600,
                    }}
                  >
                    <span>📊 Vote in the polls</span>
                    <span style={{ color: t.accent }}>→</span>
                  </a>
                )}
                {event.potluckItems && event.potluckItems.length > 0 && (
                  <a
                    href={`/e/${event.slug}${savedEditToken ? `?token=${savedEditToken}` : ""}#potluck`}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "10px 12px",
                      background: t.cardBg,
                      border: `1px solid ${t.inputBorder}`,
                      borderRadius: "10px",
                      color: t.textPrimary,
                      textDecoration: "none",
                      fontSize: "14px",
                      fontWeight: 600,
                    }}
                  >
                    <span>🥗 Bring something (Potluck)</span>
                    <span style={{ color: t.accent }}>→</span>
                  </a>
                )}
              </div>
            </div>
          )}
          <a
            href={returnPath ?? `/e/${event.slug}${savedEditToken ? `?token=${savedEditToken}` : ""}`}
            style={{ display: "block", background: t.accent, color: t.accentFg, textDecoration: "none", borderRadius: t.btnRadius, padding: "14px", fontWeight: t.btnFontWeight as React.CSSProperties["fontWeight"], fontSize: "15px", textAlign: "center", boxShadow: t.accentShadow }}
          >
            {returnPath ? "Back to guest list" : "Back to event"}
          </a>
        </div>
      </div>
    );
  }

  // ── Shared layout wrapper ─────────────────────────────────────────────────────
  const S = {
    page: { minHeight: "100vh", background: t.pageBg, color: t.textPrimary, fontFamily: "inherit", paddingBottom: "80px", position: "relative", overflowX: "hidden" } as React.CSSProperties,
    header: { padding: "16px 20px 0", maxWidth: "540px", margin: "0 auto", position: "relative", zIndex: 1 } as React.CSSProperties,
    body: { maxWidth: "540px", margin: "0 auto", padding: "24px 20px 0", position: "relative", zIndex: 1 } as React.CSSProperties,
    footer: { position: "fixed", bottom: 0, left: 0, right: 0, background: t.pageBg, borderTop: `1px solid ${t.cardBorder}`, padding: "14px 20px", display: "flex", gap: "10px", justifyContent: "flex-end", zIndex: 50 } as React.CSSProperties,
    inp: { width: "100%", padding: "13px 16px", background: t.inputBg, border: `1px solid ${t.inputBorder}`, borderRadius: "12px", color: t.textPrimary, fontFamily: "inherit", fontSize: "15px", outline: "none", boxSizing: "border-box", colorScheme: t.textPrimary === "#ffffff" ? "dark" : "light" } as React.CSSProperties,
    label: { display: "block", fontSize: "12px", fontWeight: 700, textTransform: "none" as const, letterSpacing: "0.02em", color: t.textMuted, marginBottom: "8px" },
    group: { marginBottom: "20px" } as React.CSSProperties,
    cancelBtn: { padding: "12px 22px", background: "transparent", border: `1px solid ${t.cardBorder}`, borderRadius: t.btnRadius, color: t.textMuted, fontFamily: "inherit", fontSize: "14px", fontWeight: 600, cursor: "pointer" } as React.CSSProperties,
    primaryBtn: { padding: "12px 28px", background: t.accent, border: "none", borderRadius: t.btnRadius, color: t.accentFg, fontFamily: "inherit", fontSize: "14px", fontWeight: t.btnFontWeight as React.CSSProperties["fontWeight"], cursor: "pointer", boxShadow: t.accentShadow } as React.CSSProperties,
  };

  // ── Step 1: Details ─────────────────────────────────────────────────────────
  if (step === 1) {
    return (
      <div style={S.page}>
        {renderDecorations()}
        <div style={S.header}>
          <a href={`/e/${event.slug}${savedEditToken ? `?token=${savedEditToken}` : ""}`} style={{ color: t.textMuted, fontSize: "13px", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "4px", padding: "12px 0" }}>
            ← Back
          </a>
          <div style={{ marginBottom: "20px" }}>
            <div style={{ fontSize: "12px", fontWeight: 700, textTransform: "none", letterSpacing: "0.02em", color: t.accent, marginBottom: "4px" }}>
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
                <input style={S.inp} placeholder="Your name (required)" value={name} onChange={(e) => setName(e.target.value)} />
              )}
              {!isEdit && (
                <>
                  <input style={S.inp} type="email" placeholder="Email (optional — for updates)" value={email} onChange={(e) => setEmail(e.target.value)} />
                  <input style={S.inp} type="tel" placeholder="Phone (optional — for SMS updates)" value={phone} onChange={(e) => setPhone(e.target.value)} />
                </>
              )}
            </div>
          </div>

          {/* Attendee Count dropdown — only for GOING */}
          {event.plusOneAllowed && event.plusOneMax > 0 && status === "GOING" && (
            <div style={S.group}>
              <div style={S.label}>Attendee Count</div>
              <select
                style={{ ...S.inp, cursor: "pointer" }}
                value={plusOneNames.length + 1}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  const count = val - 1;
                  setPlusOneNames((prev) => {
                    if (prev.length === count) return prev;
                    if (prev.length < count) {
                      return [...prev, ...Array(count - prev.length).fill("")];
                    } else {
                      return prev.slice(0, count);
                    }
                  });
                }}
              >
                {Array.from({ length: event.plusOneMax + 1 }, (_, i) => (
                  <option key={i + 1} value={i + 1}>
                    {i + 1} {i + 1 === 1 ? "(Just me)" : `(${i + 1} total — me + ${i} guest${i > 1 ? "s" : ""})`}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Plus One Names Inputs */}
          {event.plusOneAllowed && event.plusOneMax > 0 && status === "GOING" && plusOneNames.length > 0 && (
            <div style={S.group}>
              <div style={S.label}>
                Plus One Names {event.plusOneNamesRequired ? (
                  <span style={{ color: "#ef4444", fontSize: "11px", textTransform: "none" }}>(Required)</span>
                ) : (
                  <span style={{ color: t.textMuted, fontSize: "11px", textTransform: "none" }}>(Optional)</span>
                )}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {plusOneNames.map((n, i) => (
                  <input
                    key={i}
                    style={S.inp}
                    placeholder={`Guest ${i + 1} Name${event.plusOneNamesRequired ? " (required)" : ""}`}
                    value={n}
                    onChange={(e) => {
                      const next = [...plusOneNames];
                      next[i] = e.target.value;
                      setPlusOneNames(next);
                    }}
                  />
                ))}
              </div>
              <p style={{ fontSize: "12px", color: t.textMuted, margin: "8px 0 0" }}>Note: Plus one names will be public.</p>
            </div>
          )}

          {/* Note */}
          <div style={S.group}>
            <div style={S.label}>Message (optional — will be public)</div>
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
          <a href={`/e/${event.slug}${savedEditToken ? `?token=${savedEditToken}` : ""}`} style={{ ...S.cancelBtn, textDecoration: "none", display: "inline-flex", alignItems: "center" }}>
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

  // ── Step 2: Questionnaire ──────────────────────────────────────────────────────────
  return (
    <div style={S.page}>
      {renderDecorations()}
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
              {f.required && <span style={{ color: "#ef4444", fontSize: "12px", marginLeft: "4px", fontWeight: 400 }}>(required)</span>}
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
                {parseOptions(f.options).map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            ) : f.fieldType === "CHECKBOX" ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {parseOptions(f.options).map((opt) => (
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
