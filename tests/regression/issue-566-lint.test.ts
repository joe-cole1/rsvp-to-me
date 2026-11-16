// #566 follow-up (November 2026): the original unused font import was already
// removed, but an unused poll prop, raw flag image and document navigation still
// left warnings. Exercise the effective lint rules without disabling them.
import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";

describe("#566 warning-free components", () => {
  it("passes the repository lint rules with no warnings or errors", async () => {
    const results = await new ESLint().lintFiles([
      "components/event/settings-page/ThemePanel.tsx",
      "components/event/event-page/PollsSection.tsx",
      "components/event/settings-page/DangerZonePanel.tsx",
      "components/ui/LanguageSelector.tsx",
    ]);
    expect(results).toHaveLength(4);
    expect(results.flatMap(({ messages }) => messages)).toEqual([]);
  });
});
