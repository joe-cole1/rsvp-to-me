import { cache } from "react";
import { hasRealAdmin } from "@/lib/admin-promotion";

/** Request-scoped page discovery only; mutations always recheck authorization. */
export const getSetupState = cache(async () => ({
  required: !(await hasRealAdmin()),
  configured: !!process.env.INITIAL_ADMIN_EMAIL?.trim(),
}));
