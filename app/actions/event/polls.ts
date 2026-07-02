"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { logActivity } from "@/lib/activity";
import { logSafe } from "@/lib/logger";
import { assertHostOrCohost, findApprovedGuestByToken } from "./shared";

// ── Polls ──────────────────────────────────────────────────────────────────────

export async function createPoll(
  eventId: string,
  question: string,
  options: string[],
  multiChoice: boolean,
  allowGuestsToAdd: boolean,
  hideVoters: boolean = false
) {
  const event = await assertHostOrCohost(eventId);
  if (!question.trim()) throw new Error("Question cannot be empty");

  const cleanOptions = options.map((o) => o.trim()).filter((o) => o.length > 0);

  const poll = await db.$transaction(async (tx) => {
    const p = await tx.poll.create({
      data: {
        eventId,
        question: question.trim(),
        multiChoice,
        allowGuestsToAdd,
        hideVoters,
      },
    });

    if (cleanOptions.length > 0) {
      await tx.pollOption.createMany({
        data: cleanOptions.map((o) => ({
          pollId: p.id,
          text: o,
        })),
      });
    }

    return p;
  });

  const session = await getSession();
  let hostName = "Host";
  if (session?.userId) {
    const user = await db.user.findUnique({
      where: { id: session.userId },
      select: { name: true, email: true },
    });
    hostName = user?.name ?? user?.email?.split("@")[0] ?? "Host";
  }

  await logActivity(
    eventId,
    "poll_create",
    `created a new poll: "${question.trim()}"`,
    hostName
  ).catch(logSafe("createPoll"));

  revalidatePath(`/e/${event.slug}`);
  return { success: true, id: poll.id };
}

export async function deletePoll(pollId: string) {
  const poll = await db.poll.findUnique({
    where: { id: pollId },
    select: { eventId: true },
  });
  if (!poll) throw new Error("Poll not found");

  const event = await assertHostOrCohost(poll.eventId);

  await db.poll.delete({
    where: { id: pollId },
  });

  revalidatePath(`/e/${event.slug}`);
  return { success: true };
}

export async function castVote(
  pollId: string,
  pollOptionId: string,
  voterName: string,
  isVoted: boolean,
  guestEditToken?: string
) {
  const poll = await db.poll.findUnique({
    where: { id: pollId },
    include: {
      event: {
        select: {
          hostId: true,
          slug: true,
          coHosts: { select: { userId: true } },
        },
      },
    },
  });
  if (!poll) throw new Error("Poll not found");
  if (poll.locked) throw new Error("This poll is locked");

  // Auth verification
  const session = await getSession();
  const isOwner = session?.userId === poll.event.hostId;
  const isCohost = poll.event.coHosts.some((ch) => ch.userId === session?.userId);
  const isHost = isOwner || isCohost;

  if (!isHost) {
    // SEC-24: authorize by secret editToken; the voter name is the RSVP's,
    // never the client-supplied one (both rsvpId and guestName are public).
    const rsvp = await findApprovedGuestByToken(guestEditToken, poll.eventId);
    if (!rsvp) throw new Error("Unauthorized: a valid approved RSVP is required to vote");
    voterName = rsvp.guestName;
  }

  const option = await db.pollOption.findUnique({
    where: { id: pollOptionId },
    select: { text: true },
  });
  if (!option) throw new Error("Option not found");

  if (isVoted) {
    if (!poll.multiChoice) {
      // Single-choice poll: delete any other votes by this voter in this poll
      await db.pollVote.deleteMany({
        where: {
          pollId,
          voterName,
        },
      });
    }

    await db.pollVote.upsert({
      where: {
        pollOptionId_voterName: {
          pollOptionId,
          voterName,
        },
      },
      create: {
        pollId,
        pollOptionId,
        voterName,
        userId: session?.userId,
      },
      update: {},
    });
  } else {
    // Retract vote
    await db.pollVote.deleteMany({
      where: {
        pollOptionId,
        voterName,
      },
    });
  }

  // Log activity if the poll is public (not anonymous)
  if (!poll.hideVoters) {
    await logActivity(
      poll.eventId,
      isVoted ? "poll_vote" : "poll_vote_retracted",
      isVoted
        ? `voted for "${option.text}" in the poll "${poll.question}"`
        : `retracted vote for "${option.text}" in the poll "${poll.question}"`,
      voterName
    ).catch(logSafe("castVote"));
  }

  revalidatePath(`/e/${poll.event.slug}`);
  return { success: true };
}

export async function addPollOption(
  pollId: string,
  text: string,
  creatorName: string,
  guestEditToken?: string
) {
  if (!text.trim()) throw new Error("Option text cannot be empty");

  const poll = await db.poll.findUnique({
    where: { id: pollId },
    include: {
      event: {
        select: {
          hostId: true,
          slug: true,
          coHosts: { select: { userId: true } },
        },
      },
    },
  });
  if (!poll) throw new Error("Poll not found");
  if (poll.locked) throw new Error("This poll is locked");

  const session = await getSession();
  const isOwner = session?.userId === poll.event.hostId;
  const isCohost = poll.event.coHosts.some((ch) => ch.userId === session?.userId);
  const isHost = isOwner || isCohost;

  if (!isHost) {
    if (!poll.allowGuestsToAdd)
      throw new Error("Guests are not allowed to add options to this poll");
    // SEC-24: authorize by secret editToken; the creator name is the RSVP's.
    const rsvp = await findApprovedGuestByToken(guestEditToken, poll.eventId);
    if (!rsvp) throw new Error("Unauthorized: a valid approved RSVP is required");
    creatorName = rsvp.guestName;
  }

  // Check if option already exists
  const existing = await db.pollOption.findFirst({
    where: {
      pollId,
      text: {
        equals: text.trim(),
      },
    },
  });
  if (existing) throw new Error("Option already exists");

  const option = await db.pollOption.create({
    data: {
      pollId,
      text: text.trim(),
      creatorName: isHost ? null : creatorName,
    },
  });

  await logActivity(
    poll.eventId,
    "poll_option_add",
    `added a new option "${text.trim()}" to the poll`,
    creatorName
  ).catch(logSafe("addPollOption"));

  revalidatePath(`/e/${poll.event.slug}`);
  return { success: true, id: option.id };
}

export async function updatePollSettings(
  pollId: string,
  data: {
    question?: string;
    multiChoice?: boolean;
    allowGuestsToAdd?: boolean;
    locked?: boolean;
    hideVoters?: boolean;
  }
) {
  const poll = await db.poll.findUnique({
    where: { id: pollId },
    select: { eventId: true, question: true },
  });
  if (!poll) throw new Error("Poll not found");

  const event = await assertHostOrCohost(poll.eventId);

  const session = await getSession();
  let hostName = "Host";
  if (session?.userId) {
    const user = await db.user.findUnique({
      where: { id: session.userId },
      select: { name: true, email: true },
    });
    hostName = user?.name ?? user?.email?.split("@")[0] ?? "Host";
  }

  await db.poll.update({
    where: { id: pollId },
    data: {
      question: data.question !== undefined ? data.question.trim() : undefined,
      multiChoice: data.multiChoice,
      allowGuestsToAdd: data.allowGuestsToAdd,
      locked: data.locked,
      hideVoters: data.hideVoters,
    },
  });

  // Log activity for significant updates (like lock/unlock)
  if (data.locked !== undefined) {
    await logActivity(
      poll.eventId,
      data.locked ? "poll_lock" : "poll_unlock",
      `${data.locked ? "locked" : "unlocked"} the poll: "${poll.question}"`,
      hostName
    ).catch(logSafe("updatePollSettings"));
  }

  revalidatePath(`/e/${event.slug}`);
  return { success: true };
}

export async function deletePollOption(pollId: string, optionId: string) {
  const poll = await db.poll.findUnique({
    where: { id: pollId },
    select: { eventId: true, question: true },
  });
  if (!poll) throw new Error("Poll not found");

  const event = await assertHostOrCohost(poll.eventId);

  const option = await db.pollOption.findUnique({
    where: { id: optionId },
    select: { text: true },
  });
  if (!option) throw new Error("Option not found");

  await db.pollOption.delete({
    where: { id: optionId },
  });

  const session = await getSession();
  let hostName = "Host";
  if (session?.userId) {
    const user = await db.user.findUnique({
      where: { id: session.userId },
      select: { name: true, email: true },
    });
    hostName = user?.name ?? user?.email?.split("@")[0] ?? "Host";
  }

  await logActivity(
    poll.eventId,
    "poll_option_delete",
    `deleted option "${option.text}" from the poll: "${poll.question}"`,
    hostName
  ).catch(logSafe("deletePollOption"));

  revalidatePath(`/e/${event.slug}`);
  return { success: true };
}
