"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { X } from "lucide-react";
import type { ResolvedTheme } from "@/lib/theme";
import {
  CUSTOM_EFFECT_ID,
  EFFECT_AMOUNTS,
  EFFECT_MOVEMENTS,
  EFFECT_SIZE_MAX,
  EFFECT_SIZE_MIN,
  EFFECT_SIZE_PRESETS,
  EFFECT_SIZE_STEP,
  EFFECT_SPEEDS,
  MAX_LIBRARY_ICONS,
  effectAmountFor,
  effectSizePresetFor,
  getSortedEffectSets,
  inheritedEffectMovement,
  type EffectAmount,
  type EffectSizePreset,
  type EffectSpeed,
} from "@/lib/effects";
import {
  EFFECT_SEARCH_MAX_QUERY_LENGTH,
  libraryIconLabel,
  type EffectSearchErrorResponse,
  type EffectSearchResponse,
  type LibraryIconSummary,
} from "@/lib/effect-catalog-shared";
import type { EffectEditorState } from "./effect-state";
import { Button } from "@/components/ui/Button";
import { Chip, ChoiceTile } from "@/components/ui/Choice";
import { Field, Input, Label, Range } from "@/components/ui/Field";
import { InlineAlert } from "@/components/ui/Feedback";

// #825: the Effects tab. An empty search shows None and the 19 built-in sets;
// a search finds icons in the local Noto Emoji library in any of the four
// languages. A host picks one built-in set or mixes up to three icons, then
// sets Amount, Size, Speed and Movement independently. Every change saves at
// once through the theme autosave (onCommit); the size slider previews while
// it moves (onPreview) and saves when it is let go.

const SEARCH_DEBOUNCE_MS = 250;

type SearchError = { kind: "rate_limited"; retryAfter: number } | { kind: "failed" };

interface SearchState {
  /** The trimmed query these results belong to */
  query: string;
  loading: boolean;
  items: LibraryIconSummary[];
  total: number;
  nextOffset: number | null;
  /** Set when the last request failed; `offset` is what to retry */
  error: (SearchError & { offset: number }) | null;
}

const EMPTY_SEARCH: SearchState = {
  query: "",
  loading: false,
  items: [],
  total: 0,
  nextOffset: null,
  error: null,
};

function useIconSearch(eventId: string, query: string, locale: string) {
  const [state, setState] = useState<SearchState>(EMPTY_SEARCH);
  const seq = useRef(0);
  const controller = useRef<AbortController | null>(null);

  const run = (q: string, offset: number) => {
    controller.current?.abort();
    const ctrl = new AbortController();
    controller.current = ctrl;
    const mine = ++seq.current;
    setState((s) =>
      offset === 0
        ? { ...EMPTY_SEARCH, query: q, loading: true }
        : { ...s, loading: true, error: null }
    );
    const params = new URLSearchParams({ eventId, q, locale, offset: String(offset) });
    void (async () => {
      try {
        const res = await fetch(`/api/effects/search?${params}`, {
          signal: ctrl.signal,
          cache: "no-store",
          headers: { Accept: "application/json" },
        });
        const body = (await res.json().catch(() => null)) as
          EffectSearchResponse | EffectSearchErrorResponse | null;
        if (mine !== seq.current) return; // a newer search owns the state
        if (res.ok && body && "items" in body) {
          setState((s) => {
            const seen = new Set(offset === 0 ? [] : s.items.map((i) => i.id));
            const fresh = body.items.filter((i) => !seen.has(i.id));
            return {
              query: q,
              loading: false,
              items: offset === 0 ? fresh : [...s.items, ...fresh],
              total: body.total,
              nextOffset: body.nextOffset,
              error: null,
            };
          });
          return;
        }
        const error: SearchError =
          res.status === 429
            ? {
                kind: "rate_limited",
                retryAfter: body && "retryAfter" in body ? (body.retryAfter ?? 60) : 60,
              }
            : { kind: "failed" };
        setState((s) => ({ ...s, query: q, loading: false, error: { ...error, offset } }));
      } catch {
        if (ctrl.signal.aborted || mine !== seq.current) return;
        setState((s) => ({ ...s, query: q, loading: false, error: { kind: "failed", offset } }));
      }
    })();
  };

  const trimmed = query.trim();
  useEffect(() => {
    if (!trimmed) {
      controller.current?.abort();
      seq.current++;
      return;
    }
    const timer = setTimeout(() => run(trimmed, 0), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
    // `run` only closes over refs, setState and these inputs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trimmed, locale, eventId]);

  useEffect(() => () => controller.current?.abort(), []);

  // Results for an older query never show for a newer one.
  const current = state.query === trimmed ? state : { ...EMPTY_SEARCH, query: trimmed };
  return {
    search: current,
    pending: !!trimmed && (current.loading || state.query !== trimmed),
    loadMore: () => {
      if (current.loading || current.nextOffset == null) return;
      run(trimmed, current.nextOffset);
    },
    retry: () => run(trimmed, current.error?.offset ?? 0),
  };
}

export function EffectsPanel({
  eventId,
  t,
  effect,
  libraryIcons,
  onPreview,
  onCommit,
}: {
  eventId: string;
  t: ResolvedTheme;
  effect: EffectEditorState;
  /** Summaries for every library icon this editor has seen (selected or found) */
  libraryIcons: Record<string, LibraryIconSummary>;
  /** Show a change without saving it yet (size slider while it moves) */
  onPreview: (next: EffectEditorState) => void;
  /** Show and save a change; `icons` are summaries for newly picked library icons */
  onCommit: (next: EffectEditorState, icons?: LibraryIconSummary[]) => void;
}) {
  const shared = useTranslations("Ui.Event.shared");
  const translate = useTranslations("Ui.Event.ThemePanel");
  const locale = useLocale();
  const sortedEffectSets = getSortedEffectSets();
  const [query, setQuery] = useState("");
  const { search, pending, loadMore, retry } = useIconSearch(eventId, query, locale);
  const [limitNotice, setLimitNotice] = useState(false);
  const sizeDirty = useRef(false);
  const sizeId = useId();
  const searchActive = query.trim().length > 0;

  const isCustom = effect.effectId === CUSTOM_EFFECT_ID;
  const selectedIds = isCustom ? effect.effectIconIds : [];
  const selectedKnown = selectedIds.filter((id) => libraryIcons[id]);
  const unavailable =
    isCustom && (selectedIds.length === 0 || selectedKnown.length < selectedIds.length);
  const movement = effect.effectMovement ?? inheritedEffectMovement(effect.effectId);
  const sizePreset = effectSizePresetFor(effect.effectSize);
  const formatSize = (value: number) =>
    translate("sizeMultiplier", {
      value: new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(value),
    });

  const hint: React.CSSProperties = {
    fontSize: "13px",
    lineHeight: "19px",
    color: t.textSecondary,
    margin: "0 0 8px",
  };
  const grid: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(88px, 1fr))",
    gap: "8px",
  };
  const ellipsis: React.CSSProperties = {
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    maxWidth: "100%",
  };

  const chooseSource = (effectId: string | null) => {
    setLimitNotice(false);
    onCommit({ ...effect, effectId, effectIconIds: [] });
  };

  const toggleIcon = (icon: LibraryIconSummary) => {
    if (selectedKnown.includes(icon.id)) {
      const ids = selectedKnown.filter((id) => id !== icon.id);
      setLimitNotice(false);
      onCommit(
        ids.length
          ? { ...effect, effectId: CUSTOM_EFFECT_ID, effectIconIds: ids }
          : { ...effect, effectId: null, effectIconIds: [] }
      );
      return;
    }
    if (selectedKnown.length >= MAX_LIBRARY_ICONS) {
      setLimitNotice(true);
      return;
    }
    setLimitNotice(false);
    onCommit(
      { ...effect, effectId: CUSTOM_EFFECT_ID, effectIconIds: [...selectedKnown, icon.id] },
      [icon]
    );
  };

  const commitSize = (value: number) => {
    if (!sizeDirty.current) return;
    sizeDirty.current = false;
    onCommit({ ...effect, effectSize: value });
  };

  const noneTile = (
    <ChoiceTile theme={t} selected={effect.effectId === null} onClick={() => chooseSource(null)}>
      <span aria-hidden="true" style={{ fontSize: "18px" }}>
        🚫
      </span>
      <span style={{ fontSize: "12px", fontWeight: 600 }}>{translate("none")}</span>
    </ChoiceTile>
  );

  return (
    <div style={{ marginBottom: "12px" }}>
      <Label theme={t}>{translate("effect")}</Label>
      <p style={hint}>{translate("optionalFloatingMotifsBehindEventPage")}</p>

      <Field theme={t} label={translate("searchIcons")} hint={translate("searchIconsHint")}>
        <Input
          theme={t}
          type="search"
          value={query}
          maxLength={EFFECT_SEARCH_MAX_QUERY_LENGTH}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={translate("searchIconsPlaceholder")}
          autoComplete="off"
          spellCheck={false}
        />
      </Field>

      {unavailable && (
        <InlineAlert theme={t} tone="warning">
          {translate("iconsUnavailable")}
        </InlineAlert>
      )}

      {isCustom && selectedKnown.length > 0 && (
        <div style={{ marginBottom: "14px" }}>
          <Label theme={t}>{translate("selectedIcons")}</Label>
          <ul
            style={{
              listStyle: "none",
              margin: 0,
              padding: 0,
              display: "flex",
              flexWrap: "wrap",
              gap: "8px",
            }}
          >
            {selectedKnown.map((id) => {
              const icon = libraryIcons[id];
              const label = libraryIconLabel(icon, locale);
              return (
                <li
                  key={id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    minWidth: 0,
                    maxWidth: "100%",
                    padding: "4px 4px 4px 10px",
                    borderRadius: "10px",
                    border: `1px solid ${t.inputBorder}`,
                    backgroundColor: t.inputBg,
                    color: t.textPrimary,
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={icon.src}
                    alt=""
                    width={24}
                    height={24}
                    style={{ width: "24px", height: "24px", objectFit: "contain", flexShrink: 0 }}
                  />
                  <span style={{ ...ellipsis, fontSize: "13px", fontWeight: 600 }}>{label}</span>
                  <Button
                    theme={t}
                    variant="icon"
                    size="sm"
                    aria-label={translate("removeIcon", { name: label })}
                    title={translate("removeIcon", { name: label })}
                    onClick={() => toggleIcon(icon)}
                  >
                    <X size={16} aria-hidden="true" />
                  </Button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {limitNotice && (
        <InlineAlert theme={t} tone="info">
          {translate("maxIconsReached")}
        </InlineAlert>
      )}

      {!searchActive ? (
        <div style={grid}>
          {noneTile}
          {sortedEffectSets.map((e) => (
            <ChoiceTile
              key={e.id}
              theme={t}
              selected={effect.effectId === e.id}
              onClick={() => chooseSource(e.id)}
              title={shared("effects." + e.id)}
            >
              <span aria-hidden="true" style={{ fontSize: "18px" }}>
                {e.emoji}
              </span>
              <span style={{ ...ellipsis, fontSize: "12px", fontWeight: 600 }}>
                {shared("effects." + e.id)}
              </span>
            </ChoiceTile>
          ))}
        </div>
      ) : (
        <div>
          {/* None stays one click away whatever the search returns. */}
          <div style={grid}>
            {noneTile}
            {search.items.map((icon) => {
              const label = libraryIconLabel(icon, locale);
              return (
                <ChoiceTile
                  key={icon.id}
                  theme={t}
                  selected={selectedKnown.includes(icon.id)}
                  onClick={() => toggleIcon(icon)}
                  title={label}
                  data-icon-id={icon.id}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={icon.src}
                    alt=""
                    width={32}
                    height={32}
                    loading="lazy"
                    decoding="async"
                    style={{ width: "32px", height: "32px", objectFit: "contain" }}
                  />
                  <span style={{ ...ellipsis, fontSize: "12px", fontWeight: 600 }}>{label}</span>
                </ChoiceTile>
              );
            })}
          </div>

          <p role="status" style={{ ...hint, margin: "8px 0" }}>
            {pending
              ? translate("searchingIcons")
              : search.error
                ? ""
                : search.total === 0
                  ? translate("noIconsFound", { query: query.trim() })
                  : translate("iconResultCount", {
                      shown: search.items.length,
                      total: search.total,
                    })}
          </p>

          {search.error && (
            <InlineAlert
              theme={t}
              tone={search.error.kind === "rate_limited" ? "warning" : "error"}
              style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}
            >
              <span style={{ flex: 1, minWidth: "12em" }}>
                {search.error.kind === "rate_limited"
                  ? translate("iconSearchRateLimited", { seconds: search.error.retryAfter })
                  : translate("iconSearchFailed")}
              </span>
              <Button theme={t} variant="secondary" size="sm" onClick={retry}>
                {translate("tryAgain")}
              </Button>
            </InlineAlert>
          )}

          {search.nextOffset != null && !search.error && (
            <Button
              theme={t}
              variant="secondary"
              fullWidth
              disabled={search.loading}
              onClick={loadMore}
            >
              {translate("loadMoreIcons")}
            </Button>
          )}
        </div>
      )}

      {effect.effectId && (
        <div style={{ marginTop: "16px", display: "flex", flexDirection: "column", gap: "14px" }}>
          <div role="group" aria-labelledby={`${sizeId}-amount`}>
            <Label theme={t} id={`${sizeId}-amount`}>
              {translate("amount")}
            </Label>
            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
              {(Object.keys(EFFECT_AMOUNTS) as EffectAmount[]).map((amount) => (
                <Chip
                  key={amount}
                  theme={t}
                  selected={effectAmountFor(effect.effectDensity) === amount}
                  onClick={() => onCommit({ ...effect, effectDensity: EFFECT_AMOUNTS[amount] })}
                >
                  {shared("amount." + amount)}
                </Chip>
              ))}
            </div>
          </div>

          <div role="group" aria-labelledby={`${sizeId}-size`}>
            <Label theme={t} id={`${sizeId}-size`}>
              {translate("size")}
            </Label>
            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "10px" }}>
              {(Object.keys(EFFECT_SIZE_PRESETS) as EffectSizePreset[]).map((preset) => (
                <Chip
                  key={preset}
                  theme={t}
                  selected={sizePreset === preset}
                  onClick={() => {
                    sizeDirty.current = false;
                    onCommit({ ...effect, effectSize: EFFECT_SIZE_PRESETS[preset] });
                  }}
                >
                  {shared("size." + preset)}
                </Chip>
              ))}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <Range
                theme={t}
                id={`${sizeId}-range`}
                aria-label={translate("exactSize")}
                aria-valuetext={formatSize(effect.effectSize)}
                min={EFFECT_SIZE_MIN}
                max={EFFECT_SIZE_MAX}
                step={EFFECT_SIZE_STEP}
                value={effect.effectSize}
                onChange={(e) => {
                  sizeDirty.current = true;
                  onPreview({ ...effect, effectSize: Number(e.currentTarget.value) });
                }}
                onPointerUp={(e) => commitSize(Number(e.currentTarget.value))}
                onTouchEnd={(e) => commitSize(Number(e.currentTarget.value))}
                onKeyUp={(e) => commitSize(Number(e.currentTarget.value))}
                onBlur={(e) => commitSize(Number(e.currentTarget.value))}
              />
              <output
                htmlFor={`${sizeId}-range`}
                style={{
                  minWidth: "3.5em",
                  textAlign: "right",
                  fontSize: "13px",
                  fontWeight: 600,
                  color: t.textPrimary,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {formatSize(effect.effectSize)}
              </output>
            </div>
          </div>

          <div role="group" aria-labelledby={`${sizeId}-speed`}>
            <Label theme={t} id={`${sizeId}-speed`}>
              {translate("speed")}
            </Label>
            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
              {(Object.keys(EFFECT_SPEEDS) as EffectSpeed[]).map((s) => (
                <Chip
                  key={s}
                  theme={t}
                  selected={effect.effectSpeed === s}
                  onClick={() => onCommit({ ...effect, effectSpeed: s })}
                >
                  {shared("speed." + s)}
                </Chip>
              ))}
            </div>
          </div>

          <div role="group" aria-labelledby={`${sizeId}-movement`}>
            <Label theme={t} id={`${sizeId}-movement`}>
              {translate("movement")}
            </Label>
            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
              {EFFECT_MOVEMENTS.map((m) => (
                <Chip
                  key={m}
                  theme={t}
                  selected={movement === m}
                  onClick={() => onCommit({ ...effect, effectMovement: m })}
                >
                  {shared("movement." + m)}
                </Chip>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
