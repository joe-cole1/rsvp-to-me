import { getRequestTranslator } from "@/i18n/server";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { buttonProps } from "@/components/ui/Button";
import { db } from "@/lib/db";
import { resolveEventAccess } from "@/lib/eventAccess";
import { serializeGuestRsvp, canViewGuestListPage, invitedGuestsForViewer } from "@/lib/guestList";
import { resolveTheme } from "@/lib/theme";
import { GuestListFilter } from "@/components/event/GuestListFilter";
import { EventAtmosphere } from "@/components/event/EventAtmosphere";
import { getChannelConfig } from "@/lib/config";
import { resolveEventEffect } from "@/lib/effect-catalog";
import {
  guestCountLabel,
  guestRsvpDisplayFields,
  resolveGuestRsvpDisplay,
  showGuestResponseTotal,
} from "@/lib/guestRsvpDisplay";

export default async function GuestListPage(props: PageProps<"/e/[slug]/guests">) {
  const translate = await getRequestTranslator();
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
  const { isHost, isLoggedInGuest, hasValidToken, decision } = await resolveEventAccess(
    event,
    slug,
    { token }
  );
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
  const effect = await resolveEventEffect(event.theme);

  const approvedRsvps = event.rsvps.filter((r) => r.approved && r.status !== "INVITED");
  const pendingRsvps = event.rsvps.filter((r) => !r.approved && r.status !== "INVITED");
  // Guests with INVITED status haven't responded yet; shown in host-only Invited tab
  const invitedRsvps = event.rsvps.filter((r) => r.status === "INVITED");

  const going = approvedRsvps.filter((r) => r.status === "GOING");
  const maybe = approvedRsvps.filter((r) => r.status === "MAYBE");
  const no = approvedRsvps.filter((r) => r.status === "NO");
  const totalGoing = going.reduce((s, r) => s + 1 + r.plusOneCount, 0);
  const display = resolveGuestRsvpDisplay(event, isHost);
  // #811: guests get Invited names/count only as the host's Invited row allows;
  // hosts keep the full host-only Invited tab below instead.
  const guestInvited = isHost
    ? { invitedGuests: [], invitedCount: invitedRsvps.length }
    : invitedGuestsForViewer(display.INVITED, invitedRsvps);
  const invitedCountLabel = guestCountLabel(guestInvited.invitedCount, display.INVITED);
  const countSummary = [
    showGuestResponseTotal(display)
      ? translate("Ui.Event.GuestsRoute.responses", {
          count: approvedRsvps.length + (isHost ? pendingRsvps.length : 0),
        })
      : null,
    ...(
      [
        ["GOING", totalGoing, "going"],
        ["MAYBE", maybe.length, "maybe"],
        ["NO", no.length, "declined"],
      ] as const
    ).map(([status, count, label]) => {
      const value = guestCountLabel(count, display[status]);
      return value !== null && (status === "GOING" || count > 0)
        ? translate(`Ui.Event.GuestsRoute.${label}`, { count: value })
        : null;
    }),
    invitedCountLabel !== null && guestInvited.invitedCount > 0
      ? translate("Ui.Event.GuestsRoute.invited", { count: invitedCountLabel })
      : null,
    isHost && pendingRsvps.length > 0
      ? translate("Ui.Event.GuestsRoute.pending", { count: pendingRsvps.length })
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

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
          <p style={{ margin: "0 0 16px", fontSize: "14px" }}>
            <Link href={`/e/${slug}`} {...buttonProps(t, { variant: "link", onGround: true })}>
              {translate("Ui.Event.GuestsRoute.back")}
            </Link>
          </p>
          <h1 style={{ fontSize: "22px", fontWeight: 800, marginBottom: "4px" }}>{event.title}</h1>
          <p style={{ color: t.textMuted, fontSize: "14px" }}>
            {countSummary || translate("Ui.Event.GuestsRoute.title")}
          </p>
        </div>

        {event.rsvps.length === 0 && pendingInvitations.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 20px", color: t.textMuted }}>
            {translate("Ui.Event.GuestsRoute.empty")}
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
            guestInvited={guestInvited.invitedGuests}
            isHost={isHost}
            guestRsvpDisplay={guestRsvpDisplayFields(event)}
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
