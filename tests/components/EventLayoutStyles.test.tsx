import { describe, expect, it } from "vitest";
import { buildStyles as buildEventStyles } from "@/components/event/event-page/styles";
import { buildStyles as buildSettingsStyles } from "@/components/event/settings-page/styles";
import { testTheme } from "./helpers/theme";

describe("event layout widths", () => {
  it("uses a 600px maximum for public event and settings pages", () => {
    expect(buildEventStyles(testTheme).container.maxWidth).toBe("600px");
    expect(buildSettingsStyles(testTheme).container.maxWidth).toBe("600px");
  });
});
