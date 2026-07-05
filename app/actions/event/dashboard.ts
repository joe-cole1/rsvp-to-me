"use server";

import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { assertHostOrCohost } from "./shared";
import type { DashboardEvent, DashboardInvite, DashboardActivity } from "./types";

// ── Dashboard ──────────────────────────────────────────────────────────────────

type CoHostQueryItem = {
  displayName?: string | null;
  user?: {
    id: string;
    name: string | null;
    email: string | null;
    avatarUrl: string | null;
  } | null;
  userId?: string;
};

export async function getDashboardEvents(): Promise<DashboardEvent[]> {
  const session = await getSession();
  if (!session) return [];

  const events = await db.event.findMany({
    where: {
      status: { not: "DELETED" },
      OR: [{ hostId: session.userId }, { coHosts: { some: { userId: session.userId } } }],
    },
    include: {
      theme: {
        select: { gradientFrom: true, gradientTo: true, accentColor: true, coverImageUrl: true },
      },
      rsvps: { select: { status: true, approved: true } },
      coHosts: {
        select: {
          displayName: true,
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              avatarUrl: true,
            },
          },
        },
      },
      host: { select: { name: true, email: true, avatarUrl: true } },
      _count: {
        select: { comments: true },
      },
    },
    orderBy: { startAt: "desc" },
  });

  return events.map((e) => {
    const going = e.rsvps.filter(
      (r: { status: string; approved: boolean }) => r.approved && r.status === "GOING"
    ).length;
    const maybe = e.rsvps.filter(
      (r: { status: string; approved: boolean }) => r.approved && r.status === "MAYBE"
    ).length;
    const pending = e.rsvps.filter(
      (r: { status: string; approved: boolean }) => !r.approved
    ).length;
    return {
      id: e.id,
      slug: e.slug,
      title: e.title,
      startAt: e.startAt,
      status: e.status,
      theme: e.theme,
      going,
      maybe,
      pending,
      isCohost: e.hostId !== session.userId,
      host: e.host,
      coHosts: e.coHosts
        ? (e.coHosts
            .map((ch: CoHostQueryItem) => {
              const u = ch.user;
              if (!u) {
                return ch.userId
                  ? { id: ch.userId, name: ch.displayName || null, email: null, avatarUrl: null }
                  : null;
              }
              return {
                id: u.id,
                name: ch.displayName || u.name || (u.email ? u.email.split("@")[0] : "Co-host"),
                email: u.email || null,
                avatarUrl: u.avatarUrl,
              };
            })
            .filter(Boolean) as {
            id: string;
            name: string | null;
            email: string | null;
            avatarUrl: string | null;
          }[])
        : [],
      commentCount: e._count?.comments ?? 0,
      rsvpDeadline: e.rsvpDeadline,
      hostDisplayName: e.hostDisplayName,
    };
  });
}

export async function getDashboardInvites(): Promise<DashboardInvite[]> {
  const session = await getSession();
  if (!session) return [];

  // Find user email/phone for matching
  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: { email: true, phone: true },
  });
  if (!user) return [];

  const userEmails = user.email ? [user.email.toLowerCase().trim()] : [];
  const userPhone = user.phone ? user.phone.trim().replace(/[\s\-().]/g, "") : null;

  const rsvps = await db.rSVP.findMany({
    where: {
      OR: [
        { userId: session.userId },
        ...(userEmails.length > 0 ? [{ guestEmail: { in: userEmails } }] : []),
        ...(userPhone ? [{ guestPhone: userPhone }] : []),
      ],
      // Exclude events they host themselves to avoid duplicates
      event: {
        hostId: { not: session.userId },
      },
    },
    include: {
      event: {
        include: {
          theme: {
            select: {
              gradientFrom: true,
              gradientTo: true,
              accentColor: true,
              coverImageUrl: true,
            },
          },
          rsvps: { select: { status: true, approved: true } },
          host: { select: { name: true, email: true, avatarUrl: true } },
          coHosts: {
            select: {
              displayName: true,
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  avatarUrl: true,
                },
              },
            },
          },
          _count: {
            select: { comments: true },
          },
        },
      },
    },
    orderBy: { event: { startAt: "desc" } },
  });

  return rsvps.map((r) => {
    const e = r.event;
    const going = e.rsvps.filter(
      (rv: { status: string; approved: boolean }) => rv.approved && rv.status === "GOING"
    ).length;
    const maybe = e.rsvps.filter(
      (rv: { status: string; approved: boolean }) => rv.approved && rv.status === "MAYBE"
    ).length;
    const pending = e.rsvps.filter(
      (rv: { status: string; approved: boolean }) => !rv.approved
    ).length;

    // Check if the current user is a co-host of this event
    const isCohost = e.coHosts
      ? e.coHosts.some(
          (ch: CoHostQueryItem) => ch.user?.id === session.userId || ch.userId === session.userId
        )
      : false;

    return {
      id: e.id,
      slug: e.slug,
      title: e.title,
      startAt: e.startAt,
      status: e.status,
      theme: e.theme,
      going,
      maybe,
      pending,
      isCohost,
      host: e.host,
      coHosts: e.coHosts
        ? (e.coHosts
            .map((ch: CoHostQueryItem) => {
              const u = ch.user;
              if (!u) {
                return ch.userId
                  ? { id: ch.userId, name: ch.displayName || null, email: null, avatarUrl: null }
                  : null;
              }
              return {
                id: u.id,
                name: ch.displayName || u.name || (u.email ? u.email.split("@")[0] : "Co-host"),
                email: u.email || null,
                avatarUrl: u.avatarUrl,
              };
            })
            .filter(Boolean) as {
            id: string;
            name: string | null;
            email: string | null;
            avatarUrl: string | null;
          }[])
        : [],
      commentCount: e._count?.comments ?? 0,
      userRsvpStatus: r.status,
      userRsvpEditToken: r.editToken,
      rsvpDeadline: e.rsvpDeadline,
      hostDisplayName: e.hostDisplayName,
    };
  });
}

export async function getDashboardActivity(eventIds: string[]): Promise<DashboardActivity[]> {
  const session = await getSession();
  if (!session || eventIds.length === 0) return [];

  // SEC-1: restrict to events the caller is actually authorised to see
  const authorised = await db.event.findMany({
    where: {
      id: { in: eventIds },
      OR: [
        { hostId: session.userId },
        { coHosts: { some: { userId: session.userId } } },
        { rsvps: { some: { userId: session.userId } } },
      ],
    },
    select: { id: true },
  });

  const authorisedIds = authorised.map((e) => e.id);
  if (authorisedIds.length === 0) return [];

  return db.activityEvent.findMany({
    where: {
      eventId: { in: authorisedIds },
    },
    include: {
      event: {
        select: {
          title: true,
          slug: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });
}

export async function deleteActivityEvent(activityId: string) {
  const activity = await db.activityEvent.findUnique({
    where: { id: activityId },
    select: { eventId: true },
  });
  if (!activity) return { success: false };
  await assertHostOrCohost(activity.eventId);
  await db.activityEvent.delete({ where: { id: activityId } });
  return { success: true };
}
