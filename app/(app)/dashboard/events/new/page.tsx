import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createEvent } from "@/app/actions/createEvent";
import LocationSelector from "@/components/event/LocationSelector";
import { APP_SHELL } from "@/lib/theme";
import { getSessionUser } from "@/lib/session-user";

export const metadata: Metadata = { title: "New Event" };

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 14px",
  background: APP_SHELL.inputBg,
  border: `1px solid ${APP_SHELL.inputBorder}`,
  borderRadius: APP_SHELL.inputRadius,
  color: APP_SHELL.textPrimary,
  fontSize: "14px",
  outline: "none",
  boxSizing: "border-box",
  fontFamily: "inherit",
  colorScheme: "dark",
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: "14px" }}>
      <label style={{ display: "block", fontSize: "12px", fontWeight: 700, textTransform: "none", letterSpacing: "0.02em", color: APP_SHELL.textMuted, marginBottom: "6px" }}>
        {label}
      </label>
      {children}
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: APP_SHELL.cardBg, border: `1px solid ${APP_SHELL.cardBorder}`, borderRadius: APP_SHELL.cardRadius, padding: "20px", marginBottom: "14px" }}>
      <h2 style={{ fontSize: "14px", fontWeight: 700, color: APP_SHELL.textMuted, textTransform: "none", letterSpacing: "0.02em", marginBottom: "16px" }}>{title}</h2>
      {children}
    </div>
  );
}

export default async function NewEventPage() {
  const sessionUser = await getSessionUser();
  if (!sessionUser || sessionUser.role === "GUEST") redirect("/auth/sign-in");

  return (
    <div style={{ maxWidth: "480px", margin: "0 auto", padding: "32px 16px 80px" }}>
      <form action={createEvent}>
        <Card title="Event Details">
          <Field label="Event name *">
            <input name="title" required placeholder="Wine Night at Jane's" style={inputStyle} />
          </Field>
          <Field label="Description">
            <textarea name="description" placeholder="Come hang out! Bring a bottle to share." rows={3} style={{ ...inputStyle, resize: "vertical" }} />
          </Field>
        </Card>

        <Card title="Date & Time">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <Field label="Date *">
              <input name="startDate" type="date" required style={inputStyle} />
            </Field>
            <Field label="Time *">
              <input name="startTime" type="time" required style={inputStyle} />
            </Field>
          </div>
          <Field label="Timezone">
            <select name="timezone" style={inputStyle}>
              <option value="America/New_York">Eastern (ET)</option>
              <option value="America/Chicago">Central (CT)</option>
              <option value="America/Denver">Mountain (MT)</option>
              <option value="America/Los_Angeles">Pacific (PT)</option>
              <option value="America/Anchorage">Alaska (AKT)</option>
              <option value="Pacific/Honolulu">Hawaii (HST)</option>
              <option value="Europe/London">London (GMT/BST)</option>
              <option value="Europe/Paris">Paris (CET)</option>
              <option value="Asia/Tokyo">Tokyo (JST)</option>
              <option value="Australia/Sydney">Sydney (AEST)</option>
            </select>
          </Field>
        </Card>

        <Card title="Location">
          <LocationSelector />
        </Card>

        <Card title="Visibility">
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {([
              ["UNLISTED", "Unlisted", "Only people with the link can see this"],
              ["PUBLIC", "Public", "Anyone can find and view this event"],
              ["PRIVATE", "Private", "Invite only — host must approve each RSVP"],
            ] as const).map(([val, label, desc]) => (
              <label key={val} style={{ display: "flex", alignItems: "flex-start", gap: "12px", padding: "12px", background: APP_SHELL.cardBg, border: `1px solid ${APP_SHELL.cardBorder}`, borderRadius: "12px", cursor: "pointer" }}>
                <input type="radio" name="visibility" value={val} defaultChecked={val === "UNLISTED"} style={{ marginTop: "2px", accentColor: APP_SHELL.accent }} />
                <div>
                  <div style={{ fontSize: "14px", fontWeight: 600, color: APP_SHELL.textPrimary }}>{label}</div>
                  <div style={{ fontSize: "12px", color: APP_SHELL.textMuted, marginTop: "2px" }}>{desc}</div>
                </div>
              </label>
            ))}
          </div>
        </Card>

        <button
          type="submit"
          style={{ width: "100%", padding: "15px", background: APP_SHELL.accent, color: APP_SHELL.textPrimary, border: "none", borderRadius: APP_SHELL.btnRadius, fontSize: "16px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}
        >
          Create Event →
        </button>
      </form>
    </div>
  );
}
