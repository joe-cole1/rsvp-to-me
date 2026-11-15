// #853 root cause: route wrappers provided no shared main/skip target, while the
// settings menu skipped h2 and standalone event controls kept inline-sized targets.
// @vitest-environment jsdom
import React from "react";
import Link from "next/link";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@/tests/components/render";
import { PageContent } from "@/components/ui/PageContent";
import { StatePage } from "@/components/ui/StatePage";
import { SettingsMenu } from "@/components/event/settings-page/SettingsMenu";
import { testTheme } from "@/tests/components/helpers/theme";
import { GuestRsvpGroup } from "@/components/event/GuestRsvpGroup";
afterEach(cleanup);
describe("#853 document structure", () => {
  it("places navigation outside the single main, with the skip link first", () => {
    const page = "Event";
    render(
      <PageContent
        skipLabel="Skip to content"
        header={
          <header>
            <Link href="/">Home</Link>
          </header>
        }
      >
        <h1>{page}</h1>
      </PageContent>
    );
    const main = screen.getByRole("main");
    const skip = screen.getByRole("link", { name: "Skip to content" });
    expect(skip).toHaveAttribute("href", `#${main.id}`);
    expect(main).toHaveAttribute("tabindex", "-1");
    expect(main).toContainElement(screen.getByRole("heading", { name: page }));
    expect(main).not.toContainElement(screen.getByRole("banner"));
    expect(document.querySelector("a")).toBe(skip);
  });
  it("keeps error pages within the single document landmark", () => {
    render(
      <PageContent skipLabel="Skip to content" header={<header />}>
        <StatePage
          title="Missing"
          description="Try another page."
          actions={<Link href="/">Home</Link>}
        />
      </PageContent>
    );
    expect(screen.getAllByRole("main")).toHaveLength(1);
    expect(screen.getByRole("main")).toContainElement(screen.getByRole("heading", { level: 1 }));
  });
  it("uses second-level headings for the settings menu", () => {
    render(
      <>
        <h1>Settings</h1>
        <SettingsMenu isOwner openSection={vi.fn()} t={testTheme} />
      </>
    );
    expect(screen.getAllByRole("heading", { level: 2 }).length).toBeGreaterThan(0);
    expect(screen.queryAllByRole("heading", { level: 3 })).toHaveLength(0);
  });
  it("gives the collapsible guest row a 40px target", () => {
    const { container } = render(
      <GuestRsvpGroup
        label="Going"
        count={1}
        display={{ list: "COLLAPSED", count: "EXACT" }}
        t={testTheme}
      >
        Alice
      </GuestRsvpGroup>
    );
    expect(container.querySelector("summary")).toHaveStyle({ minHeight: "40px" });
  });
});
