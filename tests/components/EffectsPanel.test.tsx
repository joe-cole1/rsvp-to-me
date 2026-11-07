// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React, { useState } from "react";
import { act, fireEvent, render, within } from "@/tests/components/render";
import { EffectsPanel } from "@/components/event/settings-page/EffectsPanel";
import type { EffectEditorState } from "@/components/event/settings-page/effect-state";
import type { LibraryIconSummary } from "@/lib/effect-catalog-shared";
import dutch from "@/messages/nl-NL.json";
import { testTheme } from "./helpers/theme";

// #825: the Effects editor — local icon search, mixtures of up to three icons,
// and independent Amount / Size / Speed / Movement.

function icon(name: string, en: string, nl: string): LibraryIconSummary {
  return {
    id: `noto:${name}`,
    collection: "noto",
    src: `/effects/library/noto/1.2.10/${name}.svg`,
    labels: { "en-US": en, "nl-NL": nl, "de-DE": en, "es-ES": en },
  };
}
const CAT = icon("cat", "Cat", "Kat");
const CAT_FACE = icon("cat-face", "Cat face", "Kattengezicht");
const DOG = icon("dog", "Dog", "Hond");
const HEART = icon("red-heart", "Red heart", "Rood hart");
const PIZZA = icon("pizza", "Pizza", "Pizza");

const NONE: EffectEditorState = {
  effectId: null,
  effectIconIds: [],
  effectDensity: "medium",
  effectSpeed: "medium",
  effectSize: 3,
  effectMovement: null,
};

function Harness({
  initial,
  known = [],
  onCommit,
  onPreview,
}: {
  initial: EffectEditorState;
  known?: LibraryIconSummary[];
  onCommit: (next: EffectEditorState) => void;
  onPreview?: (next: EffectEditorState) => void;
}) {
  const [effect, setEffect] = useState(initial);
  const [icons, setIcons] = useState(() => Object.fromEntries(known.map((i) => [i.id, i])));
  return (
    <EffectsPanel
      eventId="evt-1"
      t={testTheme}
      effect={effect}
      libraryIcons={icons}
      onPreview={(next) => {
        onPreview?.(next);
        setEffect(next);
      }}
      onCommit={(next, added) => {
        onCommit(next);
        if (added) setIcons((m) => ({ ...m, ...Object.fromEntries(added.map((i) => [i.id, i])) }));
        setEffect(next);
      }}
    />
  );
}

function page(items: LibraryIconSummary[], total = items.length, nextOffset: number | null = null) {
  return new Response(JSON.stringify({ items, total, nextOffset }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  // The debounce runs on the fake clock; letting it also follow real time keeps
  // Testing Library's findBy* polling working.
  vi.useFakeTimers({ shouldAdvanceTime: true });
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

async function typeQuery(input: HTMLElement, value: string) {
  fireEvent.change(input, { target: { value } });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(250);
  });
}

function requestedParams(call = 0) {
  return new URL(String(fetchMock.mock.calls[call][0]), "http://localhost").searchParams;
}

describe("EffectsPanel", () => {
  it("shows None and the built-in sets with no search, without calling the server", () => {
    const { getByRole, getByLabelText } = render(<Harness initial={NONE} onCommit={vi.fn()} />);
    expect(getByLabelText("Search icons")).toBeTruthy();
    expect(getByRole("button", { name: /None/ })).toHaveAttribute("aria-pressed", "true");
    expect(getByRole("button", { name: /Confetti/ })).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("debounces typing into one local search for the event and interface language", async () => {
    fetchMock.mockResolvedValue(page([CAT, CAT_FACE]));
    const { getByLabelText, findByText, getByRole, queryByText } = render(
      <Harness initial={NONE} onCommit={vi.fn()} />
    );
    const input = getByLabelText("Search icons");
    fireEvent.change(input, { target: { value: "c" } });
    fireEvent.change(input, { target: { value: "ca" } });
    await typeQuery(input, "cat");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const url = String(fetchMock.mock.calls[0][0]);
    expect(url.startsWith("/api/effects/search?")).toBe(true);
    const params = requestedParams();
    expect(params.get("q")).toBe("cat");
    expect(params.get("eventId")).toBe("evt-1");
    expect(params.get("locale")).toBe("en-US");
    expect(params.get("offset")).toBe("0");
    await findByText("Showing 2 of 2");
    // One tile per icon, named by its label alone (no style caption any more)
    expect(getByRole("button", { name: "Cat" })).toBeTruthy();
    expect(getByRole("button", { name: "Cat face" })).toBeTruthy();
    expect(queryByText("Noto Emoji")).toBeNull();
  });

  it("ignores a late response from an older query", async () => {
    let resolveDog!: (r: Response) => void;
    fetchMock
      .mockImplementationOnce(() => new Promise<Response>((r) => (resolveDog = r)))
      .mockResolvedValueOnce(page([CAT]));
    const { getByLabelText, queryByText, findByText } = render(
      <Harness initial={NONE} onCommit={vi.fn()} />
    );
    const input = getByLabelText("Search icons");
    await typeQuery(input, "dog");
    await typeQuery(input, "cat");
    await findByText("Cat");
    await act(async () => resolveDog(page([DOG])));
    expect(queryByText("Dog")).toBeNull();
    expect(queryByText("Cat")).toBeTruthy();
  });

  it("loads more results in fixed pages without duplicates", async () => {
    fetchMock
      .mockResolvedValueOnce(page([CAT, DOG], 4, 24))
      .mockResolvedValueOnce(page([DOG, HEART, PIZZA], 4, null));
    const { getByLabelText, getByRole, findByText, getAllByText, queryByRole } = render(
      <Harness initial={NONE} onCommit={vi.fn()} />
    );
    await typeQuery(getByLabelText("Search icons"), "animal");
    await findByText("Showing 2 of 4");
    fireEvent.click(getByRole("button", { name: "Load more" }));
    await findByText("Pizza");
    expect(requestedParams(1).get("offset")).toBe("24");
    expect(getAllByText("Dog")).toHaveLength(1);
    expect(queryByRole("button", { name: "Load more" })).toBeNull();
  });

  it("starts a mixture from a built-in set, keeping the other settings", async () => {
    fetchMock.mockResolvedValue(page([CAT]));
    const onCommit = vi.fn();
    const initial = { ...NONE, effectId: "snow", effectSize: 6, effectMovement: "up" as const };
    const { getByLabelText, findByRole } = render(
      <Harness initial={initial} onCommit={onCommit} />
    );
    await typeQuery(getByLabelText("Search icons"), "cat");
    fireEvent.click(await findByRole("button", { name: /Cat/ }));
    expect(onCommit).toHaveBeenLastCalledWith({
      ...initial,
      effectId: "custom",
      effectIconIds: ["noto:cat"],
    });
  });

  it("mixes up to three icons, explains the limit, and removes by name", async () => {
    fetchMock.mockResolvedValue(page([PIZZA]));
    const onCommit = vi.fn();
    const initial = {
      ...NONE,
      effectId: "custom",
      effectIconIds: [CAT.id, DOG.id, HEART.id],
    };
    const { getByLabelText, findByRole, getByRole, getByText } = render(
      <Harness initial={initial} known={[CAT, DOG, HEART]} onCommit={onCommit} />
    );
    await typeQuery(getByLabelText("Search icons"), "pizza");
    const pizza = await findByRole("button", { name: /Pizza/ });
    fireEvent.click(pizza);
    expect(onCommit).not.toHaveBeenCalled();
    expect(getByText(/You can mix up to three icons/)).toBeTruthy();
    expect(pizza).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(getByRole("button", { name: "Remove Dog" }));
    expect(onCommit).toHaveBeenLastCalledWith({ ...initial, effectIconIds: [CAT.id, HEART.id] });
    fireEvent.click(pizza);
    expect(onCommit).toHaveBeenLastCalledWith({
      ...initial,
      effectIconIds: [CAT.id, HEART.id, PIZZA.id],
    });
    expect(pizza).toHaveAttribute("aria-pressed", "true");
  });

  it("removing the last icon turns the effect off", async () => {
    fetchMock.mockResolvedValue(page([CAT]));
    const onCommit = vi.fn();
    const initial = { ...NONE, effectId: "custom", effectIconIds: [CAT.id] };
    const { getByLabelText, findByRole } = render(
      <Harness initial={initial} known={[CAT]} onCommit={onCommit} />
    );
    await typeQuery(getByLabelText("Search icons"), "cat");
    // Clicking the selected tile removes it
    const tile = await findByRole("button", { name: /^Cat/ });
    expect(tile).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(tile);
    expect(onCommit).toHaveBeenLastCalledWith({ ...initial, effectId: null, effectIconIds: [] });
  });

  it("keeps the mixture when search is cleared, and a built-in replaces it", async () => {
    fetchMock.mockResolvedValue(page([DOG]));
    const onCommit = vi.fn();
    const initial = { ...NONE, effectId: "custom", effectIconIds: [CAT.id] };
    const { getByLabelText, getByRole, findByText } = render(
      <Harness initial={initial} known={[CAT]} onCommit={onCommit} />
    );
    const input = getByLabelText("Search icons");
    await typeQuery(input, "dog");
    await findByText("Dog");
    // The selected icon stays visible even though the results don't contain it
    expect(getByRole("button", { name: "Remove Cat" })).toBeTruthy();
    await typeQuery(input, "");
    expect(onCommit).not.toHaveBeenCalled();
    expect(getByRole("button", { name: "Remove Cat" })).toBeTruthy();
    fireEvent.click(getByRole("button", { name: /Snow$/ }));
    expect(onCommit).toHaveBeenLastCalledWith({ ...initial, effectId: "snow", effectIconIds: [] });
  });

  it("reports no results, rate limits and failures without touching the effect", async () => {
    const onCommit = vi.fn();
    fetchMock
      .mockResolvedValueOnce(page([]))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "rate_limited", retryAfter: 12 }), { status: 429 })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "search_failed" }), { status: 500 })
      )
      .mockResolvedValueOnce(page([CAT]));
    const { getByLabelText, findByText, getByRole } = render(
      <Harness initial={{ ...NONE, effectId: "snow" }} onCommit={onCommit} />
    );
    const input = getByLabelText("Search icons");
    await typeQuery(input, "zzz");
    await findByText("No icons match “zzz”.");
    await typeQuery(input, "cat");
    await findByText("Too many searches. Try again in 12 seconds.");
    await typeQuery(input, "cats");
    await findByText(/Search isn't available right now/);
    fireEvent.click(getByRole("button", { name: "Try again" }));
    await findByText("Cat");
    expect(requestedParams(3).get("q")).toBe("cats");
    expect(onCommit).not.toHaveBeenCalled();
  });

  it("labels selected icons in the interface language", () => {
    const initial = { ...NONE, effectId: "custom", effectIconIds: [CAT.id, HEART.id] };
    const { getByText, getByRole } = render(
      <Harness initial={initial} known={[CAT, HEART]} onCommit={vi.fn()} />,
      { locale: "nl-NL", messages: dutch }
    );
    expect(getByText("Kat")).toBeTruthy();
    expect(getByText("Rood hart")).toBeTruthy();
    expect(getByRole("button", { name: "Kat verwijderen" })).toBeTruthy();
  });

  it("warns when a stored mixture can no longer be shown", () => {
    const initial = { ...NONE, effectId: "custom", effectIconIds: ["noto:gone"] };
    const { getByText } = render(<Harness initial={initial} onCommit={vi.fn()} />);
    expect(getByText(/no longer available/)).toBeTruthy();
  });
});

describe("EffectsPanel size slider", () => {
  const SNOW = { ...NONE, effectId: "snow", effectSize: 3 };

  it("previews while moving and saves once when a key is released", () => {
    const onCommit = vi.fn();
    const onPreview = vi.fn();
    const { container, getByRole } = render(
      <Harness initial={SNOW} onCommit={onCommit} onPreview={onPreview} />
    );
    const slider = container.querySelector('input[type="range"]') as HTMLInputElement;
    fireEvent.keyDown(slider, { key: "ArrowRight" });
    fireEvent.change(slider, { target: { value: "3.5" } });
    expect(onPreview).toHaveBeenLastCalledWith({ ...SNOW, effectSize: 3.5 });
    expect(onCommit).not.toHaveBeenCalled();
    fireEvent.keyUp(slider, { key: "ArrowRight" });
    expect(onCommit).toHaveBeenCalledExactlyOnceWith({ ...SNOW, effectSize: 3.5 });
    // Leaving the slider afterwards doesn't save the same value again
    fireEvent.blur(slider);
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(container.querySelector("output")!.textContent).toBe("3.5×");
    const size = within(getByRole("group", { name: "Size" }));
    expect(size.getByRole("button", { name: "Small" })).toHaveAttribute("aria-pressed", "false");
  });

  it("saves on pointer or touch release, and on blur if nothing else did", () => {
    const onCommit = vi.fn();
    const { container } = render(<Harness initial={SNOW} onCommit={onCommit} />);
    const slider = container.querySelector('input[type="range"]') as HTMLInputElement;
    fireEvent.change(slider, { target: { value: "8" } });
    fireEvent.pointerUp(slider);
    fireEvent.touchEnd(slider);
    expect(onCommit).toHaveBeenCalledExactlyOnceWith({ ...SNOW, effectSize: 8 });
    fireEvent.change(slider, { target: { value: "9.5" } });
    fireEvent.blur(slider);
    expect(onCommit).toHaveBeenLastCalledWith({ ...SNOW, effectSize: 9.5 });
    expect(onCommit).toHaveBeenCalledTimes(2);
  });

  it("does not round a stored off-step size just by showing it", () => {
    const onCommit = vi.fn();
    const { container } = render(
      <Harness initial={{ ...SNOW, effectSize: 2.3 }} onCommit={onCommit} />
    );
    const slider = container.querySelector('input[type="range"]') as HTMLInputElement;
    fireEvent.focus(slider);
    fireEvent.blur(slider);
    expect(onCommit).not.toHaveBeenCalled();
    expect(container.querySelector("output")!.textContent).toBe("2.3×");
  });
});
