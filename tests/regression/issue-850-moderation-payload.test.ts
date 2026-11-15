// #850 root cause: comment activity stores a body preview independently of
// Comment. Moderation must not leave that duplicate text in serialized pages.
import "@/tests/helpers/english-request-locale";
import { expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ event: vi.fn().mockResolvedValue(null) }));
vi.mock("@/lib/db", () => ({ db: { event: { findUnique: m.event } } }));
vi.mock("@/components/event/EventPage", () => ({ EventPage: () => null }));
vi.mock("@/components/event/PasswordGate", () => ({ PasswordGate: () => null }));
vi.mock("@/components/ui/AppShell", () => ({ AppShell: () => null }));
import { generateMetadata } from "@/app/e/[slug]/page";
it("excludes redundant comment previews at the shared event read boundary", async () => {
  await generateMetadata({
    params: Promise.resolve({ slug: "party" }),
    searchParams: Promise.resolve({}),
  });
  expect(m.event).toHaveBeenCalledWith(
    expect.objectContaining({
      include: expect.objectContaining({
        activityEvents: expect.objectContaining({ where: { type: { not: "comment_new" } } }),
      }),
    })
  );
});
