// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { testTheme } from "./helpers/theme";
import { buildStyles } from "@/components/event/event-page/styles";
import { EventHero } from "@/components/event/event-page/EventHero";
import React from "react";
import type { EventData } from "@/components/event/event-page/types";

// Mock global.Image
let mockImageInstance: MockImage | null = null;
class MockImage {
  _src: string = "";
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  naturalWidth: number = 0;
  naturalHeight: number = 0;

  constructor() {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    mockImageInstance = this;
  }

  set src(val: string) {
    this._src = val;
  }
  get src() {
    return this._src;
  }
}

global.Image = MockImage as unknown as typeof Image;

const baseEvent = {
  id: "event-1",
  slug: "test-party",
  title: "Test Party",
  description: "Description",
  startAt: new Date("2030-12-01T20:00:00Z"),
  endAt: null,
  timezone: "America/New_York",
  locationType: "PHYSICAL",
  locationName: "My House",
  locationAddress: "123 Main St",
  virtualUrl: null,
  host: {
    name: "Host User",
    email: "host@example.com",
  },
  theme: {
    coverImageUrl: null,
    baseTheme: "DARK",
    gradientFrom: "#7c3aed",
    gradientTo: "#1e40af",
    accentColor: "#a855f7",
    cardOpacity: 0.85,
  },
  infoSections: [],
  rsvps: [],
  comments: [],
  rsvpFields: [],
  updates: [],
  potluckItems: [],
  rsvpDeadline: null,
  pendingRsvps: [],
  activityEvents: [],
  polls: [],
  coHosts: [],
} as unknown as EventData;

const mockSetEvent = vi.fn();
const mockSave = vi.fn();
const mockHandleCoverRemove = vi.fn();
const mockHandleCoverUpload = vi.fn();

describe("EventHero", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockImageInstance = null;
  });

  it("renders with default height when there is no cover image", () => {
    const S = buildStyles(testTheme);
    const detailsRef = React.createRef<HTMLSpanElement>();
    const titleRef = React.createRef<HTMLSpanElement>();
    const fileInputRef = React.createRef<HTMLInputElement>();

    render(
      <EventHero
        event={baseEvent}
        setEvent={mockSetEvent}
        detailsRef={detailsRef}
        titleRef={titleRef}
        fileInputRef={fileInputRef}
        renderAvatar={(name) => <div>{name[0]}</div>}
        isUploading={false}
        isPending={false}
        t={testTheme}
        save={mockSave}
        uploadStatus="idle"
        handleCoverRemove={mockHandleCoverRemove}
        handleCoverUpload={mockHandleCoverUpload}
        S={S}
        coverStyle={{}}
        isHost={true}
        coverUploadEnabled={true}
      />
    );

    // Find the cover image container
    const coverContainer = screen.getByText("🎉").parentElement;
    expect(coverContainer).toBeInTheDocument();

    // Assert style height is 260px (fallback)
    expect(coverContainer?.style.height).toBe("260px");
    expect(coverContainer?.style.minHeight).toBe("260px");
    expect(coverContainer?.style.maxHeight).toBe("260px");
  });

  it("renders with fallback height initially when a cover image is provided, then adapts after loading", () => {
    const eventWithCover = {
      ...baseEvent,
      theme: {
        ...baseEvent.theme!,
        coverImageUrl: "https://example.com/cover.jpg",
      },
    };
    const S = buildStyles(testTheme);
    const detailsRef = React.createRef<HTMLSpanElement>();
    const titleRef = React.createRef<HTMLSpanElement>();
    const fileInputRef = React.createRef<HTMLInputElement>();

    render(
      <EventHero
        event={eventWithCover}
        setEvent={mockSetEvent}
        detailsRef={detailsRef}
        titleRef={titleRef}
        fileInputRef={fileInputRef}
        renderAvatar={(name) => <div>{name[0]}</div>}
        isUploading={false}
        isPending={false}
        t={testTheme}
        save={mockSave}
        uploadStatus="idle"
        handleCoverRemove={mockHandleCoverRemove}
        handleCoverUpload={mockHandleCoverUpload}
        S={S}
        coverStyle={{}}
        isHost={true}
        coverUploadEnabled={true}
      />
    );

    const coverButton = screen.getByText("📷 Cover");
    const coverContainer = coverButton.parentElement?.parentElement;
    expect(coverContainer).toBeInTheDocument();

    // Initially height should be 260px
    expect(coverContainer?.style.height).toBe("260px");
    expect(coverContainer?.style.minHeight).toBe("200px");
    expect(coverContainer?.style.maxHeight).toBe("450px");

    // Simulate image onload with a 16:9 image (1600x900)
    expect(mockImageInstance).not.toBeNull();
    act(() => {
      mockImageInstance!.naturalWidth = 1600;
      mockImageInstance!.naturalHeight = 900;
      mockImageInstance!.onload?.();
    });

    // Now height should be auto, and aspect ratio should be set
    expect(coverContainer?.style.height).toBe("auto");
    expect(coverContainer?.style.aspectRatio).toContain("1.7777777777777777");
  });
});
