import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/session";
import { getDashboardEvents, type DashboardEvent } from "@/app/actions/event";
import { AppShell } from "@/components/ui/AppShell";
import { AppNavLogo } from "@/components/ui/AppNav";
import { APP_SHELL } from "@/lib/theme";

type EventRow = DashboardEvent;

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/auth/sign-in");

  const events = await getDashboardEvents();

  const now = new Date();
  const upcoming = events.filter((e) => e.startAt >= now);
  const past = events.filter((e) => e.startAt < now);

  return (
    <AppShell>
      <AppNavLogo
        trailing={
          <a href="/auth/sign-out" style={{ fontSize: "13px", color: APP_SHELL.textMuted, textDecoration: "none" }}>
            Sign out
          </a>
        }
      />

      <div style={{ maxWidth: "640px", margin: "0 auto", padding: "32px 16px 80px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "32px" }}>
          <h1 style={{ fontSize: "24px", fontWeight: 800 }}>Your Events</h1>
          <Link
            href="/dashboard/events/new"
            style={{ padding: "10px 20px", background: APP_SHELL.accent, color: APP_SHELL.textPrimary, borderRadius: APP_SHELL.btnRadius, textDecoration: "none", fontSize: "14px", fontWeight: 700 }}
          >
            + New Event
          </Link>
        </div>

        {events.length === 0 && (
          <div style={{ textAlign: "center", padding: "60px 20px" }}>
            <div style={{ fontSize: "48px", marginBottom: "16px" }}>🪴</div>
            <p style={{ color: APP_SHELL.textMuted, fontSize: "15px", marginBottom: "24px" }}>No events yet. Host your first one!</p>
            <Link
              href="/dashboard/events/new"
              style={{ display: "inline-block", padding: "12px 28px", background: APP_SHELL.accent, color: APP_SHELL.textPrimary, borderRadius: APP_SHELL.btnRadius, textDecoration: "none", fontSize: "15px", fontWeight: 700 }}
            >
              Create an event
            </Link>
          </div>
        )}

        {upcoming.length > 0 && (
          <section style={{ marginBottom: "32px" }}>
            <SectionLabel>Upcoming</SectionLabel>
            {upcoming.map((event) => <EventCard key={event.id} event={event} />)}
          </section>
        )}

        {past.length > 0 && (
          <section>
            <SectionLabel>Past</SectionLabel>
            {past.map((event) => <EventCard key={event.id} event={event} />)}
          </section>
        )}
      </div>
    </AppShell>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: APP_SHELL.textTertiary, marginBottom: "12px" }}>
      {children}
    </div>
  );
}

function EventCard({ event }: { event: EventRow }) {
  const accent = event.theme?.accentColor ?? APP_SHELL.accent;
  const date = event.startAt.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });

  return (
    <Link href={`/e/${event.slug}`} style={{ display: "block", textDecoration: "none", marginBottom: "10px" }}>
      <div style={{ background: APP_SHELL.cardBg, border: `1px solid ${APP_SHELL.cardBorder}`, borderRadius: APP_SHELL.itemRadius, padding: "16px 20px", display: "flex", alignItems: "center", gap: "16px" }}>
        <div style={{ width: "40px", height: "40px", borderRadius: "12px", background: accent, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px" }}>
          🎉
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "2px" }}>
            <span style={{ color: APP_SHELL.textPrimary, fontWeight: 700, fontSize: "15px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{event.title}</span>
            {event.isCohost && (
              <span style={{ fontSize: "10px", fontWeight: 700, background: "rgba(168,85,247,0.2)", color: "#c084fc", padding: "2px 7px", borderRadius: "99px", flexShrink: 0 }}>CO-HOST</span>
            )}
          </div>
          <div style={{ color: APP_SHELL.textMuted, fontSize: "13px" }}>{date}</div>
        </div>
        <div style={{ display: "flex", gap: "16px", flexShrink: 0, alignItems: "center" }}>
          <Stat value={event.going} label="going" accent={accent} />
          {event.maybe > 0 && <Stat value={event.maybe} label="maybe" accent={APP_SHELL.textMuted} />}
          {event.pending > 0 && <Stat value={event.pending} label="pending" accent="#f59e0b" />}
        </div>
      </div>
    </Link>
  );
}

function Stat({ value, label, accent }: { value: number; label: string; accent: string }) {
  return (
    <div style={{ textAlign: "right" }}>
      <div style={{ color: accent, fontWeight: 700, fontSize: "15px" }}>{value}</div>
      <div style={{ color: APP_SHELL.textTertiary, fontSize: "12px" }}>{label}</div>
    </div>
  );
}
