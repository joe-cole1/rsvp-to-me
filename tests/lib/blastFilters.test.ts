// L-2: shared status-filter builder extracted from the near-identical inline
// blocks in sendBlast / sendSmsBlast (app/actions/event.ts).

import { describe, it, expect } from "vitest";
import { buildRsvpStatusFilter } from "@/lib/blastFilters";

describe("buildRsvpStatusFilter", () => {
  it("returns no constraint for ALL", () => {
    expect(buildRsvpStatusFilter(["ALL"])).toEqual({});
  });

  it("ALL wins even when combined with other filters, regardless of order", () => {
    expect(buildRsvpStatusFilter(["GOING", "ALL", "NO"])).toEqual({});
    expect(buildRsvpStatusFilter(["ALL", "INVITED"])).toEqual({});
  });

  it("returns no constraint for an empty filter list", () => {
    expect(buildRsvpStatusFilter([])).toEqual({});
  });

  it("requires responded: true for GOING / MAYBE / NO", () => {
    expect(buildRsvpStatusFilter(["GOING"])).toEqual({
      OR: [{ status: "GOING", responded: true }],
    });
    expect(buildRsvpStatusFilter(["MAYBE"])).toEqual({
      OR: [{ status: "MAYBE", responded: true }],
    });
    expect(buildRsvpStatusFilter(["NO"])).toEqual({ OR: [{ status: "NO", responded: true }] });
  });

  it("matches INVITED without a responded constraint", () => {
    expect(buildRsvpStatusFilter(["INVITED"])).toEqual({ OR: [{ status: "INVITED" }] });
  });

  it("combines multiple statuses into one OR list", () => {
    expect(buildRsvpStatusFilter(["GOING", "INVITED"])).toEqual({
      OR: [{ status: "GOING", responded: true }, { status: "INVITED" }],
    });
  });
});
