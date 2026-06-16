import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { createEvent } from "@/app/actions/createEvent";

export default async function NewEventPage() {
  const session = await getSession();
  if (!session) redirect("/auth/sign-in");

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg, #0a0a0f 0%, #13091f 40%, #0d1117 100%)", color: "#fff", fontFamily: "inherit" }}>
      {/* Header */}
      <div style={{ borderBottom: "1px solid rgba(255,255,255,0.08)", padding: "16px 20px", display: "flex", alignItems: "center", gap: "12px" }}>
        <a href="/dashboard" style={{ color: "rgba(255,255,255,0.5)", textDecoration: "none", fontSize: "22px" }}>←</a>
        <h1 style={{ fontSize: "17px", fontWeight: 700 }}>New Event</h1>
      </div>

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
            <Field label="Type">
              <div style={{ display: "flex", gap: "8px" }}>
                {(["PHYSICAL", "VIRTUAL", "TBD"] as const).map((t) => (
                  <label key={t} style={{ flex: 1, cursor: "pointer" }}>
                    <input type="radio" name="locationType" value={t} defaultChecked={t === "PHYSICAL"} style={{ display: "none" }} />
                    <div style={{ padding: "8px", textAlign: "center", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "10px", fontSize: "13px", color: "rgba(255,255,255,0.7)" }}>
                      {t === "PHYSICAL" ? "📍 In person" : t === "VIRTUAL" ? "💻 Virtual" : "📌 TBD"}
                    </div>
                  </label>
                ))}
              </div>
            </Field>
            <Field label="Venue name">
              <input name="locationName" placeholder="Casa de Jane" style={inputStyle} />
            </Field>
            <Field label="Address">
              <input name="locationAddress" placeholder="123 Main St, Brooklyn, NY" style={inputStyle} />
            </Field>
            <Field label="Virtual link">
              <input name="virtualUrl" type="url" placeholder="https://zoom.us/j/..." style={inputStyle} />
            </Field>
          </Card>

          <Card title="Visibility">
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {([
                ["UNLISTED", "Unlisted", "Only people with the link can see this"],
                ["PUBLIC", "Public", "Anyone can find and view this event"],
                ["PRIVATE", "Private", "Invite only — host must approve each RSVP"],
              ] as const).map(([val, label, desc]) => (
                <label key={val} style={{ display: "flex", alignItems: "flex-start", gap: "12px", padding: "12px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "12px", cursor: "pointer" }}>
                  <input type="radio" name="visibility" value={val} defaultChecked={val === "UNLISTED"} style={{ marginTop: "2px", accentColor: "#a855f7" }} />
                  <div>
                    <div style={{ fontSize: "14px", fontWeight: 600, color: "#fff" }}>{label}</div>
                    <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)", marginTop: "2px" }}>{desc}</div>
                  </div>
                </label>
              ))}
            </div>
          </Card>

          <button
            type="submit"
            style={{ width: "100%", padding: "15px", background: "#a855f7", color: "#fff", border: "none", borderRadius: "14px", fontSize: "16px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}
          >
            Create Event →
          </button>
        </form>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 14px",
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: "10px",
  color: "#fff",
  fontSize: "14px",
  outline: "none",
  boxSizing: "border-box",
  fontFamily: "inherit",
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: "14px" }}>
      <label style={{ display: "block", fontSize: "12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "rgba(255,255,255,0.4)", marginBottom: "6px" }}>
        {label}
      </label>
      {children}
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "20px", padding: "20px", marginBottom: "14px" }}>
      <h2 style={{ fontSize: "14px", fontWeight: 700, color: "rgba(255,255,255,0.6)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "16px" }}>{title}</h2>
      {children}
    </div>
  );
}
