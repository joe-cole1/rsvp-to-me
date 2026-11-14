"use server";

import { eventActionMessage } from "./localization";

import { revalidatePath } from "next/cache";
import { CreatePollSchema, PollOptionSchema, PollSettingsSchema } from "@/lib/schemas";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { logActivity } from "@/lib/activity";
import { logSafe } from "@/lib/logger";
import { assertHostOrCohost, findApprovedGuestByToken } from "./shared";
import { assertCaptcha } from "@/lib/captcha";

// ── Polls ──────────────────────────────────────────────────────────────────────

export async function createPoll(
  eventId: string,
  question: string,
  options: string[],
  multiChoice: boolean,
  allowGuestsToAdd: boolean,
  hideVoters: boolean = false,
  captchaToken?: string | null
) {
  ({ question, options, multiChoice, allowGuestsToAdd, hideVoters } = CreatePollSchema.parse({
    question,
    options,
    multiChoice,
    allowGuestsToAdd,
    hideVoters,
  }));
  const event = await assertHostOrCohost(eventId);
  await assertCaptcha("poll_manage", captchaToken);
  if (!question.trim()) throw new Error(await eventActionMessage("questionEmpty"));

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
  if (!poll) throw new Error(await eventActionMessage("pollNotFound"));

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
  if (!poll) throw new Error(await eventActionMessage("pollNotFound"));
  if (poll.locked) throw new Error(await eventActionMessage("pollLocked"));

  // Auth verification
  const session = await getSession();
  const isOwner = session?.userId === poll.event.hostId;
  const isCohost = poll.event.coHosts.some((ch) => ch.userId === session?.userId);
  const isHost = isOwner || isCohost;

  let rsvpId: string | null = null;
  if (!isHost) {
    // SEC-24: authorize by secret editToken; the voter name is the RSVP's,
    // never the client-supplied one (both rsvpId and guestName are public).
    const rsvp = await findApprovedGuestByToken(guestEditToken, poll.eventId);
    if (!rsvp) throw new Error(await eventActionMessage("voteRsvpRequired"));
    voterName = rsvp.guestName;
    rsvpId = rsvp.id;
  }

  if (isHost) {
    const user = await db.user.findUnique({
      where: { id: session!.userId },
      select: { name: true },
    });
    voterName = user?.name || "Host";
  }
  const identity = rsvpId ? { rsvpId } : { userId: session!.userId, rsvpId: null };

  const option = await db.pollOption.findUnique({
    where: { id: pollOptionId, pollId },
    select: { text: true },
  });
  if (!option) throw new Error(await eventActionMessage("optionNotFound"));

  // Serialize single-choice replacement and re-check lock/option ownership.
  await db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT id FROM "Poll" WHERE id = ${pollId} FOR UPDATE`;
    const current = await tx.poll.findUnique({ where: { id: pollId } });
    if (!current || current.locked) throw new Error(await eventActionMessage("pollLocked"));
    const ownedOption = await tx.pollOption.findUnique({ where: { id: pollOptionId, pollId } });
    if (!ownedOption) throw new Error(await eventActionMessage("optionNotFound"));
    if (isVoted) {
      await tx.pollVote.deleteMany({
        where: { pollId, ...identity, ...(current.multiChoice ? { pollOptionId } : {}) },
      });
      await tx.pollVote.create({
        data: { pollId, pollOptionId, voterName, rsvpId, userId: rsvpId ? null : session!.userId },
      });
    } else {
      await tx.pollVote.deleteMany({ where: { pollId, pollOptionId, ...identity } });
    }
  });

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
  guestEditToken?: string,
  captchaToken?: string | null
) {
  text = PollOptionSchema.parse(text);
  if (!text.trim()) throw new Error(await eventActionMessage("optionEmpty"));
  await assertCaptcha("poll_option", captchaToken);

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
  if (!poll) throw new Error(await eventActionMessage("pollNotFound"));
  if (poll.locked) throw new Error(await eventActionMessage("pollLocked"));

  const session = await getSession();
  const isOwner = session?.userId === poll.event.hostId;
  const isCohost = poll.event.coHosts.some((ch) => ch.userId === session?.userId);
  const isHost = isOwner || isCohost;

  if (!isHost) {
    if (!poll.allowGuestsToAdd) throw new Error(await eventActionMessage("guestOptionsDisabled"));
    // SEC-24: authorize by secret editToken; the creator name is the RSVP's.
    const rsvp = await findApprovedGuestByToken(guestEditToken, poll.eventId);
    if (!rsvp) throw new Error(await eventActionMessage("approvedRsvpRequired"));
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
  if (existing) throw new Error(await eventActionMessage("optionExists"));

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
  },
  captchaToken?: string | null
) {
  await assertCaptcha("poll_manage", captchaToken);
  data = PollSettingsSchema.parse(data);
  const poll = await db.poll.findUnique({
    where: { id: pollId },
    select: { eventId: true, question: true },
  });
  if (!poll) throw new Error(await eventActionMessage("pollNotFound"));

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
  if (!poll) throw new Error(await eventActionMessage("pollNotFound"));

  const event = await assertHostOrCohost(poll.eventId);

  const option = await db.pollOption.findUnique({
    where: { id: optionId, pollId },
    select: { text: true },
  });
  if (!option) throw new Error(await eventActionMessage("optionNotFound"));

  await db.pollOption.delete({
    where: { id: optionId, pollId },
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
