import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { resolveTheme } from "@/lib/theme";

export default async function GuestListPage(props: PageProps<"/e/[slug]/guests">) {
  const { slug } = await props.params;

  const event = await db.event.findUnique({
    where: { slug },
    include: {
      host: { select: { id: true, name: true } },
      theme: true,
      coHosts: { select: { userId: true } },
      rsvps: {
        where: { approved: true },
        select: {
          id: true,
          guestName: true,
          guestEmail: true,
          guestPhone: true,
          status: true,
          plusOneCount: true,
          note: true,
          createdAt: true,
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!event || event.status === "CANCELLED") notFound();

  const session = await getSession();
  const isHostOwner = session?.userId === event.hostId;
  const isCohost = event.coHosts.some((ch) => ch.userId === session?.userId);
  const isHost = isHostOwner || isCohost;

  if (event.guestListVis === "HOST_ONLY" && !isHost) redirect(`/e/${slug}`);

  const theme = resolveTheme(event.theme?.baseTheme ?? "DARK", event.theme?.accentColor ?? "#a855f7");
  const t = theme;

  const going = event.rsvps.filter((r) => r.status === "GOING");
  const maybe = event.rsvps.filter((r) => r.status === "MAYBE");
  const no = event.rsvps.filter((r) => r.status === "NO");
  const totalGoing = going.reduce((s, r) => s + 1 + r.plusOneCount, 0);

  const statusLabel = (s: string) => s === "GOING" ? "Going" : s === "MAYBE" ? "Maybe" : "Can't make it";
  const statusColor = (s: string, accent: string) =>
    s === "GOING" ? accent : s === "MAYBE" ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.25)";

  return (
    <div style={{ minHeight: "100vh", background: t.pageBg, color: t.textPrimary, fontFamily: "inherit" }}>
      <div style={{ maxWidth: "600px", margin: "0 auto", padding: "32px 16px 80px" }}>
        {/* Header */}
        <div style={{ marginBottom: "32px" }}>
          <Link href={`/e/${slug}`} style={{ color: t.textMuted, fontSize: "13px", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "4px", marginBottom: "16px" }}>
            ← Back to event
          </Link>
          <h1 style={{ fontSize: "22px", fontWeight: 800, marginBottom: "4px" }}>{event.title}</h1>
          <p style={{ color: t.textMuted, fontSize: "14px" }}>
            {event.rsvps.length} {event.rsvps.length === 1 ? "response" : "responses"} · {totalGoing} going{maybe.length > 0 ? ` · ${maybe.length} maybe` : ""}{no.length > 0 ? ` · ${no.length} can't make it` : ""}
          </p>
        </div>

        {event.rsvps.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 20px", color: t.textMuted }}>
            No RSVPs yet.
          </div>
        ) : (
          <>
            {[...going, ...maybe, ...no].map((r) => (
              <div
                key={r.id}
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: "14px",
                  padding: "14px 18px",
                  marginBottom: "8px",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "14px",
                }}
              >
                <div style={{
                  width: "38px", height: "38px", borderRadius: "50%", background: t.accent,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontWeight: 800, fontSize: "15px", flexShrink: 0, color: t.accentFg,
                  opacity: r.status === "NO" ? 0.4 : r.status === "MAYBE" ? 0.7 : 1,
                }}>
                  {r.guestName[0].toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" as const }}>
                    <span style={{ fontWeight: 700, fontSize: "15px" }}>{r.guestName}</span>
                    {r.plusOneCount > 0 && (
                      <span style={{ fontSize: "12px", color: t.textMuted }}>+{r.plusOneCount}</span>
                    )}
                    <span style={{
                      fontSize: "11px", fontWeight: 700, padding: "2px 8px", borderRadius: "99px",
                      background: "rgba(255,255,255,0.08)", color: statusColor(r.status, t.accent),
                    }}>
                      {statusLabel(r.status)}
                    </span>
                  </div>
                  {r.note && (
                    <p style={{ color: t.textMuted, fontSize: "13px", margin: "4px 0 0", lineHeight: 1.5 }}>{r.note}</p>
                  )}
                  {isHost && (r.guestEmail || r.guestPhone) && (
                    <div style={{ marginTop: "4px", display: "flex", gap: "12px", flexWrap: "wrap" as const }}>
                      {r.guestEmail && <span style={{ color: t.textMuted, fontSize: "12px" }}>{r.guestEmail}</span>}
                      {r.guestPhone && <span style={{ color: t.textMuted, fontSize: "12px" }}>{r.guestPhone}</span>}
                    </div>
                  )}
                  <div style={{ color: t.textMuted, fontSize: "11px", marginTop: "4px" }}>
                    {new Date(r.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                  </div>
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
