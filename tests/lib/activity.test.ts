import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockActivityCreate } = vi.hoisted(() => ({
  mockActivityCreate: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    activityEvent: {
      create: mockActivityCreate,
    },
  },
}));

import { iconLabel, logActivity } from "@/lib/activity";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("iconLabel", () => {
  it("'shirt' → 'dress code'", () => {
    expect(iconLabel("shirt")).toBe("dress code");
  });

  it("'utensils' → 'food'", () => {
    expect(iconLabel("utensils")).toBe("food");
  });

  it("known keys return correct labels", () => {
    expect(iconLabel("parking")).toBe("parking");
    expect(iconLabel("link")).toBe("link");
    expect(iconLabel("info")).toBe("info");
    expect(iconLabel("music")).toBe("music");
    expect(iconLabel("gift")).toBe("gifts");
    expect(iconLabel("bed")).toBe("accommodation");
    expect(iconLabel("mappin")).toBe("location");
    expect(iconLabel("calendar")).toBe("schedule");
    expect(iconLabel("sparkles")).toBe("vibes");
    expect(iconLabel("filetext")).toBe("note");
    expect(iconLabel("camera")).toBe("photos");
    expect(iconLabel("phone")).toBe("contact");
    expect(iconLabel("zelle")).toBe("Zelle");
    expect(iconLabel("venmo")).toBe("Venmo");
  });

  it("unknown key returns the key itself as fallback", () => {
    expect(iconLabel("unknown-icon")).toBe("unknown-icon");
  });
});

describe("logActivity", () => {
  it("calls db.activityEvent.create with eventId, type, detail, and actorName", async () => {
    const mockCreated = {
      id: "act-1",
      eventId: "evt-1",
      type: "rsvp",
      detail: "Guest RSVP'd",
      actorName: "Alice",
    };
    mockActivityCreate.mockResolvedValue(mockCreated);

    const result = await logActivity("evt-1", "rsvp", "Guest RSVP'd", "Alice");
    expect(result).toEqual(mockCreated);
    expect(mockActivityCreate).toHaveBeenCalledWith({
      data: {
        eventId: "evt-1",
        type: "rsvp",
        detail: "Guest RSVP'd",
        actorName: "Alice",
      },
    });
  });

  it("sets actorName to null when not provided", async () => {
    mockActivityCreate.mockResolvedValue({});
    await logActivity("evt-1", "rsvp", "Guest RSVP'd");
    expect(mockActivityCreate).toHaveBeenCalledWith({
      data: {
        eventId: "evt-1",
        type: "rsvp",
        detail: "Guest RSVP'd",
        actorName: null,
      },
    });
  });
});
