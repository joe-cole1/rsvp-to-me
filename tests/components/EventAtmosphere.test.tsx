// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { EventAtmosphere } from "@/components/event/EventAtmosphere";
import { testTheme } from "./helpers/theme";

describe("EventAtmosphere", () => {
  it("renders the shared theme background and configured particle layer", () => {
    const { container } = render(
      <EventAtmosphere
        theme={testTheme}
        effect={{ effectId: "confetti", density: "sparse", speed: "gentle", size: 2 }}
      />
    );

    expect(container.querySelector('[aria-hidden="true"]')).toBeTruthy();
    expect(container.querySelector('[data-effect-id="confetti"]')).toBeTruthy();
  });

  it("keeps the theme background when no effect is configured", () => {
    const { container } = render(<EventAtmosphere theme={testTheme} />);

    expect(container.children.length).toBeGreaterThan(0);
    expect(container.querySelector(".rsvp-effect-layer")).toBeNull();
  });
});
