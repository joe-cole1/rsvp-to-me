// Root cause (01a1baab review M2): the settings route dropped the catalog
// fallback when it started seeding preset mixtures, so a missing or corrupt
// icon catalog turned the host settings page into a 500. Labels are an editor
// aid: a catalog failure now degrades to none.
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/effect-catalog", () => ({ getLibraryIconSummaries: vi.fn() }));
vi.mock("@/lib/logger", () => ({ logger: { warn: vi.fn() } }));

import { getLibraryIconSummaries } from "@/lib/effect-catalog";
import { getEditorIconSummaries } from "@/lib/editor-icon-summaries";
import { BUILTIN_PRESENTATIONS } from "@/lib/theme-preset-presentation";

const summaries = vi.mocked(getLibraryIconSummaries);
const presets = [
  { presentation: BUILTIN_PRESENTATIONS["st-patricks"] },
  { presentation: BUILTIN_PRESENTATIONS["dark-night"] },
  { presentation: null },
];

describe("settings editor icon summaries", () => {
  beforeEach(() => {
    summaries.mockReset();
  });

  it("returns no labels instead of failing the page when the catalog cannot load", async () => {
    summaries.mockRejectedValue(new Error("ENOENT: icons.json"));
    await expect(getEditorIconSummaries(["noto:cat"], presets)).resolves.toEqual([]);
  });

  it("asks once for the stored mixture plus every preset mixture, without duplicates", async () => {
    summaries.mockResolvedValue([]);
    await getEditorIconSummaries(["noto:shamrock", "noto:cat"], presets);
    expect(summaries).toHaveBeenCalledWith(["noto:shamrock", "noto:cat", "noto:four-leaf-clover"]);
  });
});
