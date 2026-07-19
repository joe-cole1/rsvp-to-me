import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createEvent } from "@/app/actions/createEvent";
import LocationSelector from "@/components/event/LocationSelector";
import { APP_SHELL } from "@/lib/theme";
import { getSessionUser } from "@/lib/session-user";
import {
  AppButton,
  AppCard,
  AppInput,
  FormField,
  appInputStyle,
} from "@/components/ui/AppPrimitives";

export const metadata: Metadata = { title: "New Event" };

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <AppCard
      style={{
        padding: "20px",
        marginBottom: "14px",
      }}
    >
      <h2
        style={{
          fontSize: "14px",
          fontWeight: 700,
          color: APP_SHELL.textMuted,
          textTransform: "none",
          letterSpacing: "0.02em",
          marginBottom: "16px",
        }}
      >
        {title}
      </h2>
      {children}
    </AppCard>
  );
}

export default async function NewEventPage() {
  const sessionUser = await getSessionUser();
  if (!sessionUser || sessionUser.role === "GUEST") redirect("/auth/sign-in");

  return (
    <div style={{ maxWidth: "480px", margin: "0 auto", padding: "32px 16px 80px" }}>
      <form action={createEvent}>
        <Card title="Event Details">
          <FormField label="Event name *" style={{ marginBottom: "14px" }}>
            <AppInput name="title" required placeholder="Wine Night at Jane's" />
          </FormField>
          <FormField label="Description" style={{ marginBottom: "14px" }}>
            <textarea
              name="description"
              placeholder="Come hang out! Bring a bottle to share."
              rows={3}
              style={{ ...appInputStyle, resize: "vertical" }}
            />
          </FormField>
        </Card>

        <Card title="Date & Time">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <FormField label="Date *" style={{ marginBottom: "14px" }}>
              <AppInput name="startDate" type="date" required />
            </FormField>
            <FormField label="Time *" style={{ marginBottom: "14px" }}>
              <AppInput name="startTime" type="time" required />
            </FormField>
          </div>
          <FormField label="Timezone" style={{ marginBottom: "14px" }}>
            <select name="timezone" style={appInputStyle}>
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
          </FormField>
        </Card>

        <Card title="Location">
          <LocationSelector />
        </Card>

        <Card title="Visibility">
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {(
              [
                ["UNLISTED", "Unlisted", "Only people with the link can see this"],
                ["PUBLIC", "Public", "Anyone can find and view this event"],
                ["PRIVATE", "Private", "Invite only — host must approve each RSVP"],
              ] as const
            ).map(([val, label, desc]) => (
              <label
                key={val}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "12px",
                  padding: "12px",
                  background: APP_SHELL.cardBg,
                  border: `1px solid ${APP_SHELL.cardBorder}`,
                  borderRadius: "12px",
                  cursor: "pointer",
                }}
              >
                <input
                  type="radio"
                  name="visibility"
                  value={val}
                  defaultChecked={val === "UNLISTED"}
                  style={{ marginTop: "2px", accentColor: APP_SHELL.accent }}
                />
                <div>
                  <div style={{ fontSize: "14px", fontWeight: 600, color: APP_SHELL.textPrimary }}>
                    {label}
                  </div>
                  <div style={{ fontSize: "12px", color: APP_SHELL.textMuted, marginTop: "2px" }}>
                    {desc}
                  </div>
                </div>
              </label>
            ))}
          </div>
        </Card>

        <AppButton
          type="submit"
          style={{
            width: "100%",
            padding: "15px",
            fontSize: "16px",
          }}
        >
          Create Event →
        </AppButton>
      </form>
    </div>
  );
}
