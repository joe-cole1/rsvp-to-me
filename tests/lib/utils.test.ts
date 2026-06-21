import { describe, it, expect } from "vitest";
import { cn, tzLocalToUtc } from "@/lib/utils";

describe("cn (clsx + tailwind-merge)", () => {
  it("returns single class unchanged", () => {
    expect(cn("px-4")).toBe("px-4");
  });

  it("merges conflicting tailwind utilities, keeping last", () => {
    expect(cn("px-4 px-6")).toBe("px-6");
    expect(cn("text-red-500 text-blue-500")).toBe("text-blue-500");
  });

  it("conditional: cn('a', false && 'b') → 'a'", () => {
    expect(cn("a", false && "b")).toBe("a");
  });

  it("conditional: cn('a', true && 'b') → 'a b'", () => {
    expect(cn("a", true && "b")).toBe("a b");
  });

  it("handles array input", () => {
    expect(cn(["a", "b"])).toBe("a b");
  });

  it("handles object input", () => {
    expect(cn({ a: true, b: false, c: true })).toBe("a c");
  });

  it("handles empty input", () => {
    expect(cn()).toBe("");
  });
});

describe("tzLocalToUtc", () => {
  it("America/New_York (UTC-5 in December): '2026-12-01T19:00' → '2026-12-02T00:00:00.000Z'", () => {
    const result = tzLocalToUtc("2026-12-01T19:00", "America/New_York");
    expect(result.toISOString()).toBe("2026-12-02T00:00:00.000Z");
  });

  it("America/New_York (UTC-4 in July): '2026-07-04T19:00' → '2026-07-04T23:00:00.000Z'", () => {
    const result = tzLocalToUtc("2026-07-04T19:00", "America/New_York");
    expect(result.toISOString()).toBe("2026-07-04T23:00:00.000Z");
  });

  it("UTC timezone: '2026-01-01T12:00' → '2026-01-01T12:00:00.000Z'", () => {
    const result = tzLocalToUtc("2026-01-01T12:00", "UTC");
    expect(result.toISOString()).toBe("2026-01-01T12:00:00.000Z");
  });

  it("America/Chicago (UTC-6 in December): '2026-12-01T18:00' → '2026-12-02T00:00:00.000Z'", () => {
    const result = tzLocalToUtc("2026-12-01T18:00", "America/Chicago");
    expect(result.toISOString()).toBe("2026-12-02T00:00:00.000Z");
  });

  it("Europe/London (UTC+0 in winter): '2026-01-01T12:00' → '2026-01-01T12:00:00.000Z'", () => {
    const result = tzLocalToUtc("2026-01-01T12:00", "Europe/London");
    expect(result.toISOString()).toBe("2026-01-01T12:00:00.000Z");
  });

  it("Europe/Paris (UTC+1 in winter): '2026-01-01T12:00' → '2026-01-01T11:00:00.000Z'", () => {
    const result = tzLocalToUtc("2026-01-01T12:00", "Europe/Paris");
    expect(result.toISOString()).toBe("2026-01-01T11:00:00.000Z");
  });

  it("returns a Date object (not a string)", () => {
    const result = tzLocalToUtc("2026-01-01T12:00", "UTC");
    expect(result).toBeInstanceOf(Date);
  });
});
