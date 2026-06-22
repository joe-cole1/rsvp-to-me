import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { resolveTheme } from "@/lib/theme";
import { GuestListFilter } from "@/components/event/GuestListFilter";

export async function generateMetadata(props: PageProps<"/e/[slug]/guests">): Promise<Metadata> {
  const { slug } = await props.params;
  const event = await db.event.findUnique({ where: { slug }, select: { title: true } });
  if (!event) return {};
  return { title: `Guest List – ${event.title}` };
}

export default async function GuestListPage(props: PageProps<"/e/[slug]/guests">) {
  const { slug } = await props.params;

  const event = await db.event.findUnique({
    where: { slug },
    include: {
      host: { select: { id: true, name: true } },
      theme: true,
      coHosts: { select: { userId: true } },
      rsvps: {
        include: {
          answers: {
            include: { rsvpField: { select: { id: true, label: true } } },
          },
          plusOneGuests: { orderBy: { order: "asc" } },
          user: { select: { avatarUrl: true } },
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

  const t = resolveTheme(
    event.theme?.baseTheme ?? "DARK",
    event.theme?.accentColor ?? "#a855f7",
    event.theme?.secondaryColor,
    event.theme?.themePresetId
  );

  const approvedRsvps = event.rsvps.filter((r) => r.approved);
  const pendingRsvps = event.rsvps.filter((r) => !r.approved);

  const going = approvedRsvps.filter((r) => r.status === "GOING");
  const maybe = approvedRsvps.filter((r) => r.status === "MAYBE");
  const no = approvedRsvps.filter((r) => r.status === "NO");
  const totalGoing = going.reduce((s, r) => s + 1 + r.plusOneCount, 0);

  // Serialize dates before crossing server→client boundary
  const serializeRsvp = (r: typeof event.rsvps[number]) => ({
    ...r,
    createdAt: r.createdAt.toISOString(),
    answers: r.answers.map((a) => ({ label: a.rsvpField.label, value: a.value })),
    plusOneGuests: r.plusOneGuests.map((g) => g.name),
    editToken: r.editToken,
  });

  return (
    <div style={{ minHeight: "100vh", background: t.pageBg, color: t.textPrimary, fontFamily: "inherit", position: "relative", overflowX: "hidden" }}>
      {/* Background decorations */}
      {t.pageDecoration === "dark-orbs" && (
        <>
          <div style={{ position: "fixed", top: "-20%", left: "30%", width: "600px", height: "600px", borderRadius: "50%", background: t.pageDecorationBg1, filter: "blur(40px)", pointerEvents: "none", zIndex: 0 }} />
          <div style={{ position: "fixed", bottom: "10%", right: "-10%", width: "400px", height: "400px", borderRadius: "50%", background: t.pageDecorationBg2, filter: "blur(40px)", pointerEvents: "none", zIndex: 0 }} />
        </>
      )}
      {t.pageDecoration === "soft-blobs" && (
        <>
          <div style={{ position: "fixed", top: "-10%", right: "-10%", width: "500px", height: "500px", borderRadius: "50%", background: t.pageDecorationBg1, filter: "blur(60px)", pointerEvents: "none", zIndex: 0 }} />
          <div style={{ position: "fixed", bottom: "20%", left: "-5%", width: "400px", height: "400px", borderRadius: "50%", background: t.pageDecorationBg2, filter: "blur(60px)", pointerEvents: "none", zIndex: 0 }} />
        </>
      )}
      {t.pageDecoration === "bold-hero" && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: t.pageDecorationBg1, zIndex: 0 }} />
      )}

      <div style={{ maxWidth: "600px", margin: "0 auto", padding: "32px 16px 80px", position: "relative", zIndex: 1 }}>
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
            {[
              `${event.rsvps.length} ${event.rsvps.length === 1 ? "response" : "responses"}`,
              `${totalGoing} going`,
              maybe.length > 0 ? `${maybe.length} maybe` : null,
              no.length > 0 ? `${no.length} can't make it` : null,
              pendingRsvps.length > 0 ? `${pendingRsvps.length} pending approval` : null,
            ].filter(Boolean).join(" · ")}
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
            pending={isHost ? pendingRsvps.map(serializeRsvp) : []}
            invited={pendingInvitations.map((inv) => ({
              ...inv,
              sentAt: inv.sentAt.toISOString(),
            }))}
            isHost={isHost}
            slug={slug}
            t={t}
          />
        )}
      </div>
    </div>
  );
}
