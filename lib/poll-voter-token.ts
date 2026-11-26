import "server-only";
import { randomUUID } from "crypto";
import { cookies } from "next/headers";
import { hashToken } from "@/lib/hash";

export const POLL_VOTER_COOKIE = "rsvp_poll_voter";

/** Read and hash the anonymous poll-voter browser cookie if present and well-formed. */
export async function readPollVoterTokenHash(): Promise<string | null> {
  let cookieStore: Awaited<ReturnType<typeof cookies>>;
  try {
    cookieStore = await cookies();
  } catch {
    // Non-HTTP callers (e.g., direct integration tests) have no request cookie store.
    return null;
  }
  const raw = cookieStore.get(POLL_VOTER_COOKIE)?.value?.trim();
  if (!raw || raw.length < 16 || raw.length > 128) return null;
  return hashToken(raw);
}

/** Return the hashed anonymous poll-voter cookie, issuing a fresh HttpOnly token if missing. */
export async function getOrCreatePollVoterTokenHash(): Promise<string> {
  const cookieStore = await cookies();
  const existing = cookieStore.get(POLL_VOTER_COOKIE)?.value?.trim();
  if (existing && existing.length >= 16 && existing.length <= 128) {
    return hashToken(existing);
  }
  const token = randomUUID();
  cookieStore.set(POLL_VOTER_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 180,
    path: "/",
  });
  return hashToken(token);
}
