// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import ProfileDropdown from "@/components/ui/ProfileDropdown";
import { ParticleLayer } from "@/components/event/event-page/ParticleLayer";

const EFFECT = {
  effectId: "snow",
  density: "sparse" as const,
  speed: "gentle" as const,
};

describe("ProfileDropdown", () => {
  beforeEach(() => {
    window.localStorage.removeItem("rsvp:hide-effects");
  });

  it("shows a hamburger menu with login and effects controls when logged out", () => {
    render(<ProfileDropdown user={null} />);

    const trigger = screen.getByRole("button", { name: "Open menu" });
    expect(trigger.querySelector("svg")).not.toBeNull();

    fireEvent.click(trigger);

    expect(screen.getByRole("menuitem", { name: /Login/ })).toHaveAttribute(
      "href",
      "/auth/sign-in"
    );
    expect(screen.getByRole("menuitem", { name: /Hide effects/ })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: /Sign Out/ })).not.toBeInTheDocument();
  });

  it("keeps account links and adds the effects control for logged-in viewers", () => {
    render(
      <ProfileDropdown
        user={{
          name: "Jamie Host",
          email: "jamie@example.com",
          avatarUrl: null,
          role: "HOST",
        }}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Open profile menu" }));

    expect(screen.getByText("Jamie Host")).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /Event Dashboard/ })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /Profile Settings/ })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /Help & Guides/ })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /Hide effects/ })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /Sign Out/ })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: /Login/ })).not.toBeInTheDocument();
  });

  it("uses the same effects preference as the particle layer", () => {
    const { container } = render(
      <>
        <ProfileDropdown user={null} />
        <ParticleLayer config={EFFECT} tintColors={["#fff"]} />
      </>
    );

    expect(container.querySelector(".rsvp-effect-layer")).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Open menu" }));
    fireEvent.click(screen.getByRole("menuitem", { name: /Hide effects/ }));

    expect(container.querySelector(".rsvp-effect-layer")).toBeNull();
    expect(window.localStorage.getItem("rsvp:hide-effects")).toBe("1");

    fireEvent.click(screen.getByRole("button", { name: "Open menu" }));
    expect(screen.getByRole("menuitem", { name: /Show effects/ })).toBeInTheDocument();
  });
});
