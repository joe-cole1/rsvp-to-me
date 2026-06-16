import { redirect } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/auth/sign-in");

  const events = await db.event.findMany({
    where: { hostId: session.userId },
    orderBy: { startAt: "desc" },
    include: {
      _count: { select: { rsvps: true } },
      theme: true,
    },
  });

  const now = new Date();
  const upcoming = events.filter((e) => e.startAt >= now);
  const past = events.filter((e) => e.startAt < now);

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg, #0a0a0f 0%, #13091f 40%, #0d1117 100%)", color: "#fff", fontFamily: "inherit" }}>
      {/* Header */}
      <div style={{ borderBottom: "1px solid rgba(255,255,255,0.08)", padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ fontSize: "22px" }}>🎉</span>
          <span style={{ fontSize: "17px", fontWeight: 800 }}>rsvp.to</span>
        </div>
        <a href="/auth/sign-out" style={{ fontSize: "13px", color: "rgba(255,255,255,0.4)", textDecoration: "none" }}>Sign out</a>
      </div>

      <div style={{ maxWidth: "640px", margin: "0 auto", padding: "32px 16px 80px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "32px" }}>
          <h1 style={{ fontSize: "24px", fontWeight: 800 }}>Your Events</h1>
          <Link
            href="/dashboard/events/new"
            style={{ padding: "10px 20px", background: "#a855f7", color: "#fff", borderRadius: "12px", textDecoration: "none", fontSize: "14px", fontWeight: 700 }}
          >
            + New Event
          </Link>
        </div>

        {events.length === 0 && (
          <div style={{ textAlign: "center", padding: "60px 20px" }}>
            <div style={{ fontSize: "48px", marginBottom: "16px" }}>🪴</div>
            <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "15px", marginBottom: "24px" }}>No events yet. Host your first one!</p>
            <Link href="/dashboard/events/new" style={{ display: "inline-block", padding: "12px 28px", background: "#a855f7", color: "#fff", borderRadius: "12px", textDecoration: "none", fontSize: "15px", fontWeight: 700 }}>
              Create an event
            </Link>
          </div>
        )}

        {upcoming.length > 0 && (
          <section style={{ marginBottom: "32px" }}>
            <SectionLabel>Upcoming</SectionLabel>
            {upcoming.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </section>
        )}

        {past.length > 0 && (
          <section>
            <SectionLabel>Past</SectionLabel>
            {past.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </section>
        )}
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.3)", marginBottom: "12px" }}>
      {children}
    </div>
  );
}

function EventCard({ event }: { event: { id: string; slug: string; title: string; startAt: Date; status: string; _count: { rsvps: number }; theme: { accentColor: string } | null } }) {
  const accent = event.theme?.accentColor ?? "#a855f7";
  const date = event.startAt.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });

  return (
    <Link href={`/e/${event.slug}`} style={{ display: "block", textDecoration: "none", marginBottom: "10px" }}>
      <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "16px", padding: "16px 20px", display: "flex", alignItems: "center", gap: "16px", transition: "border-color 0.15s" }}>
        <div style={{ width: "40px", height: "40px", borderRadius: "12px", background: accent, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px" }}>
          🎉
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: "#fff", fontWeight: 700, fontSize: "15px", marginBottom: "2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{event.title}</div>
          <div style={{ color: "rgba(255,255,255,0.4)", fontSize: "13px" }}>{date}</div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ color: accent, fontWeight: 700, fontSize: "15px" }}>{event._count.rsvps}</div>
          <div style={{ color: "rgba(255,255,255,0.3)", fontSize: "12px" }}>RSVPs</div>
        </div>
      </div>
    </Link>
  );
}
