import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { resolveTheme } from "@/lib/theme";
import { GuestListFilter } from "@/components/event/GuestListFilter";

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
        include: {
          answers: {
            include: { rsvpField: { select: { id: true, label: true } } },
          },
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

  // Fetch invitations that haven't turned into RSVPs yet (host-only data)
  const pendingInvitations = isHost
    ? await db.invitation.findMany({
        where: { eventId: event.id, rsvpId: null },
        select: { id: true, sentTo: true, channel: true, sentAt: true },
        orderBy: { sentAt: "desc" },
      })
    : [];

  const t = resolveTheme(event.theme?.baseTheme ?? "DARK", event.theme?.accentColor ?? "#a855f7");

  const going = event.rsvps.filter((r) => r.status === "GOING");
  const maybe = event.rsvps.filter((r) => r.status === "MAYBE");
  const no = event.rsvps.filter((r) => r.status === "NO");
  const totalGoing = going.reduce((s, r) => s + 1 + r.plusOneCount, 0);

  // Serialize dates before crossing server→client boundary
  const serializeRsvp = (r: typeof event.rsvps[number]) => ({
    ...r,
    createdAt: r.createdAt.toISOString(),
    answers: r.answers.map((a) => ({ label: a.rsvpField.label, value: a.value })),
  });

  return (
    <div style={{ minHeight: "100vh", background: t.pageBg, color: t.textPrimary, fontFamily: "inherit" }}>
      <div style={{ maxWidth: "600px", margin: "0 auto", padding: "32px 16px 80px" }}>
        {/* Header */}
        <div style={{ marginBottom: "28px" }}>
          <Link href={`/e/${slug}`} style={{
            color: t.textMuted, fontSize: "13px", textDecoration: "none",
            display: "inline-flex", alignItems: "center", gap: "4px", marginBottom: "16px",
          }}>
            ← Back to event
          </Link>
          <h1 style={{ fontSize: "22px", fontWeight: 800, marginBottom: "4px" }}>{event.title}</h1>
          <p style={{ color: t.textMuted, fontSize: "14px" }}>
            {event.rsvps.length}{" "}
            {event.rsvps.length === 1 ? "response" : "responses"} · {totalGoing} going
            {maybe.length > 0 ? ` · ${maybe.length} maybe` : ""}
            {no.length > 0 ? ` · ${no.length} can't make it` : ""}
          </p>
        </div>

        {event.rsvps.length === 0 && pendingInvitations.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 20px", color: t.textMuted }}>
            No RSVPs yet.
          </div>
        ) : (
          <GuestListFilter
            going={going.map(serializeRsvp)}
            maybe={maybe.map(serializeRsvp)}
            no={no.map(serializeRsvp)}
            invited={pendingInvitations.map((inv) => ({
              ...inv,
              sentAt: inv.sentAt.toISOString(),
            }))}
            isHost={isHost}
            t={t}
          />
        )}
      </div>
    </div>
  );
}
