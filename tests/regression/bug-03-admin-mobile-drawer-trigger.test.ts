// BUG-03 — Admin mobile drawer could never open.
//
// Bug (found 2026-07 during the L-3 split of AdminClient.tsx): the sliding
// admin navigation drawer (AdminMobileDrawer) is gated on `isDrawerOpen`, but
// nothing in AdminClient.tsx ever called `setIsDrawerOpen(true)` — there was
// no hamburger/trigger button. On screens below the `lg` breakpoint (where
// AdminSidebar is `hidden lg:flex`) admins could not switch tabs at all,
// except by hand-editing the `?tab=` URL parameter.
//
// Fix: AdminClient.tsx renders a `lg:hidden` hamburger button in the page
// banner that calls `setIsDrawerOpen(true)`.
//
// AdminClient is a client component whose props require the full admin data
// graph, so it cannot be rendered in the node unit environment; following the
// SEC-25 precedent, this test inspects the source on disk to pin the wiring:
// the drawer opener must exist and must be visible exactly where the sidebar
// is not.

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const REPO_ROOT = join(__dirname, "..", "..");
const ADMIN_CLIENT = join(REPO_ROOT, "app", "(app)", "admin", "AdminClient.tsx");
const ADMIN_SIDEBAR = join(REPO_ROOT, "app", "(app)", "admin", "tabs", "AdminSidebar.tsx");

describe("BUG-03: admin mobile drawer has a trigger", () => {
  it("AdminClient contains a call that opens the drawer", () => {
    const source = readFileSync(ADMIN_CLIENT, "utf8");
    expect(
      source,
      "AdminClient.tsx must call setIsDrawerOpen(true) somewhere (hamburger trigger), " +
        "otherwise the mobile drawer can never open"
    ).toMatch(/setIsDrawerOpen\(true\)/);
  });

  it("the trigger is shown only below lg, where the sidebar is hidden", () => {
    const client = readFileSync(ADMIN_CLIENT, "utf8");
    const sidebar = readFileSync(ADMIN_SIDEBAR, "utf8");

    // The desktop sidebar hides itself below lg…
    expect(sidebar).toMatch(/hidden lg:flex/);
    // …so the drawer trigger must exist for exactly that range.
    expect(
      client,
      "the drawer trigger must carry lg:hidden so it only appears where the sidebar is hidden"
    ).toMatch(/lg:hidden/);
  });
});
