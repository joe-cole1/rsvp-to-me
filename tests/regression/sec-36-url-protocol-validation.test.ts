// SEC-36 — host-supplied URLs rendered as links without protocol validation.
//
// Bug (found 2026-07, [cd6748] OWASP audit): `virtualUrl` (CreateEventSchema /
// saveEventField / saveEventLocation) and info-section `url` (addInfoSection /
// updateInfoSection) were persisted with only a length cap and rendered into
// guest-facing <a href> (LocationEdit, InfoSectionsBlock). A malicious host —
// anyone, under open registration — could store a javascript:/data: URI that
// executes in a guest's browser on click.
//
// Fix: `HttpUrlSchema` in lib/schemas.ts — only http(s) URLs are persisted.
// Bare scheme-less pastes ("zoom.us/j/…") are auto-prefixed with https:// so
// the normal host workflow keeps working; explicit non-http schemes throw.

import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockAssertHostOrCohost, mockSectionCreate, mockSectionFindUnique, mockSectionUpdate } =
  vi.hoisted(() => ({
    mockAssertHostOrCohost: vi.fn(),
    mockSectionCreate: vi.fn(),
    mockSectionFindUnique: vi.fn(),
    mockSectionUpdate: vi.fn(),
  }));

vi.mock("@/lib/db", () => ({
  db: {
    event: { update: vi.fn() },
    eventInfoSection: {
      create: mockSectionCreate,
      findUnique: mockSectionFindUnique,
      update: mockSectionUpdate,
      delete: vi.fn(),
    },
  },
}));
vi.mock("@/lib/auth-guards", () => ({
  assertHost: vi.fn(),
  assertHostOrCohost: mockAssertHostOrCohost,
  assertAdmin: vi.fn(),
}));
vi.mock("@/lib/session", () => ({ getSession: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/activity", () => ({
  logActivity: vi.fn().mockResolvedValue(null),
  iconLabel: vi.fn().mockReturnValue("Link"),
}));
vi.mock("@/lib/utils", () => ({ tzLocalToUtc: vi.fn() }));

import { CreateEventSchema, HttpUrlSchema } from "@/lib/schemas";
import { addInfoSection, updateInfoSection } from "@/app/actions/event/infoSections";
import { saveEventField, saveEventLocation } from "@/app/actions/event/settings";

const EVENT = { id: "evt-1", slug: "party", hostId: "host-1", coHosts: [] };

beforeEach(() => {
  vi.clearAllMocks();
  mockAssertHostOrCohost.mockResolvedValue(EVENT);
  mockSectionCreate.mockResolvedValue({ id: "sec-1" });
  mockSectionFindUnique.mockResolvedValue({
    id: "sec-1",
    eventId: "evt-1",
    type: "link",
    event: { slug: "party" },
  });
});

describe("SEC-36: HttpUrlSchema", () => {
  it("rejects javascript: and data: URIs", () => {
    expect(() => HttpUrlSchema.parse("javascript:alert(document.cookie)")).toThrow();
    expect(() => HttpUrlSchema.parse("data:text/html,<script>x</script>")).toThrow();
  });

  it("accepts http(s) URLs unchanged and auto-prefixes bare domains", () => {
    expect(HttpUrlSchema.parse("https://zoom.us/j/123")).toBe("https://zoom.us/j/123");
    expect(HttpUrlSchema.parse("HTTP://example.com")).toBe("HTTP://example.com");
    expect(HttpUrlSchema.parse("zoom.us/j/123")).toBe("https://zoom.us/j/123");
  });
});

describe("SEC-36: CreateEventSchema.virtualUrl", () => {
  const base = {
    title: "Party",
    startDate: "2026-12-01",
    startTime: "20:00",
  };

  it("rejects a javascript: virtualUrl", () => {
    expect(() => CreateEventSchema.parse({ ...base, virtualUrl: "javascript:alert(1)" })).toThrow();
  });

  it("still allows empty / null virtualUrl", () => {
    expect(CreateEventSchema.parse({ ...base, virtualUrl: "" }).virtualUrl).toBe("");
    expect(CreateEventSchema.parse({ ...base, virtualUrl: null }).virtualUrl).toBeNull();
  });
});

describe("SEC-36: saveEventField / saveEventLocation", () => {
  it("rejects a javascript: virtual link before writing", async () => {
    await expect(saveEventField("evt-1", "virtualUrl", "javascript:alert(1)")).rejects.toThrow();
  });

  it("persists the https-normalized virtual link", async () => {
    const { db } = await import("@/lib/db");
    await saveEventField("evt-1", "virtualUrl", "zoom.us/j/123");
    expect(db.event.update).toHaveBeenCalledWith({
      where: { id: "evt-1" },
      data: { virtualUrl: "https://zoom.us/j/123" },
    });
  });

  it("saveEventLocation rejects a data: virtual link", async () => {
    await expect(
      saveEventLocation("evt-1", {
        locationType: "VIRTUAL",
        locationName: null,
        locationAddress: null,
        virtualUrl: "data:text/html,x",
      })
    ).rejects.toThrow();
  });
});

describe("SEC-36: info-section URLs", () => {
  it("addInfoSection rejects a javascript: url", async () => {
    await expect(
      addInfoSection({
        eventId: "evt-1",
        type: "link",
        title: null,
        content: "Click here",
        url: "javascript:alert(1)",
        order: 0,
      })
    ).rejects.toThrow();
    expect(mockSectionCreate).not.toHaveBeenCalled();
  });

  it("updateInfoSection rejects a javascript: url", async () => {
    await expect(
      updateInfoSection("sec-1", { content: "Click here", url: "javascript:alert(1)" })
    ).rejects.toThrow();
    expect(mockSectionUpdate).not.toHaveBeenCalled();
  });

  it("addInfoSection persists a normalized https url", async () => {
    await addInfoSection({
      eventId: "evt-1",
      type: "link",
      title: null,
      content: "Album",
      url: "photos.example.com/album",
      order: 0,
    });
    expect(mockSectionCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ url: "https://photos.example.com/album" }),
    });
  });
});
