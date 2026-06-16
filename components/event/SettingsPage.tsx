"use client";

import { useState, useTransition } from "react";
import { ArrowLeft, Check } from "lucide-react";
import { ACCENT_PRESETS, BASE_THEMES, type BaseTheme } from "@/lib/theme";
import { saveEventSettings, saveEventTheme, saveReminderSettings } from "@/app/actions/event";

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
  theme: { baseTheme: "DARK" | "SOFT" | "BOLD"; accentColor: string; coverImageUrl: string | null } | null;
  reminderSettings: {
    emailWeekBefore: boolean; emailDayBefore: boolean; emailHoursBefore: number;
    smsWeekBefore: boolean; smsDayBefore: boolean; smsHoursBefore: number;
    nudgeUnresponded: boolean; postEventPrompt: boolean;
  } | null;
};

export function SettingsPage({ event }: { event: EventInput }) {
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState<string | null>(null);

  // Theme state
  const [base, setBase] = useState<BaseTheme>(event.theme?.baseTheme ?? "DARK");
  const [accent, setAccent] = useState(event.theme?.accentColor ?? "#a855f7");

  // RSVP state
  const [commentsEnabled, setCommentsEnabled] = useState(event.commentsEnabled);
  const [plusOneAllowed, setPlusOneAllowed] = useState(event.plusOneAllowed);
  const [plusOneMax, setPlusOneMax] = useState(event.plusOneMax);
  const [approvalRequired, setApprovalRequired] = useState(event.approvalRequired);
  const [capacity, setCapacity] = useState(event.capacity?.toString() ?? "");
  const [guestListVis, setGuestListVis] = useState(event.guestListVis);
  const [visibility, setVisibility] = useState(event.visibility);

  // Reminder state
  const rs = event.reminderSettings;
  const [emailWeekBefore, setEmailWeekBefore] = useState(rs?.emailWeekBefore ?? false);
  const [emailDayBefore, setEmailDayBefore] = useState(rs?.emailDayBefore ?? true);
  const [emailHoursBefore, setEmailHoursBefore] = useState(rs?.emailHoursBefore ?? 2);
  const [smsWeekBefore, setSmsWeekBefore] = useState(rs?.smsWeekBefore ?? false);
  const [smsDayBefore, setSmsDayBefore] = useState(rs?.smsDayBefore ?? false);
  const [smsHoursBefore, setSmsHoursBefore] = useState(rs?.smsHoursBefore ?? 0);
  const [nudgeUnresponded, setNudgeUnresponded] = useState(rs?.nudgeUnresponded ?? true);
  const [postEventPrompt, setPostEventPrompt] = useState(rs?.postEventPrompt ?? false);

  const flash = (section: string) => {
    setSaved(section);
    setTimeout(() => setSaved(null), 2000);
  };

  const saveTheme = () => startTransition(async () => {
    await saveEventTheme(event.id, base, accent);
    flash("theme");
  });

  const saveRsvp = () => startTransition(async () => {
    await saveEventSettings(event.id, {
      commentsEnabled, plusOneAllowed, plusOneMax,
      approvalRequired, capacity: capacity ? Number(capacity) : null,
      guestListVis, visibility,
    });
    flash("rsvp");
  });

  const saveReminders = () => startTransition(async () => {
    await saveReminderSettings(event.id, {
      emailWeekBefore, emailDayBefore, emailHoursBefore,
      smsWeekBefore, smsDayBefore, smsHoursBefore,
      nudgeUnresponded, postEventPrompt,
    });
    flash("reminders");
  });

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0f", color: "#fff", fontFamily: "inherit" }}>
      {/* Header */}
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
                <button
                  key={bt.id}
                  onClick={() => setBase(bt.id)}
                  style={{ flex: 1, padding: 0, border: `2px solid ${base === bt.id ? "#fff" : "rgba(255,255,255,0.1)"}`, borderRadius: "16px", cursor: "pointer", overflow: "hidden", background: "none", transition: "border-color 0.15s" }}
                >
                  <div style={{ height: "44px", background: bt.preview }} />
                  <div style={{ padding: "6px 4px", color: "#fff", fontSize: "10px", fontWeight: 600, background: "rgba(255,255,255,0.05)" }}>{bt.label}</div>
                </button>
              ))}
            </div>
          </div>

          <Label>Accent Color</Label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "8px" }}>
            {ACCENT_PRESETS.map((p) => (
              <button
                key={p.value}
                onClick={() => setAccent(p.value)}
                title={p.name}
                style={{ width: "32px", height: "32px", borderRadius: "50%", background: p.value, border: `3px solid ${accent === p.value ? "#fff" : "transparent"}`, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                {accent === p.value && <Check size={12} color="#fff" strokeWidth={3} />}
              </button>
            ))}
            <label style={{ width: "32px", height: "32px", borderRadius: "50%", border: `3px solid ${!ACCENT_PRESETS.some(p => p.value === accent) ? "#fff" : "transparent"}`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", background: ACCENT_PRESETS.some(p => p.value === accent) ? "rgba(255,255,255,0.1)" : accent, position: "relative", overflow: "hidden" }}>
              🎨
              <input type="color" value={accent} onChange={(e) => setAccent(e.target.value)} style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer" }} />
            </label>
          </div>
        </Section>

        {/* ── RSVP & Guest Settings ── */}
        <Section title="RSVP & Guests" onSave={saveRsvp} saved={saved === "rsvp"} isPending={isPending}>
          <Toggle label="Allow comments" value={commentsEnabled} onChange={setCommentsEnabled} />
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

          <div style={{ marginBottom: "16px" }}>
            <Label>Capacity limit (optional)</Label>
            <input
              type="number"
              placeholder="No limit"
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
              style={{ width: "100%", padding: "10px 14px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "10px", color: "#fff", fontFamily: "inherit", fontSize: "14px", outline: "none" }}
            />
          </div>

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

          <div>
            <Label>Event visibility</Label>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {([["PUBLIC", "Public — findable by anyone"], ["UNLISTED", "Unlisted — only people with the link"], ["PRIVATE", "Private — invite only, approval required"]] as const).map(([val, label]) => (
                <label key={val} style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer" }}>
                  <input type="radio" checked={visibility === val} onChange={() => setVisibility(val)} style={{ accentColor: "#a855f7" }} />
                  <span style={{ fontSize: "14px", color: "rgba(255,255,255,0.8)" }}>{label}</span>
                </label>
              ))}
            </div>
          </div>
        </Section>

        {/* ── Reminders ── */}
        <Section title="Reminders" onSave={saveReminders} saved={saved === "reminders"} isPending={isPending}>
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

      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function Label({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: "12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "rgba(255,255,255,0.4)", marginBottom: "10px" }}>{children}</div>;
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
      <span style={{ fontSize: "14px", color: "rgba(255,255,255,0.8)" }}>{label}</span>
      <button
        onClick={() => onChange(!value)}
        style={{ width: "44px", height: "24px", borderRadius: "100px", border: "none", cursor: "pointer", background: value ? "#a855f7" : "rgba(255,255,255,0.15)", position: "relative", transition: "background 0.2s" }}
      >
        <span style={{ position: "absolute", top: "3px", left: value ? "23px" : "3px", width: "18px", height: "18px", borderRadius: "50%", background: "#fff", transition: "left 0.2s" }} />
      </button>
    </div>
  );
}

function Section({ title, children, onSave, saved, isPending }: { title: string; children: React.ReactNode; onSave: () => void; saved: boolean; isPending: boolean }) {
  return (
    <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "20px", padding: "20px", marginBottom: "16px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
        <h2 style={{ fontSize: "15px", fontWeight: 700 }}>{title}</h2>
        <button
          onClick={onSave}
          disabled={isPending}
          style={{ padding: "6px 16px", background: saved ? "#22c55e" : "#a855f7", color: "#fff", border: "none", borderRadius: "8px", cursor: "pointer", fontSize: "13px", fontWeight: 700, fontFamily: "inherit", display: "flex", alignItems: "center", gap: "4px", transition: "background 0.2s" }}
        >
          {saved ? <><Check size={13} /> Saved</> : isPending ? "Saving…" : "Save"}
        </button>
      </div>
      {children}
    </div>
  );
}
