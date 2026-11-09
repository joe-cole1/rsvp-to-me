// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, fireEvent, waitFor } from "@/tests/components/render";
import {
  BUILTIN_PRESENTATIONS,
  presentationsEqual,
  presetCategory,
  presetPresentation,
} from "@/lib/theme-preset-presentation";

vi.mock("@/app/actions/admin", () => ({ getPresetIconSummaries: vi.fn().mockResolvedValue([]) }));

import { PresetPresentationEditor } from "@/app/(app)/admin/tabs/PresetPresentationEditor";

// Root cause (01a1baab review M3): the category came only from the new
// presentation JSON, so a seasonal preset saved before categories existed read
// as General, and any edit in the editor cleared its seasonal flag and month.
describe("preset category", () => {
  it("falls back to the seasonal flag when no valid category is stored", () => {
    expect(presetCategory({ seasonal: true, presentation: null })).toBe("seasonal");
    expect(presetCategory({ seasonal: false, presentation: undefined })).toBe("general");
    expect(presetCategory({ seasonal: true, presentation: { category: "bogus" } })).toBe(
      "seasonal"
    );
    expect(presetCategory({ seasonal: false, presentation: BUILTIN_PRESENTATIONS.birthday })).toBe(
      "occasion"
    );
  });

  describe("admin editor", () => {
    beforeEach(() => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: async () => ({
            items: [
              {
                id: "noto:jack-o-lantern",
                collection: "noto",
                src: "/effects/library/noto/1.2.10/jack-o-lantern.svg",
                labels: {
                  "en-US": "Jack-o-lantern",
                  "nl-NL": "Jack-o-lantern",
                  "de-DE": "Jack-o-lantern",
                  "es-ES": "Jack-o-lantern",
                },
              },
            ],
            total: 1,
            nextOffset: null,
          }),
        })
      );
    });
    afterEach(() => vi.unstubAllGlobals());

    it("shows a legacy seasonal preset as Seasonal and keeps it when the tile changes", async () => {
      const onChange = vi.fn();
      const ui = render(<PresetPresentationEditor value={null} seasonal onChange={onChange} />);
      const category = ui.getByRole("combobox", { name: "Category" }) as HTMLSelectElement;
      expect(category.value).toBe("seasonal");
      fireEvent.change(ui.getByRole("textbox", { name: "Search tile icons" }), {
        target: { value: "pumpkin" },
      });
      fireEvent.click(await ui.findByRole("button", { name: "Jack-o-lantern" }));
      await waitFor(() => expect(onChange).toHaveBeenCalled());
      expect(onChange.mock.calls.at(-1)![0]).toMatchObject({
        category: "seasonal",
        tileIconId: "noto:jack-o-lantern",
      });
    });
  });
});

// Root cause (01a1baab review L1): the admin form compared presentations with
// JSON.stringify, but PostgreSQL JSONB returns keys in its own order, so an
// unchanged form read as dirty and differing from its default.
describe("presentation comparison", () => {
  const canonical = BUILTIN_PRESENTATIONS["st-patricks"];
  const e = canonical.effect!;
  const jsonbOrder = {
    effect: {
      effectId: e.effectId,
      effectSize: e.effectSize,
      effectSpeed: e.effectSpeed,
      effectDensity: e.effectDensity,
      effectIconIds: e.effectIconIds,
      effectMovement: e.effectMovement,
    },
    category: canonical.category,
    tileIconId: canonical.tileIconId,
  };

  it("compares by value, not key order", () => {
    expect(JSON.stringify(jsonbOrder)).not.toBe(JSON.stringify(canonical));
    expect(presentationsEqual(jsonbOrder, canonical)).toBe(true);
    expect(presentationsEqual(jsonbOrder, { ...canonical, tileIconId: "noto:shamrock" })).toBe(
      false
    );
  });

  it("narrows malformed stored JSON to a safe, complete value", () => {
    expect(
      presetPresentation(
        { category: "holiday", tileIconId: "../secret", effect: { effectId: "custom" } },
        true
      )
    ).toEqual({ category: "seasonal", tileIconId: "noto:artist-palette", effect: null });
  });
});
