import { unstable_isUnrecognizedActionError } from "next/navigation";

/**
 * A page loaded before a deployment calls server actions the new server no longer has.
 * Only a reload fixes that, so it gets its own message instead of a generic failure.
 */
export function actionFailure(error: unknown): { code: "staleClient" | "saveFailed" } {
  return { code: unstable_isUnrecognizedActionError(error) ? "staleClient" : "saveFailed" };
}
