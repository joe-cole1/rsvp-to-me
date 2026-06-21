import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockDestroySession: vi.fn(),
  mockUserFindUnique: vi.fn(),
  mockEventCreate: vi.fn(),
  mockGenerateUniqueSlug: vi.fn().mockResolvedValue("my-party"),
  mockRedirect: vi.fn(),
}));

vi.mock("@/lib/session", () => ({
  getSession: mocks.mockGetSession,
  destroySession: mocks.mockDestroySession,
}));

vi.mock("@/lib/db", () => ({
  db: {
    user: {
      findUnique: mocks.mockUserFindUnique,
    },
    event: {
      create: mocks.mockEventCreate,
    },
  },
}));

vi.mock("@/lib/slug", () => ({
  generateUniqueSlug: mocks.mockGenerateUniqueSlug,
}));

vi.mock("next/navigation", () => ({
  redirect: mocks.mockRedirect,
}));

import { createEvent } from "@/app/actions/createEvent";

function makeFormData(data: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(data)) {
    fd.append(k, v);
  }
  return fd;
}

const validInput = {
  title: "Wine Night",
  startDate: "2026-12-01",
  startTime: "19:00",
  timezone: "America/New_York",
  locationType: "PHYSICAL",
  visibility: "UNLISTED",
};

beforeEach(() => {
  vi.clearAllMocks();
  // Set redirect mock implementation to throw an error that we can catch
  mocks.mockRedirect.mockImplementation((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  });
});

describe("createEvent", () => {
  it("throws Unauthorized when no session", async () => {
    mocks.mockGetSession.mockResolvedValue(null);
    const fd = makeFormData(validInput);

    await expect(createEvent(fd)).rejects.toThrow("Unauthorized");
  });

  it("throws Unauthorized when session role is GUEST", async () => {
    mocks.mockGetSession.mockResolvedValue({ userId: "guest-1", role: "GUEST" });
    const fd = makeFormData(validInput);

    await expect(createEvent(fd)).rejects.toThrow("Unauthorized");
  });

  it("calls destroySession and redirects to sign-in when user not found in DB", async () => {
    mocks.mockGetSession.mockResolvedValue({ userId: "stale-id", role: "HOST" });
    mocks.mockUserFindUnique.mockResolvedValue(null);
    const fd = makeFormData(validInput);

    await expect(createEvent(fd)).rejects.toThrow("REDIRECT:/auth/sign-in");
    expect(mocks.mockDestroySession).toHaveBeenCalled();
  });

  it("creates event with title, slug, startAt, hostId on success", async () => {
    mocks.mockGetSession.mockResolvedValue({ userId: "host-1", role: "HOST" });
    mocks.mockUserFindUnique.mockResolvedValue({ id: "host-1" });
    mocks.mockEventCreate.mockResolvedValue({ slug: "my-party" });

    const fd = makeFormData(validInput);
    await expect(createEvent(fd)).rejects.toThrow("REDIRECT:/e/my-party");

    expect(mocks.mockEventCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        title: "Wine Night",
        slug: "my-party",
        hostId: "host-1",
        status: "PUBLISHED",
      }),
    });
  });

  it("throws ZodError when title is missing", async () => {
    mocks.mockGetSession.mockResolvedValue({ userId: "host-1", role: "HOST" });
    mocks.mockUserFindUnique.mockResolvedValue({ id: "host-1" });

    const input = { ...validInput, title: "" };
    const fd = makeFormData(input);

    await expect(createEvent(fd)).rejects.toThrow();
  });

  it("throws ZodError when startDate format is invalid", async () => {
    mocks.mockGetSession.mockResolvedValue({ userId: "host-1", role: "HOST" });
    mocks.mockUserFindUnique.mockResolvedValue({ id: "host-1" });

    const input = { ...validInput, startDate: "12-01-2026" };
    const fd = makeFormData(input);

    await expect(createEvent(fd)).rejects.toThrow();
  });
});
