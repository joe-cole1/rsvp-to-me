import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { resolveTheme } from "@/lib/theme";
import { EventPage } from "@/components/event/EventPage";
import { PasswordGate } from "@/components/event/PasswordGate";
import { cookies } from "next/headers";
import { getUnlockSignature } from "@/lib/crypto";
import { AppShell } from "@/components/ui/AppShell";

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
      coHosts: { select: { userId: true } },
      rsvps: {
        where: { approved: true },
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

  if (!event || event.status === "CANCELLED") notFound();

  const session = await getSession();
  const isHostOwner = session?.userId === event.hostId;
  const isCohost = event.coHosts.some((ch) => ch.userId === session?.userId);
  const isAdminModerating = session?.role === "ADMIN" && searchParams?.admin === "1";
  const isHost = !isPreview && (isHostOwner || isCohost || isAdminModerating);

  // Block / gate unauthenticated access to PRIVATE events
  if (!session && !isHost) {
    if (event.visibility === "PRIVATE") {
      return (
        <AppShell center>
          <div style={{ textAlign: "center", maxWidth: "400px", padding: "40px 24px" }}>
            <div style={{ fontSize: "48px", marginBottom: "16px" }}>🔒</div>
            <h1 style={{ fontSize: "24px", fontWeight: 800, marginBottom: "12px" }}>This is a private event</h1>
            <p style={{ color: "rgba(255,255,255,0.6)", fontSize: "15px", lineHeight: 1.5 }}>
              To attend, contact the host to receive an invitation.
            </p>
          </div>
        </AppShell>
      );
    }
  }

  // Check if event is unlocked via signed cookie
  const unlockedCookie = (await cookies()).get(`rsvp-unlocked-${slug}`)?.value;
  const isUnlocked = unlockedCookie === getUnlockSignature(slug);

  // Password gate — hosts bypass it
  if (event.password && !isHost && !isUnlocked) {
    return <PasswordGate slug={slug} />;
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
          _count: { select: { answers: true } },
        },
      })
    : null;
  const guestRsvp = _guestRsvpRaw
    ? {
        id: _guestRsvpRaw.id,
        guestName: _guestRsvpRaw.guestName,
        editToken: _guestRsvpRaw.editToken,
        status: _guestRsvpRaw.status as "GOING" | "MAYBE" | "NO",
        hasAnswers: _guestRsvpRaw._count.answers > 0,
        responded: _guestRsvpRaw.responded,
      }
    : null;

  const pendingRsvps = isHost
    ? await db.rSVP.findMany({
        where: { eventId: event.id, approved: false },
        select: { id: true, guestName: true, guestEmail: true, status: true, plusOneCount: true, createdAt: true },
        orderBy: { createdAt: "asc" },
      })
    : [];

  const theme = resolveTheme(
    event.theme?.baseTheme ?? "DARK",
    event.theme?.accentColor ?? "#a855f7"
  );

  let sessionUser = null;
  if (session) {
    const dbUser = await db.user.findUnique({
      where: { id: session.userId },
      select: { email: true, name: true, avatarUrl: true, role: true },
    });
    if (dbUser) {
      sessionUser = {
        email: dbUser.email ?? session.email,
        name: dbUser.name,
        avatarUrl: dbUser.avatarUrl,
        role: dbUser.role as "GUEST" | "HOST" | "ADMIN",
      };
    }
  }

  return (
    <EventPage
      event={{ ...event, pendingRsvps } as Parameters<typeof EventPage>[0]["event"]}
      isHost={!!isHost}
      theme={theme}
      coverUploadEnabled={true}
      guestRsvp={guestRsvp ?? null}
      sessionUser={sessionUser}
    />
  );
}
