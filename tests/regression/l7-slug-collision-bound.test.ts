// L-7 — generateUniqueSlug had an unbounded sequential retry loop.
//
// Bug (found 2026-07, security review): on a slug collision the generator
// probed base, base-1, base-2, … with one DB query each and no upper bound.
// A large (or adversarial) number of same-title events turned event creation
// into an O(n) query scan — and with this test's "every numeric suffix is
// taken" fixture, the old implementation never terminated at all (this file
// timed out before the fix).
//
// Fix: the friendly sequential probe is capped at 10 attempts; after that the
// generator switches to CSPRNG hex suffixes with growing entropy (4 attempts),
// then fails loudly instead of looping forever.
//
// BUG-02 (found 2026-07): the first test here was flaky. With real
// randomBytes(3) there is a ~6% chance ((10/16)^6) that all six hex chars are
// decimal digits, which the "every base-<number> candidate is taken" fixture
// then counts as a collision — so the generator moved on to randomBytes(4)
// and returned an 8-char suffix (e.g. my-party-9f2b2b91), failing the {6}
// assertion. randomBytes is now stubbed to a fixed letter-bearing buffer so
// the probe counts and suffix length are deterministic.

import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockEventFindUnique } = vi.hoisted(() => ({
  mockEventFindUnique: vi.fn(),
}));

vi.mock("crypto", async (importOriginal) => {
  const actual = await importOriginal<typeof import("crypto")>();
  return {
    ...actual,
    // Deterministic stand-in: hex output is "abab…" (always contains letters).
    randomBytes: (size: number) => Buffer.alloc(size, 0xab),
  };
});

vi.mock("@/lib/db", () => ({
  db: { event: { findUnique: mockEventFindUnique } },
}));

import { generateUniqueSlug } from "@/lib/slug";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("L-7: generateUniqueSlug collision probing is bounded", () => {
  it("falls back to a random hex suffix when every sequential candidate is taken", async () => {
    // base and every base-<number> candidate collide; anything else is free.
    const sequentialSlugs = new Set([
      "my-party",
      ...Array.from({ length: 10 }, (_, i) => `my-party-${i + 1}`),
    ]);
    mockEventFindUnique.mockImplementation(({ where }: { where: { slug: string } }) =>
      Promise.resolve(sequentialSlugs.has(where.slug) ? { id: "taken" } : null)
    );

    const result = await generateUniqueSlug("My Party");

    // 6-char hex suffix, and (because all-numeric suffixes collide in this
    // fixture) necessarily containing a letter — i.e. not a sequential number.
    expect(result).toMatch(/^my-party-[0-9a-f]{6}$/);
    expect(result).not.toMatch(/^my-party-\d+$/);
    // 10 sequential probes + 1 successful random probe.
    expect(mockEventFindUnique).toHaveBeenCalledTimes(11);
  });

  it("performs a bounded number of queries and fails loudly when everything collides", async () => {
    mockEventFindUnique.mockResolvedValue({ id: "always-taken" });

    await expect(generateUniqueSlug("My Party")).rejects.toThrow(
      /Could not generate a unique slug/
    );
    // Hard bound: 10 sequential + 4 random probes, never an unbounded scan.
    expect(mockEventFindUnique).toHaveBeenCalledTimes(14);
  });

  it("keeps the friendly sequential path for ordinary collisions", async () => {
    mockEventFindUnique
      .mockResolvedValueOnce({ id: "taken" })
      .mockResolvedValueOnce({ id: "taken" })
      .mockResolvedValueOnce(null);

    await expect(generateUniqueSlug("My Party")).resolves.toBe("my-party-2");
  });
});
