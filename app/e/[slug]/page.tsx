import { getRequestLocale, getRequestTranslator } from "@/i18n/server";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { db } from "@/lib/db";
import { resolveEventAccess } from "@/lib/eventAccess";
import { resolveTheme } from "@/lib/theme";
import { resolveEventEffect } from "@/lib/effect-catalog";
import { EventPage } from "@/components/event/EventPage";
import { PasswordGate } from "@/components/event/PasswordGate";
import { AppShell } from "@/components/ui/AppShell";
import { getChannelConfig } from "@/lib/config";
import { invitedGuestsForViewer, stripHostOnlyEventData } from "@/lib/guestList";
import { isGuestRowShown, resolveGuestRsvpDisplay } from "@/lib/guestRsvpDisplay";
import { buildEventSocialMetadata } from "@/lib/event-social";
import { readPollVoterTokenHash } from "@/lib/poll-voter-token";

const getEventPageData = cache((slug: string) =>
  db.event.findUnique({
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
        // Comment bodies already come from Comment. Never serialize their
        // duplicate activity previews, which can outlive a moderated comment.
        where: { type: { not: "comment_new" } },
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
                  rsvpId: true,
                  userId: true,
                  voterTokenHash: true,
                  createdAt: true,
                },
              },
            },
          },
        },
      },
    },
  })
);

export async function generateMetadata(props: PageProps<"/e/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const event = await getEventPageData(slug);
  const [locale, translate] = await Promise.all([getRequestLocale(), getRequestTranslator()]);
  return buildEventSocialMetadata(event, slug, {
    locale,
    translate: (key, values) => translate(`Ui.Event.Social.${key}`, values),
  });
}

export default async function EventRoute(props: PageProps<"/e/[slug]">) {
  const { slug } = await props.params;
  const translate = await getRequestTranslator();
  const searchParams = await props.searchParams;
  const isPreview = searchParams?.preview === "1";
  const token = searchParams?.token as string | undefined;

  const event = await getEventPageData(slug);

  if (!event) notFound();

  if (event.status === "DELETED") {
    return (
      <AppShell center>
        <div style={{ textAlign: "center", maxWidth: "400px", padding: "40px 24px" }}>
          <div style={{ fontSize: "48px", marginBottom: "16px" }}>🗑️</div>
          <h1 style={{ fontSize: "24px", fontWeight: 800, marginBottom: "12px" }}>
            {translate("Ui.Event.Page.deletedTitle")}
          </h1>
          <p style={{ color: "rgba(255,255,255,0.6)", fontSize: "15px", lineHeight: 1.5 }}>
            {translate("Ui.Event.Page.deletedDescription")}
          </p>
        </div>
      </AppShell>
    );
  }

  if (event.status === "CANCELLED") notFound();

  const { sessionUser, isHost, hasValidToken, isLoggedInGuest, loggedInUserRsvp, decision } =
    await resolveEventAccess(event, slug, {
      token,
      isPreview,
      admin: searchParams?.admin === "1",
    });

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
            {translate("Ui.Event.Page.privateTitle")}
          </h1>
          <p style={{ color: "rgba(255,255,255,0.6)", fontSize: "15px", lineHeight: 1.5 }}>
            {translate("Ui.Event.Page.privateDescription")}
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
            {translate("Ui.Event.Page.signIn")}
          </a>
        </div>
      </AppShell>
    );
  }

  const rsvpEnabled = event.rsvpEnabled !== false;
  const _guestRsvpRaw = !rsvpEnabled
    ? null
    : token
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

  const pendingRsvps =
    rsvpEnabled && isHost
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

  // #811: Invited guests are queried only when the host shows that row, and
  // reach the client only as names and/or a count (see invitedGuestsForViewer).
  const invitedDisplay = resolveGuestRsvpDisplay(event, !!isHost).INVITED;
  const invitedRows =
    rsvpEnabled && isGuestRowShown(invitedDisplay)
      ? await db.rSVP.findMany({
          where: { eventId: event.id, status: "INVITED" },
          select: { id: true, guestName: true },
          orderBy: { createdAt: "asc" },
        })
      : [];
  const invited = rsvpEnabled
    ? invitedGuestsForViewer(invitedDisplay, invitedRows)
    : { invitedGuests: [], invitedCount: 0 };

  const theme = resolveTheme(
    event.theme?.baseTheme ?? "DARK",
    event.theme?.gradientFrom ?? "#7c3aed",
    event.theme?.gradientTo ?? "#1e40af",
    event.theme?.accentColor ?? "#a855f7",
    event.theme?.cardOpacity,
    event.theme?.fontId
  );

  const effect = await resolveEventEffect(event.theme);

  const channelConfig = await getChannelConfig();
  const pollVoterTokenHash = await readPollVoterTokenHash();

  const mySubmissionRaw =
    !rsvpEnabled && event.rsvpFields.length > 0 && !isHost
      ? sessionUser?.id
        ? await db.questionnaireSubmission.findUnique({
            where: { eventId_userId: { eventId: event.id, userId: sessionUser.id } },
            include: { answers: { select: { rsvpFieldId: true, value: true } } },
          })
        : pollVoterTokenHash
          ? await db.questionnaireSubmission.findUnique({
              where: {
                eventId_voterTokenHash: { eventId: event.id, voterTokenHash: pollVoterTokenHash },
              },
              include: { answers: { select: { rsvpFieldId: true, value: true } } },
            })
          : null
      : null;

  const initialQuestionnaireSubmission = mySubmissionRaw
    ? {
        respondentName: mySubmissionRaw.respondentName,
        updatedAt: mySubmissionRaw.updatedAt.toISOString(),
        answers: Object.fromEntries(mySubmissionRaw.answers.map((a) => [a.rsvpFieldId, a.value])),
      }
    : null;

  let initialVoterName = "";
  if (!isHost && !guestRsvp) {
    if (sessionUser?.name?.trim()) {
      initialVoterName = sessionUser.name.trim();
    } else {
      let latestCreatedAt = 0;
      if (mySubmissionRaw) {
        latestCreatedAt = mySubmissionRaw.updatedAt.getTime();
        initialVoterName = mySubmissionRaw.respondentName;
      }
      if (pollVoterTokenHash) {
        for (const poll of event.polls) {
          for (const option of poll.options) {
            for (const vote of option.votes) {
              if (vote.voterTokenHash === pollVoterTokenHash) {
                const ts = vote.createdAt.getTime();
                if (ts >= latestCreatedAt) {
                  latestCreatedAt = ts;
                  initialVoterName = vote.voterName;
                }
              }
            }
          }
        }
        for (const comment of event.comments) {
          if (comment.voterTokenHash === pollVoterTokenHash) {
            const ts = comment.createdAt.getTime();
            if (ts >= latestCreatedAt) {
              latestCreatedAt = ts;
              initialVoterName = comment.guestName;
            }
          }
          for (const reply of comment.replies) {
            if (reply.voterTokenHash === pollVoterTokenHash) {
              const ts = reply.createdAt.getTime();
              if (ts >= latestCreatedAt) {
                latestCreatedAt = ts;
                initialVoterName = reply.guestName;
              }
            }
          }
        }
      }
    }
  }

  // SEC-32: the event object is passed into a Client Component, so every field
  // is serialized into the RSC payload and readable by anyone who can load the
  // page — not just what the UI visibly renders. Strip host-only data (co-host/
  // host emails; the guest list when the visibility gate hides it) and server-
  // internal fields (passwordHash, voterTokenHash) before crossing the client boundary.
  const hasPassword = Boolean(event.passwordHash);
  const { passwordHash: _passwordHash, ...eventWithoutPasswordHash } = event;
  const sanitizedComments = event.comments.map(({ voterTokenHash: _vt, replies, ...comment }) => ({
    ...comment,
    replies: replies.map(({ voterTokenHash: _rvt, ...reply }) => reply),
  }));
  const eventForClient = stripHostOnlyEventData(
    {
      ...eventWithoutPasswordHash,
      rsvps: rsvpEnabled ? event.rsvps : [],
      comments: sanitizedComments,
      pendingRsvps,
      ...invited,
      potluckItems: rsvpEnabled
        ? event.potluckItems.map((item) => ({
            ...item,
            claims: item.claims.map(({ rsvpId, userId, ...claim }) => ({
              ...claim,
              isMine: isHost ? userId === sessionUser?.id : !!guestRsvp && rsvpId === guestRsvp.id,
            })),
          }))
        : [],
      polls: event.polls.map((poll) => ({
        ...poll,
        options: poll.options.map((option) => ({
          ...option,
          votes: option.votes.map(({ rsvpId, userId, voterTokenHash, ...vote }) => ({
            ...vote,
            isMine: isHost
              ? userId === sessionUser?.id
              : (!!guestRsvp && rsvpId === guestRsvp.id) ||
                (!!sessionUser && userId === sessionUser.id) ||
                (!!pollVoterTokenHash && voterTokenHash === pollVoterTokenHash),
          })),
        })),
      })),
    },
    { isHost: !!isHost, isLoggedInGuest, hasValidToken }
  );

  return (
    <EventPage
      event={eventForClient as Parameters<typeof EventPage>[0]["event"]}
      isHost={!!isHost}
      theme={theme}
      effect={effect}
      coverUploadEnabled={true}
      guestRsvp={guestRsvp ?? null}
      sessionUser={sessionUser}
      channelConfig={channelConfig}
      initialVoterName={initialVoterName}
      initialQuestionnaireSubmission={initialQuestionnaireSubmission}
      hasPassword={hasPassword}
    />
  );
}
