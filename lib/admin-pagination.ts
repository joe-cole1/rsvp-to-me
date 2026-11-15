import { z } from "zod";

export const ADMIN_PAGE_SIZE = 25;
export const adminPageSchema = z.number().int().min(1).max(100000);
export const adminUserFiltersSchema = z.object({
  role: z.enum(["ALL", "GUEST", "HOST", "ADMIN"]).default("ALL"),
  status: z.enum(["ALL", "ACTIVE", "PENDING_DELETE", "DELETED"]).default("ALL"),
});
export type AdminUserFilters = z.input<typeof adminUserFiltersSchema>;
export type AdminPage<T> = { items: T[]; page: number; hasMore: boolean };
