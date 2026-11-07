import { getRequestTranslator } from "@/i18n/server";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createEvent } from "@/app/actions/createEvent";
import LocationSelector from "@/components/event/LocationSelector";
import { APP_SHELL, APP_SHELL_THEME as T } from "@/lib/theme";
import { getSessionUser } from "@/lib/session-user";
import { AppCard } from "@/components/ui/AppPrimitives";
import { Button } from "@/components/ui/Button";
import { Check, Field, Input, Select, Textarea } from "@/components/ui/Field";
import { CaptchaForm } from "@/components/ui/CaptchaForm";

export async function generateMetadata(): Promise<Metadata> {
  const tr = await getRequestTranslator();
  return { title: tr("Ui.Dashboard.newEventMetadataTitle") };
}

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
  const tr = await getRequestTranslator();

  const sessionUser = await getSessionUser();
  if (!sessionUser || sessionUser.role === "GUEST") redirect("/auth/sign-in");

  return (
    <div style={{ maxWidth: "480px", margin: "0 auto", padding: "32px 16px 80px" }}>
      <CaptchaForm action={createEvent} captchaAction="event_create">
        <Card title={tr("Ui.Dashboard.eventDetails")}>
          <Field theme={T} label={tr("Ui.Dashboard.eventName")} style={{ marginBottom: "14px" }}>
            <Input
              theme={T}
              name="title"
              required
              placeholder={tr("Ui.Dashboard.wineNightAtJaneS")}
            />
          </Field>
          <Field theme={T} label={tr("Ui.Dashboard.description")} style={{ marginBottom: "14px" }}>
            <Textarea
              theme={T}
              name="description"
              placeholder={tr("Ui.Dashboard.comeHangOutBringABottleToShare")}
              rows={3}
            />
          </Field>
        </Card>

        <Card title={tr("Ui.Dashboard.dateTime")}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <Field theme={T} label={tr("Ui.Dashboard.date")} style={{ marginBottom: "14px" }}>
              <Input theme={T} name="startDate" type="date" required />
            </Field>
            <Field theme={T} label={tr("Ui.Dashboard.time")} style={{ marginBottom: "14px" }}>
              <Input theme={T} name="startTime" type="time" required />
            </Field>
          </div>
          <Field theme={T} label={tr("Ui.Dashboard.timezone")} style={{ marginBottom: "14px" }}>
            <Select theme={T} name="timezone">
              <option value="America/New_York">{tr("Ui.Dashboard.easternEt")}</option>
              <option value="America/Chicago">{tr("Ui.Dashboard.centralCt")}</option>
              <option value="America/Denver">{tr("Ui.Dashboard.mountainMt")}</option>
              <option value="America/Los_Angeles">{tr("Ui.Dashboard.pacificPt")}</option>
              <option value="America/Anchorage">{tr("Ui.Dashboard.alaskaAkt")}</option>
              <option value="Pacific/Honolulu">{tr("Ui.Dashboard.hawaiiHst")}</option>
              <option value="Europe/London">{tr("Ui.Dashboard.londonGmtBst")}</option>
              <option value="Europe/Paris">{tr("Ui.Dashboard.parisCet")}</option>
              <option value="Asia/Tokyo">{tr("Ui.Dashboard.tokyoJst")}</option>
              <option value="Australia/Sydney">{tr("Ui.Dashboard.sydneyAest")}</option>
            </Select>
          </Field>
        </Card>

        <Card title={tr("Ui.Dashboard.location")}>
          <LocationSelector />
        </Card>

        <Card title={tr("Ui.Dashboard.visibility")}>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {(
              [
                ["UNLISTED", tr("Ui.Dashboard.unlisted"), tr("Ui.Dashboard.unlistedDescription")],
                ["PUBLIC", tr("Ui.Dashboard.public"), tr("Ui.Dashboard.publicDescription")],
                ["PRIVATE", tr("Ui.Dashboard.private"), tr("Ui.Dashboard.privateDescription")],
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
                <Check
                  theme={T}
                  type="radio"
                  name="visibility"
                  value={val}
                  defaultChecked={val === "UNLISTED"}
                  style={{ marginTop: "2px" }}
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

        <Button theme={T} variant="primary" type="submit" fullWidth>
          {tr("Ui.Dashboard.createEvent")}
        </Button>
      </CaptchaForm>
    </div>
  );
}
