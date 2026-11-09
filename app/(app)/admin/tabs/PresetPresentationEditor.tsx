"use client";
import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { APP_SHELL_THEME as T } from "@/lib/theme";
import { presetPresentation, type PresetPresentation } from "@/lib/theme-preset-presentation";
import { getPresetIconSummaries } from "@/app/actions/admin";
import { EffectsPanel, useIconSearch } from "@/components/event/settings-page/EffectsPanel";
import {
  initialEffectState,
  effectStateToFields,
} from "@/components/event/settings-page/effect-state";
import type { LibraryIconSummary } from "@/lib/effect-catalog-shared";
import { libraryIconLabel } from "@/lib/effect-catalog-shared";
import { Field, Input, Select } from "@/components/ui/Field";
import { ChoiceTile } from "@/components/ui/Choice";
import { Button } from "@/components/ui/Button";
import { InlineAlert } from "@/components/ui/Feedback";
import { PresetIcon } from "@/components/event/PresetIcon";

export function PresetPresentationEditor({
  value,
  seasonal,
  onChange,
}: {
  value: unknown;
  /** Supplies the category of a preset saved before categories existed. */
  seasonal?: boolean;
  onChange: (p: PresetPresentation) => void;
}) {
  const p = presetPresentation(value, seasonal);
  const tr = useTranslations("Ui.Admin");
  const effectTr = useTranslations("Ui.Event.ThemePanel");
  const locale = useLocale();
  const [query, setQuery] = useState("");
  const [known, setKnown] = useState<Record<string, LibraryIconSummary>>({});
  const [failed, setFailed] = useState(false);
  const search = useIconSearch("admin", query, locale);
  const ids = JSON.stringify(p.effect?.effectIconIds ?? []);
  useEffect(() => {
    let current = true;
    void getPresetIconSummaries(JSON.parse(ids) as string[])
      .then((items) => {
        if (current) {
          setKnown((old) => ({ ...old, ...Object.fromEntries(items.map((i) => [i.id, i])) }));
          setFailed(false);
        }
      })
      .catch(() => {
        if (current) setFailed(true);
      });
    return () => {
      current = false;
    };
  }, [ids]);
  const remember = (items: LibraryIconSummary[]) =>
    setKnown((old) => ({ ...old, ...Object.fromEntries(items.map((i) => [i.id, i])) }));
  return (
    <>
      <Field theme={T} label={tr("presetCategory")}>
        <Select
          theme={T}
          value={p.category}
          onChange={(e) =>
            onChange({ ...p, category: e.target.value as PresetPresentation["category"] })
          }
        >
          <option value="general">{tr("generalCategory")}</option>
          <option value="seasonal">{tr("seasonalCategory")}</option>
          <option value="occasion">{effectTr("occasions")}</option>
        </Select>
      </Field>
      <Field theme={T} label={tr("presetTileIcon")}>
        <PresetIcon id={p.tileIconId} size={32} />
        <Input
          theme={T}
          aria-label={tr("searchTileIcons")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </Field>
      {search.search.error && (
        <InlineAlert theme={T} tone="error">
          {effectTr("iconSearchFailed")}
        </InlineAlert>
      )}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill,minmax(80px,1fr))",
          gap: 8,
        }}
      >
        {search.search.items.map((i) => (
          <ChoiceTile
            key={i.id}
            theme={T}
            selected={i.id === p.tileIconId}
            onClick={() => onChange({ ...p, tileIconId: i.id })}
          >
            <PresetIcon id={i.id} />
            {libraryIconLabel(i, locale)}
          </ChoiceTile>
        ))}
      </div>
      {search.search.nextOffset != null && (
        <Button theme={T} variant="secondary" type="button" onClick={search.loadMore}>
          {effectTr("loadMoreIcons")}
        </Button>
      )}
      {failed && (
        <InlineAlert theme={T} tone="error">
          {effectTr("iconSearchFailed")}
        </InlineAlert>
      )}
      <EffectsPanel
        libraryOnly
        eventId="admin"
        t={T}
        effect={initialEffectState(p.effect)}
        libraryIcons={known}
        onPreview={(e) => onChange({ ...p, effect: e.effectId ? effectStateToFields(e) : null })}
        onCommit={(e, items) => {
          if (items) remember(items);
          onChange({ ...p, effect: e.effectId ? effectStateToFields(e) : null });
        }}
      />
    </>
  );
}
