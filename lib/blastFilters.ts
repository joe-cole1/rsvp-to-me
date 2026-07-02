export type BlastStatusFilter = "ALL" | "INVITED" | "GOING" | "MAYBE" | "NO";

type RsvpStatusCondition = {
  status?: "GOING" | "MAYBE" | "NO" | "INVITED";
  responded?: boolean;
};

/**
 * L-2: shared status-filter builder for the email and SMS blast actions
 * (previously duplicated inline in sendBlast / sendSmsBlast).
 *
 * "ALL" anywhere in the list wins — no status constraint at all. Responded
 * statuses (GOING/MAYBE/NO) additionally require `responded: true` so stale
 * default rows don't match, while INVITED matches not-yet-responded invites.
 */
export function buildRsvpStatusFilter(
  filters: BlastStatusFilter[]
): { OR: RsvpStatusCondition[] } | Record<string, never> {
  const orConditions: RsvpStatusCondition[] = [];
  for (const filter of filters) {
    if (filter === "ALL") return {};
    if (filter === "GOING") orConditions.push({ status: "GOING", responded: true });
    else if (filter === "MAYBE") orConditions.push({ status: "MAYBE", responded: true });
    else if (filter === "NO") orConditions.push({ status: "NO", responded: true });
    else if (filter === "INVITED") orConditions.push({ status: "INVITED" });
  }
  return orConditions.length > 0 ? { OR: orConditions } : {};
}
