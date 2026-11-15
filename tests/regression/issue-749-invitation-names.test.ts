// #749: invitations used contact-derived placeholders and RSVP edits could not
// correct the name. Keep names event-scoped, preserve reviewed existing identity,
// and prevent draft preview from exposing global accounts or token authority.
import "@/tests/helpers/english-request-locale";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReviewedInvitationRecipient } from "@/lib/invitation-types";
import type { Prisma } from "@/app/generated/prisma/client";

interface GuestRow {
  id: string;
  eventId: string;
  guestName: string;
  guestEmail: string | null;
  guestPhone: string | null;
  status: string;
  responded: boolean;
  editToken: string;
  user?: { preferredLocale: string } | null;
  plusOneGuests?: { name: string }[];
}
interface HistoryRow {
  id: string;
  eventId: string;
  sentTo: string;
  rsvpId: string | null;
}

const mocks = vi.hoisted(() => ({
  rows: [] as GuestRow[],
  history: [] as HistoryRow[],
  session: vi.fn(),
  event: vi.fn(),
  userFind: vi.fn(),
  userCreate: vi.fn(),
  findMany: vi.fn(),
  findFirst: vi.fn(),
  findUnique: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  updateMany: vi.fn(),
  historyFind: vi.fn(),
  historyCreate: vi.fn(),
  historyUpdate: vi.fn(),
  email: vi.fn(),
  sms: vi.fn(),
  rendered: vi.fn(),
  activity: vi.fn(),
  captcha: vi.fn(),
  rate: vi.fn(),
  channels: vi.fn(),
  revalidate: vi.fn(),
  checkInDelete: vi.fn(),
  transaction: vi.fn(),
  executeRaw: vi.fn(),
  activeTransactions: 0,
}));
vi.mock("@/lib/db", () => ({
  db: {
    $transaction: mocks.transaction,
    $executeRaw: mocks.executeRaw,
    event: { findUnique: mocks.event },
    user: { findFirst: mocks.userFind, create: mocks.userCreate },
    rSVP: {
      findMany: mocks.findMany,
      findFirst: mocks.findFirst,
      findUnique: mocks.findUnique,
      create: mocks.create,
      update: mocks.update,
      updateMany: mocks.updateMany,
    },
    invitation: {
      findMany: mocks.historyFind,
      create: mocks.historyCreate,
      updateMany: mocks.historyUpdate,
    },
    checkIn: { deleteMany: mocks.checkInDelete },
    plusOneGuest: { deleteMany: vi.fn(), createMany: vi.fn() },
  },
}));
vi.mock("@/lib/session", () => ({ getSession: mocks.session }));
vi.mock("@/lib/captcha", () => ({ assertCaptcha: mocks.captcha }));
vi.mock("@/lib/rateLimit", () => ({ rateLimit: mocks.rate }));
vi.mock("@/lib/clientIp", () => ({
  isTrustedIpConfigured: () => true,
  getClientIp: vi.fn().mockResolvedValue("203.0.113.1"),
}));
vi.mock("@/lib/config", () => ({ getChannelConfig: mocks.channels }));
vi.mock("@/lib/capacityLock", () => ({
  withEventCapacityLock: async <T>(_id: string, action: (tx: typeof db) => Promise<T>) =>
    action(db),
}));
vi.mock("@/lib/activity", () => ({ logActivity: mocks.activity, iconLabel: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("@/lib/email", () => ({
  sendEventInviteEmail: mocks.email,
  sendRenderedEmail: mocks.rendered,
  sendRsvpConfirmationEmail: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/sms", () => ({
  sendEventInviteSms: mocks.sms,
  sendRsvpConfirmationSms: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/email-settings", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/email-settings")>()),
  getEmailTemplateSettings: vi.fn().mockResolvedValue({}),
}));

import {
  inviteFriendAsGuest,
  previewGuestInvitations,
  sendGuestInvitations,
} from "@/app/actions/event/invites";
import { updateRSVP, updateRsvpAsHost } from "@/app/actions/event/rsvp";
import { getEventEmailPreview } from "@/app/actions/event/emails";
import { db } from "@/lib/db";

const EVENT = "event-749";
const event = {
  status: "PUBLISHED",
  id: EVENT,
  hostId: "host",
  slug: "party",
  coHosts: [],
  title: "Party",
  host: { name: "Host", email: "host@example.com" },
  startAt: new Date("2099-01-01"),
  endAt: null,
  timezone: "UTC",
  locationType: "TBD",
  locationName: null,
  description: "A party",
  theme: null,
  visibility: "PRIVATE",
  guestsCanInvite: true,
  maybeEnabled: true,
  capacity: null,
  rsvpDeadline: null,
  rsvpFields: [],
};
function row(overrides: Partial<GuestRow> = {}): GuestRow {
  return {
    id: "rsvp",
    eventId: EVENT,
    guestName: "Established Name",
    guestEmail: "guest@example.com",
    guestPhone: null,
    status: "INVITED",
    responded: false,
    editToken: "secret-token",
    user: null,
    plusOneGuests: [],
    ...overrides,
  };
}
async function reviewed(
  contact = "guest@example.com",
  name?: string
): Promise<ReviewedInvitationRecipient> {
  const recipient = { contact, ...(name === undefined ? {} : { name }) };
  const preview = (await previewGuestInvitations(EVENT, [recipient])).recipients[0];
  if (preview.disposition === "conflict") throw new Error("Conflicting fixture");
  return {
    ...recipient,
    expectedGuestName: preview.guestName,
    expectedDisposition: preview.disposition,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.rows.length = 0;
  mocks.history.length = 0;
  mocks.session.mockResolvedValue({ userId: "host", email: "host@example.com", role: "HOST" });
  mocks.event.mockResolvedValue(event);
  mocks.findMany.mockImplementation(async ({ where }: { where: { eventId: string } }) =>
    mocks.rows.filter((r) => r.eventId === where.eventId)
  );
  mocks.historyFind.mockImplementation(async ({ where }: { where: { eventId: string } }) =>
    mocks.history.filter((r) => r.eventId === where.eventId)
  );
  mocks.findFirst.mockImplementation(
    async ({ where }: { where: { id: string; eventId: string } }) =>
      mocks.rows.find((r) => r.id === where.id && r.eventId === where.eventId) ?? null
  );
  mocks.findUnique.mockResolvedValue({ ...row(), event, checkIn: null });
  mocks.userFind.mockResolvedValue(null);
  mocks.userCreate.mockResolvedValue({ id: "account", preferredLocale: "en-US" });
  mocks.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
    const created = {
      ...data,
      id: `new-${mocks.rows.length}`,
      editToken: "new-secret-token",
      user: { preferredLocale: "en-US" },
    } as GuestRow;
    mocks.rows.push(created);
    return created;
  });
  mocks.historyCreate.mockResolvedValue({});
  mocks.historyUpdate.mockResolvedValue({ count: 1 });
  mocks.update.mockResolvedValue({});
  mocks.updateMany.mockResolvedValue({ count: 1 });
  mocks.activity.mockResolvedValue(undefined);
  mocks.email.mockResolvedValue(undefined);
  mocks.sms.mockResolvedValue(undefined);
  mocks.rate.mockResolvedValue({ success: true });
  mocks.channels.mockResolvedValue({ email: true, sms: true });
  mocks.checkInDelete.mockResolvedValue({ count: 1 });
  mocks.activeTransactions = 0;
  mocks.executeRaw.mockResolvedValue(1);
  mocks.transaction.mockImplementation(
    async (action: (client: Prisma.TransactionClient) => Promise<unknown>) => {
      mocks.activeTransactions++;
      try {
        return await action(db);
      } finally {
        mocks.activeTransactions--;
      }
    }
  );
});

describe("#749 event-scoped invitation preview", () => {
  it("returns only the allowlist and never reads accounts for unknown or known contacts", async () => {
    mocks.rows.push(
      row(),
      row({ eventId: "other-event", id: "other", guestEmail: "other@example.com" })
    );
    const result = await previewGuestInvitations(EVENT, [
      { contact: "GUEST@EXAMPLE.COM", name: "Untrusted replacement" },
      { contact: "other@example.com" },
    ]);
    expect(result.recipients).toEqual([
      {
        contact: "guest@example.com",
        guestName: "Established Name",
        disposition: "invited",
        channel: "EMAIL",
      },
      { contact: "other@example.com", guestName: "Guest", disposition: "new", channel: "EMAIL" },
    ]);
    expect(mocks.userFind).not.toHaveBeenCalled();
    expect(mocks.userCreate).not.toHaveBeenCalled();
    expect(mocks.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { eventId: EVENT } })
    );
    expect(mocks.historyFind).toHaveBeenCalledWith(
      expect.objectContaining({ where: { eventId: EVENT } })
    );
    expect(JSON.stringify(result)).not.toContain("secret-token");
  });

  it("authenticates and authorizes before recipient lookup", async () => {
    mocks.session.mockResolvedValue(null);
    await expect(previewGuestInvitations(EVENT, [{ contact: "a@example.com" }])).rejects.toThrow(
      "Unauthorized"
    );
    expect(mocks.findMany).not.toHaveBeenCalled();
    mocks.session.mockResolvedValue({ userId: "stranger", role: "HOST" });
    await expect(previewGuestInvitations(EVENT, [{ contact: "a@example.com" }])).rejects.toThrow(
      "Forbidden"
    );
    expect(mocks.findMany).not.toHaveBeenCalled();
  });

  it("matches historical phone punctuation but rejects history aliases and cross-event links", async () => {
    mocks.rows.push(row({ guestPhone: "(555) 123-4567", guestEmail: null }));
    mocks.history.push(
      { id: "alias", eventId: EVENT, sentTo: "alias@example.com", rsvpId: "rsvp" },
      { id: "orphan", eventId: EVENT, sentTo: "orphan@example.com", rsvpId: null },
      { id: "foreign", eventId: EVENT, sentTo: "foreign@example.com", rsvpId: "outside" },
      { id: "dangling", eventId: EVENT, sentTo: "dangling@example.com", rsvpId: "missing" }
    );
    mocks.rows.push(row({ id: "outside", eventId: "other", guestName: "Private foreign name" }));
    const result = await previewGuestInvitations(EVENT, [
      { contact: "5551234567" },
      { contact: "alias@example.com" },
      { contact: "orphan@example.com", name: "New Name" },
      { contact: "foreign@example.com" },
      { contact: "dangling@example.com" },
    ]);
    expect(result.recipients.map((r) => [r.guestName, r.disposition])).toEqual([
      ["Established Name", "invited"],
      ["Guest", "conflict"],
      ["New Name", "invited"],
      ["Guest", "conflict"],
      ["Guest", "conflict"],
    ]);
    const attempt = await sendGuestInvitations(EVENT, [
      { contact: "alias@example.com", expectedDisposition: "invited", expectedGuestName: "Guest" },
      {
        contact: "foreign@example.com",
        expectedDisposition: "invited",
        expectedGuestName: "Guest",
      },
      {
        contact: "dangling@example.com",
        expectedDisposition: "invited",
        expectedGuestName: "Guest",
      },
    ]);
    expect(attempt.results.map((r) => r.status)).toEqual(["failed", "failed", "failed"]);
    expect(mocks.email).not.toHaveBeenCalled();
    expect(mocks.historyUpdate).not.toHaveBeenCalled();
  });

  it("never sends the current edit token to an old email retained only in delivery history", async () => {
    mocks.rows.push(row());
    mocks.history.push({
      id: "history",
      eventId: EVENT,
      sentTo: "guest@example.com",
      rsvpId: "rsvp",
    });
    const staleReview = await reviewed();
    mocks.rows[0].guestEmail = "changed@example.com";
    expect(
      (await previewGuestInvitations(EVENT, [{ contact: "guest@example.com" }])).recipients[0]
        .disposition
    ).toBe("conflict");
    const result = await sendGuestInvitations(EVENT, [staleReview]);
    expect(result.results[0].status).toBe("failed");
    expect(mocks.email).not.toHaveBeenCalled();
    expect(mocks.historyUpdate).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("classifies responded contacts and refuses ambiguous history/contact matches", async () => {
    mocks.rows.push(row({ status: "GOING", responded: true }));
    expect(
      (await previewGuestInvitations(EVENT, [{ contact: "guest@example.com" }])).recipients[0]
        .disposition
    ).toBe("responded");
    mocks.rows.push(row({ id: "duplicate" }));
    const preview = (await previewGuestInvitations(EVENT, [{ contact: "guest@example.com" }]))
      .recipients[0];
    expect(preview.disposition).toBe("conflict");
    const result = await sendGuestInvitations(EVENT, [
      {
        contact: "guest@example.com",
        expectedGuestName: "Established Name",
        expectedDisposition: "invited",
      },
    ]);
    expect(result.results[0].status).toBe("failed");
    expect(mocks.email).not.toHaveBeenCalled();
  });

  it.each([
    null,
    [],
    Array(201).fill({ contact: "a@example.com" }),
    [{ contact: "bad" }],
    [{ contact: "A@example.com" }, { contact: "a@example.com" }],
    [{ contact: "a@example.com", userId: "authority" }],
    [{ contact: "a@example.com", name: " " }],
    [{ contact: "a@example.com", name: "x".repeat(101) }],
  ])("rejects malformed preview inputs before contact lookup", async (input) => {
    await expect(previewGuestInvitations(EVENT, input)).rejects.toThrow();
    expect(mocks.findMany).not.toHaveBeenCalled();
  });
});

describe("#749 reviewed invitation sends and compatibility", () => {
  it("creates a named RSVP, personalizes its token-bearing email, and never writes the account name", async () => {
    const recipient = await reviewed("guest@example.com", "Jane Doe");
    mocks.email.mockImplementation(async () => {
      expect(mocks.activeTransactions).toBe(0);
    });
    const result = await sendGuestInvitations(EVENT, [recipient], "captcha");
    expect(result).toEqual({
      success: true,
      results: [{ contact: "guest@example.com", status: "sent", guestName: "Jane Doe" }],
    });
    expect(mocks.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ guestName: "Jane Doe", approved: true, status: "INVITED" }),
    });
    expect(mocks.userCreate).toHaveBeenCalledWith({
      data: { email: "guest@example.com", role: "GUEST" },
    });
    expect(mocks.email).toHaveBeenCalledWith(
      "guest@example.com",
      expect.objectContaining({
        guestName: "Jane Doe",
        rsvpBaseUrl: expect.stringContaining("/rsvp?token=new-secret-token"),
      })
    );
    expect(mocks.captcha).toHaveBeenCalledWith("host_invite", "captcha");
    expect(JSON.stringify(result)).not.toContain("token");
  });

  it("serializes concurrent reviewed-new sends and compares metadata after the parameterized lock", async () => {
    const recipient = await reviewed("guest@example.com", "Jane");
    let queue: Promise<unknown> = Promise.resolve();
    mocks.transaction.mockImplementation(
      (action: (client: Prisma.TransactionClient) => Promise<unknown>) => {
        const next = queue.then(() => action(db));
        queue = next.catch(() => undefined);
        return next;
      }
    );
    mocks.findMany.mockClear();
    const results = await Promise.all([
      sendGuestInvitations(EVENT, [recipient]),
      sendGuestInvitations(EVENT, [recipient]),
    ]);
    expect(results.map((result) => result.results[0].status).sort()).toEqual(["failed", "sent"]);
    expect(mocks.rows).toHaveLength(1);
    expect(mocks.create).toHaveBeenCalledTimes(1);
    expect(mocks.email).toHaveBeenCalledTimes(1);
    expect(mocks.executeRaw).toHaveBeenCalledTimes(2);
    for (const call of mocks.executeRaw.mock.calls) {
      expect(call[0].join("?")).toBe("SELECT pg_advisory_xact_lock(hashtext(?), hashtext(?))");
      expect(call.slice(1)).toEqual(["invitation:" + EVENT, "guest@example.com"]);
    }
    expect(mocks.executeRaw.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.findMany.mock.invocationCallOrder[0]
    );
    expect(results.find((result) => !result.success)?.results[0].error).toContain("changed");
  });

  it("retains established unlinked guest names on explicit resend and accepts historical empty comparison names", async () => {
    mocks.rows.push(row({ guestName: "" }));
    const recipient = await reviewed("guest@example.com", "Host suggestion");
    const result = await sendGuestInvitations(EVENT, [recipient]);
    expect(result.results[0]).toMatchObject({ status: "sent", guestName: "" });
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.userFind).not.toHaveBeenCalled();
    expect(mocks.email).toHaveBeenCalledWith(
      "guest@example.com",
      expect.objectContaining({
        guestName: "",
        rsvpBaseUrl: expect.stringContaining("secret-token"),
      })
    );
  });

  it("relinks orphan history without duplicate invitation records", async () => {
    mocks.history.push({ id: "orphan", eventId: EVENT, sentTo: "guest@example.com", rsvpId: null });
    const result = await sendGuestInvitations(EVENT, [await reviewed("guest@example.com", "Jane")]);
    expect(result.success).toBe(true);
    expect(mocks.historyCreate).not.toHaveBeenCalled();
    expect(mocks.historyUpdate).toHaveBeenCalledWith({
      where: { eventId: EVENT, id: { in: ["orphan"] }, rsvpId: null },
      data: { rsvpId: "new-0" },
    });
  });

  it.each(["name", "response"])("requires re-review when existing %s changes", async (change) => {
    mocks.rows.push(row());
    const recipient = await reviewed();
    if (change === "name") mocks.rows[0].guestName = "Guest correction";
    else mocks.rows[0].responded = true;
    const result = await sendGuestInvitations(EVENT, [recipient]);
    expect(result.results[0]).toMatchObject({
      status: "failed",
      error: expect.stringContaining("changed"),
    });
    expect(mocks.email).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("validates the entire modern array before fanout and applies channel/rate protections", async () => {
    const good = await reviewed();
    for (const input of [
      [good, { ...good, contact: "bad" }],
      [good, good],
      [{ ...good, rsvpId: "authority" }],
      [{ ...good, expectedDisposition: "conflict" }],
    ]) {
      await expect(sendGuestInvitations(EVENT, input)).rejects.toThrow();
    }
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.email).not.toHaveBeenCalled();
    mocks.channels.mockResolvedValue({ email: false, sms: true });
    expect((await sendGuestInvitations(EVENT, [good])).results[0].error).toContain("disabled");
    expect(mocks.create).not.toHaveBeenCalled();
    mocks.rate.mockResolvedValue({ success: false });
    await expect(sendGuestInvitations(EVENT, [good])).rejects.toThrow(/Too many/);
  });

  it("keeps partial successes, redacts provider failure details, and retries only reviewed failures", async () => {
    const first = await reviewed("a@example.com", "A");
    const second = await reviewed("b@example.com", "B");
    mocks.email.mockImplementation(async (contact: string) => {
      if (contact === "b@example.com") throw new Error("smtp-private-provider-secret");
    });
    const result = await sendGuestInvitations(EVENT, [first, second]);
    expect(result.success).toBe(true);
    expect(result.results.map((r) => r.status)).toEqual(["sent", "failed"]);
    expect(JSON.stringify(result)).not.toContain("smtp-private");
    mocks.email.mockResolvedValue(undefined);
    mocks.email.mockClear();
    const retry = await reviewed("b@example.com", "B");
    expect((await sendGuestInvitations(EVENT, [retry])).success).toBe(true);
    expect(mocks.email).toHaveBeenCalledTimes(1);
    expect(mocks.email.mock.calls[0][0]).toBe("b@example.com");
  });

  it("uses generic labels for new unnamed guests and validates friend trailing name without changing CAPTCHA position", async () => {
    await sendGuestInvitations(EVENT, [await reviewed()]);
    expect(mocks.rows[0].guestName).toBe("Guest");
    mocks.findUnique.mockResolvedValue({ ...row({ status: "GOING" }), event });
    const result = await inviteFriendAsGuest(
      EVENT,
      "inviter-token",
      "friend@example.com",
      "captcha",
      "Friend Name"
    );
    expect(result.success).toBe(true);
    expect(mocks.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ guestName: "Friend Name", approved: false }),
    });
    expect(mocks.captcha).toHaveBeenCalledWith("guest_invite", "captcha");
    expect(
      (await inviteFriendAsGuest(EVENT, "inviter-token", "bad@example.com", null, " ")).success
    ).toBe(false);
    expect(
      (await inviteFriendAsGuest(EVENT, "inviter-token", "a@example.com,b@example.com")).success
    ).toBe(false);
  });
});

describe("#749 RSVP name corrections", () => {
  it("saves token-authorized guest names and uses the effective name in current activity", async () => {
    mocks.findUnique.mockResolvedValue({
      ...row({ status: "GOING", responded: true }),
      event,
      checkIn: { id: "check" },
    });
    expect(
      (await updateRSVP("secret-token", { status: "NO", guestName: "  Corrected Name  " })).success
    ).toBe(true);
    expect(mocks.update).toHaveBeenCalledWith({
      where: { editToken: "secret-token" },
      data: expect.objectContaining({ guestName: "Corrected Name" }),
    });
    expect(mocks.activity).toHaveBeenCalledWith(
      EVENT,
      "rsvp_update",
      expect.stringContaining("Corrected Name"),
      "Corrected Name"
    );
    expect(mocks.activity).toHaveBeenCalledWith(
      EVENT,
      "check_in_undo",
      expect.stringContaining("Corrected Name"),
      "Corrected Name"
    );
    expect(mocks.revalidate).toHaveBeenCalledWith("/e/party/guests");
    expect(mocks.userFind).not.toHaveBeenCalled();
  });

  it.each(["", " ", "x".repeat(101)])(
    "rejects blank/overlong guest and organizer names",
    async (guestName) => {
      expect((await updateRSVP("secret-token", { status: "NO", guestName })).success).toBe(false);
      expect((await updateRsvpAsHost("rsvp", { status: "NO", guestName })).success).toBe(false);
      expect(mocks.update).not.toHaveBeenCalled();
    }
  );

  it("omits name writes when absent; organizer corrections still require host authority", async () => {
    await updateRSVP("secret-token", { status: "NO" });
    expect(mocks.update.mock.calls[0][0].data).not.toHaveProperty("guestName");
    await updateRsvpAsHost("rsvp", { status: "NO", guestName: "Organizer correction" });
    expect(mocks.update).toHaveBeenLastCalledWith({
      where: { id: "rsvp" },
      data: expect.objectContaining({ guestName: "Organizer correction" }),
    });
    mocks.session.mockResolvedValue({ userId: "stranger", role: "HOST" });
    await expect(
      updateRsvpAsHost("rsvp", { status: "NO", guestName: "Unauthorized" })
    ).rejects.toThrow("Forbidden");
    mocks.findUnique.mockResolvedValue(null);
    expect(
      (await updateRSVP("bad-token", { status: "NO", guestName: "Unauthorized" })).success
    ).toBe(false);
  });
});

describe("#749 personalized invitation email preview", () => {
  it("uses the supplied name only for invite previews without delivery or account lookup", async () => {
    mocks.event.mockResolvedValue({ ...event, hostDisplayName: "Event Host Override" });
    const preview = await getEventEmailPreview(EVENT, "invite", "Preview Guest");
    expect(preview.html).toContain("Preview Guest");
    expect(preview.html).toContain("Event Host Override");
    expect(preview.html).not.toContain("Alex Sample");
    expect(preview.subject).toBeTruthy();
    expect(mocks.email).not.toHaveBeenCalled();
    expect(mocks.rendered).not.toHaveBeenCalled();
    expect(mocks.userFind).not.toHaveBeenCalled();
    await expect(getEventEmailPreview(EVENT, "invite", " ")).rejects.toThrow();
    await expect(getEventEmailPreview(EVENT, "blast", "Preview Guest")).rejects.toThrow();
    mocks.session.mockResolvedValue(null);
    await expect(getEventEmailPreview(EVENT, "invite", "Preview Guest")).rejects.toThrow(
      "Unauthorized"
    );
  });
});
