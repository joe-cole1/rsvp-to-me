import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { resolveEventAccess } from "@/lib/eventAccess";
import { resolveTheme } from "@/lib/theme";
import {
  DEFAULT_EFFECT_DENSITY,
  DEFAULT_EFFECT_SPEED,
  DEFAULT_EFFECT_SIZE,
  type EffectConfig,
  type EffectDensity,
  type EffectSpeed,
} from "@/lib/effects";
import { EventPage } from "@/components/event/EventPage";
import { PasswordGate } from "@/components/event/PasswordGate";
import { AppShell } from "@/components/ui/AppShell";
import { getChannelConfig } from "@/lib/config";

export default async function EventRoute(props: PageProps<"/e/[slug]">) {
  const { slug } = await props.params;
  const searchParams = await props.searchParams;
  const isPreview = searchParams?.preview === "1";
  const token = searchParams?.token as string | undefined;

  const event = await db.event.findUnique({
    where: { slug },
    include: {
      host: { select: { id: true, name: true, email: true, avatarUrl: true } },
      theme: true,
      infoSections: { orderBy: { order: "asc" } },
      rsvpFields: { orderBy: { order: "asc" } },
      coHosts: {
        select: {
          id: true,
          userId: true,
          displayName: true,
          user: { select: { name: true, email: true } },
        },
      },
      rsvps: {
        where: { approved: true, status: { not: "INVITED" } },
        select: {
          id: true,
          guestName: true,
          status: true,
          plusOneCount: true,
          note: true,
          createdAt: true,
          user: { select: { avatarUrl: true } },
        },
        orderBy: { createdAt: "asc" },
      },
      updates: { orderBy: { createdAt: "desc" } },
      potluckItems: {
        include: {
          claims: { orderBy: { createdAt: "asc" } },
        },
        orderBy: { createdAt: "asc" },
      },
      comments: {
        where: { parentId: null },
        include: { replies: { orderBy: { createdAt: "asc" } } },
        orderBy: { createdAt: "desc" },
        take: 50,
      },
      activityEvents: {
        orderBy: { createdAt: "desc" },
        take: 100,
      },
      polls: {
        orderBy: { createdAt: "asc" },
        include: {
          options: {
            orderBy: { createdAt: "asc" },
            include: {
              votes: {
                select: {
                  id: true,
                  voterName: true,
                  createdAt: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!event) notFound();

  if (event.status === "DELETED") {
    return (
      <AppShell center>
        <div style={{ textAlign: "center", maxWidth: "400px", padding: "40px 24px" }}>
          <div style={{ fontSize: "48px", marginBottom: "16px" }}>🗑️</div>
          <h1 style={{ fontSize: "24px", fontWeight: 800, marginBottom: "12px" }}>
            This event was deleted
          </h1>
          <p style={{ color: "rgba(255,255,255,0.6)", fontSize: "15px", lineHeight: 1.5 }}>
            The host has removed this event.
          </p>
        </div>
      </AppShell>
    );
  }

  if (event.status === "CANCELLED") notFound();

  const { sessionUser, isHost, loggedInUserRsvp, decision } = await resolveEventAccess(
    event,
    slug,
    {
      token,
      isPreview,
      admin: searchParams?.admin === "1",
    }
  );

  if (decision === "password") {
    // Password is a valid access path — show the entry form.
    return <PasswordGate slug={slug} />;
  }

  if (decision === "private-blocked") {
    return (
      <AppShell center>
        <div style={{ textAlign: "center", maxWidth: "400px", padding: "40px 24px" }}>
          <div style={{ fontSize: "48px", marginBottom: "16px" }}>🔒</div>
          <h1 style={{ fontSize: "24px", fontWeight: 800, marginBottom: "12px" }}>
            This is a private event
          </h1>
          <p style={{ color: "rgba(255,255,255,0.6)", fontSize: "15px", lineHeight: 1.5 }}>
            To attend, contact the host to receive an invitation.
          </p>
          <a
            href={`/auth/sign-in?redirect=/e/${slug}`}
            style={{
              display: "inline-block",
              marginTop: "20px",
              padding: "10px 22px",
              background: "rgba(168,85,247,0.15)",
              border: "1px solid rgba(168,85,247,0.4)",
              borderRadius: "8px",
              color: "#c084fc",
              textDecoration: "none",
              fontSize: "14px",
              fontWeight: 600,
            }}
          >
            Sign in to access
          </a>
        </div>
      </AppShell>
    );
  }

  const _guestRsvpRaw = token
    ? await db.rSVP.findFirst({
        where: { editToken: token, eventId: event.id },
        select: {
          id: true,
          guestName: true,
          editToken: true,
          status: true,
          responded: true,
          approved: true,
          _count: { select: { answers: true } },
        },
      })
    : loggedInUserRsvp;
  const guestRsvp = _guestRsvpRaw
    ? {
        id: _guestRsvpRaw.id,
        guestName: _guestRsvpRaw.guestName,
        editToken: _guestRsvpRaw.editToken,
        status: _guestRsvpRaw.status as "GOING" | "MAYBE" | "NO" | "INVITED",
        hasAnswers: _guestRsvpRaw._count.answers > 0,
        responded: _guestRsvpRaw.responded,
        approved: _guestRsvpRaw.approved,
      }
    : null;

  const pendingRsvps = isHost
    ? await db.rSVP.findMany({
        where: { eventId: event.id, approved: false, status: { not: "INVITED" } },
        select: {
          id: true,
          guestName: true,
          guestEmail: true,
          status: true,
          plusOneCount: true,
          createdAt: true,
        },
        orderBy: { createdAt: "asc" },
      })
    : [];

  const theme = resolveTheme(
    event.theme?.baseTheme ?? "DARK",
    event.theme?.gradientFrom ?? "#7c3aed",
    event.theme?.gradientTo ?? "#1e40af",
    event.theme?.accentColor ?? "#a855f7",
    event.theme?.cardOpacity,
    event.theme?.fontId
  );

  const effect: EffectConfig | null = event.theme?.effectId
    ? {
        effectId: event.theme.effectId,
        density: (event.theme.effectDensity as EffectDensity) ?? DEFAULT_EFFECT_DENSITY,
        speed: (event.theme.effectSpeed as EffectSpeed) ?? DEFAULT_EFFECT_SPEED,
        size: event.theme.effectSize ?? DEFAULT_EFFECT_SIZE,
      }
    : null;

  const channelConfig = await getChannelConfig();

  return (
    <EventPage
      event={{ ...event, pendingRsvps } as Parameters<typeof EventPage>[0]["event"]}
      isHost={!!isHost}
      theme={theme}
      effect={effect}
      coverUploadEnabled={true}
      guestRsvp={guestRsvp ?? null}
      sessionUser={sessionUser}
      channelConfig={channelConfig}
    />
  );
}
