import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { resolveEventAccess } from "@/lib/eventAccess";
import { serializeGuestRsvp, canViewGuestListPage } from "@/lib/guestList";
import { resolveTheme } from "@/lib/theme";
import { GuestListFilter } from "@/components/event/GuestListFilter";
import { AppTopNav } from "@/components/ui/AppNav";
import { EventAtmosphere } from "@/components/event/EventAtmosphere";
import { getChannelConfig } from "@/lib/config";
import { resolveEffectConfig } from "@/lib/effects";

export default async function GuestListPage(props: PageProps<"/e/[slug]/guests">) {
  const { slug } = await props.params;
  const token =
    typeof (await props.searchParams).token === "string"
      ? ((await props.searchParams).token as string)
      : undefined;

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
          checkIn: { select: { checkedInAt: true, checkedInBy: true } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!event || event.status === "CANCELLED" || event.status === "DELETED") notFound();

  // Enforce the same visibility/password gate as the event page — a PRIVATE or
  // password-protected event must not expose its guest list to anonymous visitors.
  const { sessionUser, isHost, isLoggedInGuest, hasValidToken, decision } =
    await resolveEventAccess(event, slug, { token });
  if (decision !== "granted") redirect(`/e/${slug}`);

  // SEC-33: layer the guest-list-visibility setting on top of the access gate.
  // HOST_ONLY → hosts only; GUESTS_ONLY → hosts + the event's own guests, never
  // anonymous visitors (who can still be "granted" on a PUBLIC event).
  if (!canViewGuestListPage(event.guestListVis, { isHost, isLoggedInGuest, hasValidToken })) {
    redirect(`/e/${slug}`);
  }

  // Fetch invitations that haven't turned into RSVPs yet (host-only data)
  const pendingInvitations = isHost
    ? await db.invitation.findMany({
        where: { eventId: event.id, rsvpId: null },
        select: { id: true, sentTo: true, channel: true, sentAt: true },
        orderBy: { sentAt: "desc" },
      })
    : [];
  const channelConfig = isHost ? await getChannelConfig() : { email: false, sms: false };

  const t = resolveTheme(
    event.theme?.baseTheme ?? "DARK",
    event.theme?.gradientFrom ?? "#7c3aed",
    event.theme?.gradientTo ?? "#1e40af",
    event.theme?.accentColor ?? "#a855f7",
    event.theme?.cardOpacity,
    event.theme?.fontId
  );
  const effect = resolveEffectConfig(event.theme);

  const approvedRsvps = event.rsvps.filter((r) => r.approved && r.status !== "INVITED");
  const pendingRsvps = event.rsvps.filter((r) => !r.approved && r.status !== "INVITED");
  // Guests with INVITED status haven't responded yet; shown in host-only Invited tab
  const invitedRsvps = event.rsvps.filter((r) => r.status === "INVITED");

  const going = approvedRsvps.filter((r) => r.status === "GOING");
  const maybe = approvedRsvps.filter((r) => r.status === "MAYBE");
  const no = approvedRsvps.filter((r) => r.status === "NO");
  const totalGoing = going.reduce((s, r) => s + 1 + r.plusOneCount, 0);

  // Serialize for the client boundary, stripping host-only data (editToken,
  // email, phone, answers) for non-hosts — see lib/guestList.ts for why.
  const serializeRsvp = (r: (typeof event.rsvps)[number]) => serializeGuestRsvp(r, isHost);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: t.pageBg,
        color: t.textPrimary,
        fontFamily: "inherit",
        position: "relative",
        overflowX: "hidden",
      }}
    >
      <AppTopNav user={sessionUser} variant="fixed" />
      <EventAtmosphere theme={t} effect={effect} />

      <div
        style={{
          maxWidth: "600px",
          margin: "0 auto",
          padding: "85px 16px 80px",
          position: "relative",
          zIndex: 1,
        }}
      >
        {/* Header */}
        <div style={{ marginBottom: "28px" }}>
          <Link
            href={`/e/${slug}`}
            style={{
              color: t.textMuted,
              fontSize: "13px",
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
              marginBottom: "16px",
            }}
          >
            ← Back to event
          </Link>
          <h1 style={{ fontSize: "22px", fontWeight: 800, marginBottom: "4px" }}>{event.title}</h1>
          <p style={{ color: t.textMuted, fontSize: "14px" }}>
            {[
              `${approvedRsvps.length + pendingRsvps.length} ${approvedRsvps.length + pendingRsvps.length === 1 ? "response" : "responses"}`,
              `${totalGoing} going`,
              maybe.length > 0 ? `${maybe.length} maybe` : null,
              no.length > 0 ? `${no.length} can't make it` : null,
              pendingRsvps.length > 0 ? `${pendingRsvps.length} pending approval` : null,
            ]
              .filter(Boolean)
              .join(" · ")}
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
            invited={
              // Host-only tab: contains invitee contact info + editTokens, so
              // only serialize it for hosts (never ship it in a guest payload).
              isHost
                ? [
                    // RSVPs with INVITED status (host pre-invited, awaiting response)
                    ...invitedRsvps.map((r) => ({
                      id: r.id,
                      rsvpId: r.id,
                      sentTo: r.guestEmail || r.guestPhone || r.guestName,
                      channel: (r.guestEmail ? "EMAIL" : "SMS") as "EMAIL" | "SMS",
                      sentAt: r.createdAt.toISOString(),
                      guestName: r.guestName,
                      editToken: r.editToken,
                      plusOneCount: r.plusOneCount,
                      checkIn: r.checkIn
                        ? {
                            checkedInAt: r.checkIn.checkedInAt.toISOString(),
                            checkedInBy: r.checkIn.checkedInBy,
                          }
                        : null,
                    })),
                    // Invitation records with no linked RSVP (blast tracking)
                    ...pendingInvitations.map((inv) => ({
                      ...inv,
                      sentAt: inv.sentAt.toISOString(),
                      guestName: undefined,
                    })),
                  ]
                : []
            }
            isHost={isHost}
            eventId={event.id}
            slug={slug}
            timezone={event.timezone}
            channelConfig={channelConfig}
            t={t}
          />
        )}
      </div>
    </div>
  );
}
