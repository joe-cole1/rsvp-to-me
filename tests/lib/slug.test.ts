import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockEventFindUnique } = vi.hoisted(() => ({
  mockEventFindUnique: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    event: {
      findUnique: mockEventFindUnique,
    },
  },
}));

import { slugify, generateUniqueSlug } from "@/lib/slug";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("slugify", () => {
  it("lowercases input", () => {
    expect(slugify("Summer Party")).toBe("summer-party");
  });

  it("replaces spaces with hyphens", () => {
    expect(slugify("a b c")).toBe("a-b-c");
  });

  it("strips special characters", () => {
    expect(slugify("Party!!!")).toBe("party");
  });

  it("trims leading/trailing whitespace", () => {
    expect(slugify("  party  ")).toBe("party");
  });

  it("collapses consecutive hyphens", () => {
    expect(slugify("a--b")).toBe("a-b");
  });

  it("strips leading/trailing hyphens", () => {
    expect(slugify("-party-")).toBe("party");
  });

  it("replaces underscores with hyphens", () => {
    expect(slugify("my_event")).toBe("my-event");
  });

  it("limits to 50 characters", () => {
    const longString = "a".repeat(60);
    const slug = slugify(longString);
    expect(slug.length).toBe(50);
  });

  it("returns empty string for empty input", () => {
    expect(slugify("")).toBe("");
  });

  it("preserves numbers", () => {
    expect(slugify("Party 2026")).toBe("party-2026");
  });
});

describe("generateUniqueSlug", () => {
  it("returns the base slug when no conflict exists", async () => {
    mockEventFindUnique.mockResolvedValue(null);
    const result = await generateUniqueSlug("Wine Night");
    expect(result).toBe("wine-night");
    expect(mockEventFindUnique).toHaveBeenCalledWith({
      where: { slug: "wine-night" },
    });
  });

  it("returns 'base-1' when base is taken", async () => {
    mockEventFindUnique
      .mockResolvedValueOnce({ id: "event-1", slug: "wine-night" })
      .mockResolvedValueOnce(null);

    const result = await generateUniqueSlug("Wine Night");
    expect(result).toBe("wine-night-1");
    expect(mockEventFindUnique).toHaveBeenCalledTimes(2);
  });

  it("returns 'base-2' when base and base-1 are both taken", async () => {
    mockEventFindUnique
      .mockResolvedValueOnce({ id: "event-1", slug: "wine-night" })
      .mockResolvedValueOnce({ id: "event-2", slug: "wine-night-1" })
      .mockResolvedValueOnce(null);

    const result = await generateUniqueSlug("Wine Night");
    expect(result).toBe("wine-night-2");
    expect(mockEventFindUnique).toHaveBeenCalledTimes(3);
  });

  it("returns 'event' when title slugifies to empty string", async () => {
    mockEventFindUnique.mockResolvedValue(null);
    const result = await generateUniqueSlug("!!!");
    expect(result).toBe("event");
  });
});
