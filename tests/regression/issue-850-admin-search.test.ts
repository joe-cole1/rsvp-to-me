// #850 root cause: lowercasing the needle did not make PostgreSQL contains
// case-insensitive; admin lists and client-only filters were unbounded.
import { describe, expect, it, vi, beforeEach } from "vitest";
const m = vi.hoisted(() => ({ users: vi.fn(), events: vi.fn(), admin: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: { user: { findMany: m.users }, event: { findMany: m.events } } }));
vi.mock("@/lib/auth-guards", () => ({ assertAdmin: m.admin }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { getAdminUsers, getAdminEvents } from "@/app/actions/admin";
import { ADMIN_PAGE_SIZE } from "@/lib/admin-pagination";
beforeEach(() => {
  vi.clearAllMocks();
  m.admin.mockResolvedValue({ role: "ADMIN" });
  m.users.mockResolvedValue([]);
  m.events.mockResolvedValue([]);
});
describe("#850 admin bounds", () => {
  it("applies search, role and status filters before taking a stable page", async () => {
    const users = Array.from({ length: ADMIN_PAGE_SIZE + 1 }, (_, id) => ({ id: String(id) }));
    m.users.mockResolvedValue(users);
    const result = await getAdminUsers(" MiXeD ", 2, { role: "HOST", status: "ACTIVE" });
    expect(result).toEqual({ items: users.slice(0, ADMIN_PAGE_SIZE), page: 2, hasMore: true });
    expect(m.users).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: ADMIN_PAGE_SIZE,
        take: ADMIN_PAGE_SIZE + 1,
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
        where: expect.objectContaining({
          id: { not: "system" },
          role: "HOST",
          AND: [
            {
              OR: [
                { name: { contains: "MiXeD", mode: "insensitive" } },
                { email: { contains: "MiXeD", mode: "insensitive" } },
                { phone: { contains: "MiXeD" } },
              ],
            },
            { deletionScheduledAt: null, OR: [{ email: { not: null } }, { phone: { not: null } }] },
          ],
        }),
      })
    );
  });
  it.each(["PENDING_DELETE", "DELETED"] as const)("filters %s on the server", async (status) => {
    await getAdminUsers("", 1, { status });
    expect(m.users.mock.calls[0][0].where.AND).toContainEqual(
      status === "DELETED" ? { email: null, phone: null } : { deletionScheduledAt: { not: null } }
    );
  });
  it("makes every textual event/host search case-insensitive and limits the query", async () => {
    await getAdminEvents(" MiXeD ", 3);
    expect(m.events).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: ADMIN_PAGE_SIZE * 2,
        take: ADMIN_PAGE_SIZE + 1,
        where: {
          OR: [
            { title: { contains: "MiXeD", mode: "insensitive" } },
            { slug: { contains: "MiXeD", mode: "insensitive" } },
            { host: { name: { contains: "MiXeD", mode: "insensitive" } } },
            { host: { email: { contains: "MiXeD", mode: "insensitive" } } },
          ],
        },
      })
    );
  });
  it.each([0, -1, 1.5, Infinity, 100001])("rejects invalid page %s", async (page) => {
    await expect(getAdminUsers("", page)).rejects.toThrow();
    await expect(getAdminEvents("", page)).rejects.toThrow();
    expect(m.users).not.toHaveBeenCalled();
    expect(m.events).not.toHaveBeenCalled();
  });
  it("still requires an administrator", async () => {
    m.admin.mockRejectedValue(new Error("Forbidden"));
    await expect(getAdminUsers()).rejects.toThrow("Forbidden");
    await expect(getAdminEvents()).rejects.toThrow("Forbidden");
    expect(m.users).not.toHaveBeenCalled();
    expect(m.events).not.toHaveBeenCalled();
  });
});
