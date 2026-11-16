// #880 root cause: Unlisted links used titles and sequential suffixes. Hosts
// could neither choose nor rotate them. URL changes now preserve server-generated
// provenance, require explicit Unlisted/link-break decisions and reject stale writes.
import "@/tests/helpers/english-request-locale";
import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({
  find: vi.fn(),
  update: vi.fn(),
  session: vi.fn(),
  captcha: vi.fn(),
  revalidate: vi.fn(),
  randomInt: vi.fn(),
}));
vi.mock("@/lib/db", () => ({ db: { event: { findUnique: m.find, updateMany: m.update } } }));
vi.mock("@/lib/session", () => ({ getSession: m.session }));
vi.mock("@/lib/captcha", () => ({ assertCaptcha: m.captcha }));
vi.mock("next/cache", () => ({ revalidatePath: m.revalidate }));
vi.mock("crypto", async (original) => ({
  ...(await original<typeof import("crypto")>()),
  randomInt: m.randomInt,
}));
import { generateRandomSlug, generateUniqueSlug } from "@/lib/slug";
import { readUrlCode, signUrlCode } from "@/lib/event-url-proof";
import { previewEventUrl, saveEventUrl } from "@/app/actions/event/urls";
import type { SaveEventUrlInput } from "@/lib/event-url-shared";

const event = {
  id: "event",
  hostId: "host",
  coHosts: [{ userId: "cohost" }],
  slug: "K7m2Qa",
  slugRandomCode: "K7m2Qa",
  visibility: "UNLISTED",
};
const input: SaveEventUrlInput = {
  expectedSlug: event.slug,
  expectedVisibility: "UNLISTED",
  slug: "thanksgiving",
  visibility: "UNLISTED",
};
beforeEach(() => {
  vi.resetAllMocks();
  m.session.mockResolvedValue({ userId: "host", role: "HOST" });
  m.find.mockResolvedValue(event);
  m.update.mockResolvedValue({ count: 1 });
  m.randomInt.mockReturnValue(0);
});

describe("#880 generated links", () => {
  it.each(["UNLISTED", "PRIVATE"] as const)(
    "starts %s with an opaque alphanumeric code",
    async (visibility) => {
      m.find.mockResolvedValue(null);
      const slug = await generateUniqueSlug("Thanksgiving", visibility);
      expect(slug).toMatch(/^[A-Za-z0-9]{6}$/);
      expect(slug).not.toContain("thanksgiving");
      expect(m.find).toHaveBeenCalledTimes(1);
    }
  );
  it("keeps readable public links", async () => {
    m.find.mockResolvedValue(null);
    expect(await generateUniqueSlug("Thanksgiving", "PUBLIC")).toBe("thanksgiving");
  });
  it("retries collisions and grows from six to eight, then ten characters", async () => {
    m.find
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce(null);
    expect(await generateRandomSlug()).toEqual({ slug: "AAAAAAAA", code: "AAAAAAAA" });
    m.find.mockReset().mockResolvedValue({});
    m.find.mockImplementation(({ where }: { where: { slug: string } }) =>
      Promise.resolve(where.slug.length < 10 ? {} : null)
    );
    expect((await generateRandomSlug()).code).toHaveLength(10);
  });
  it("bounds a fully colliding namespace", async () => {
    m.find.mockResolvedValue({});
    await expect(generateRandomSlug()).rejects.toThrow(/unique slug/);
    expect(m.find).toHaveBeenCalledTimes(16);
  });
  it("issues event-bound, expiring proofs and rejects tampering", () => {
    const proof = signUrlCode("event", "K7m2Qa");
    expect(readUrlCode("event", proof)).toBe("K7m2Qa");
    expect(readUrlCode("other-event", proof)).toBeNull();
    expect(readUrlCode("event", proof.replace("K7m2Qa", "aaaaaa"))).toBeNull();
    expect(readUrlCode("event", "garbage")).toBeNull();
    expect(readUrlCode("event")).toBeNull();
    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 16 * 60 * 1000);
    expect(readUrlCode("event", proof)).toBeNull();
    vi.useRealTimers();
  });
});

describe("#880 URL mutations", () => {
  it.each([null, { userId: "other", role: "HOST" }])(
    "denies unrelated/anonymous callers",
    async (session) => {
      m.session.mockResolvedValue(session);
      await expect(saveEventUrl("event", input)).rejects.toThrow();
      await expect(previewEventUrl("event", "")).rejects.toThrow();
      expect(m.update).not.toHaveBeenCalled();
    }
  );
  it("requires both the guessability and broken-link decisions", async () => {
    expect(await saveEventUrl("event", input)).toEqual({
      success: false,
      error: "confirmGuessable",
    });
    expect(await saveEventUrl("event", { ...input, allowGuessable: true })).toEqual({
      success: false,
      error: "confirmChange",
    });
    expect(m.update).not.toHaveBeenCalled();
    expect(
      await saveEventUrl("event", { ...input, allowGuessable: true, confirmLinkChange: true })
    ).toEqual({ success: true, slug: "thanksgiving", visibility: "UNLISTED", randomCode: null });
    expect(m.captcha).toHaveBeenCalledWith("event_settings", undefined);
  });
  it("retains existing generated provenance when a readable prefix is added", async () => {
    const result = await saveEventUrl("event", {
      ...input,
      slug: "thanksgiving-K7m2Qa",
      confirmLinkChange: true,
    });
    expect(result).toEqual({
      success: true,
      slug: "thanksgiving-K7m2Qa",
      randomCode: "K7m2Qa",
      visibility: "UNLISTED",
    });
    expect(m.revalidate).toHaveBeenCalledWith("/e/K7m2Qa", "layout");
    expect(m.revalidate).toHaveBeenCalledWith("/e/thanksgiving-K7m2Qa", "layout");
  });
  it("does not mistake an arbitrary six-character custom name for a generated code", async () => {
    expect(
      await saveEventUrl("event", { ...input, slug: "secret", confirmLinkChange: true })
    ).toEqual({ success: false, error: "confirmGuessable" });
  });
  it("saves a valid server-generated preview, including for a co-host", async () => {
    m.session.mockResolvedValue({ userId: "cohost", role: "HOST" });
    m.find.mockResolvedValueOnce(event).mockResolvedValueOnce(null);
    const proposal = await previewEventUrl("event", "thanksgiving");
    expect(proposal.slug).toBe("thanksgiving-AAAAAA");
    m.find.mockResolvedValue(event);
    const result = await saveEventUrl("event", {
      ...input,
      slug: proposal.slug,
      generatedProof: proposal.proof,
      confirmLinkChange: true,
    });
    expect(result).toMatchObject({ success: true, randomCode: "AAAAAA" });
  });
  it("requires consent when an existing readable public link becomes Unlisted", async () => {
    m.find.mockResolvedValue({
      ...event,
      slug: "thanksgiving",
      slugRandomCode: null,
      visibility: "PUBLIC",
    });
    const request = {
      ...input,
      slug: "thanksgiving",
      expectedSlug: "thanksgiving",
      expectedVisibility: "PUBLIC" as const,
    };
    expect(await saveEventUrl("event", request)).toEqual({
      success: false,
      error: "confirmGuessable",
    });
    expect(await saveEventUrl("event", { ...request, allowGuessable: true })).toMatchObject({
      success: true,
      visibility: "UNLISTED",
    });
  });
  it.each(["PUBLIC", "PRIVATE"] as const)(
    "allows a readable custom %s URL without an Unlisted warning",
    async (visibility) => {
      expect(
        await saveEventUrl("event", { ...input, visibility, confirmLinkChange: true })
      ).toMatchObject({ success: true, visibility });
    }
  );
  it("rejects invalid, stale and racing writes without changing state", async () => {
    expect(await saveEventUrl("event", { ...input, slug: "../admin" })).toEqual({
      success: false,
      error: "invalid",
    });
    expect(await saveEventUrl("event", { ...input, expectedSlug: "stale" })).toEqual({
      success: false,
      error: "stale",
    });
    m.update.mockResolvedValueOnce({ count: 0 });
    expect(
      await saveEventUrl("event", { ...input, allowGuessable: true, confirmLinkChange: true })
    ).toEqual({ success: false, error: "stale" });
    m.update.mockRejectedValueOnce({ code: "P2002" });
    expect(
      await saveEventUrl("event", { ...input, allowGuessable: true, confirmLinkChange: true })
    ).toEqual({ success: false, error: "taken" });
    expect(m.revalidate).not.toHaveBeenCalled();
  });
  it("does not hide infrastructure or CAPTCHA failures", async () => {
    m.update.mockRejectedValueOnce(new Error("database unavailable"));
    await expect(
      saveEventUrl("event", { ...input, allowGuessable: true, confirmLinkChange: true })
    ).rejects.toThrow("database unavailable");
    m.captcha.mockRejectedValueOnce(new Error("captcha failed"));
    await expect(saveEventUrl("event", input)).rejects.toThrow("captcha failed");
  });
});
