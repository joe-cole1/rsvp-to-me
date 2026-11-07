"use client";

import { useTranslations } from "next-intl";

import type { ResolvedTheme } from "@/lib/theme";
import { Chip } from "@/components/ui/Choice";
import { Field, Input, Label } from "@/components/ui/Field";

export type EditableLocationType = "PHYSICAL" | "VIRTUAL" | "TBD";

export type LocationValue = {
  type: EditableLocationType;
  name: string;
  address: string;
  virtualUrl: string;
};

export function LocationFields({
  value,
  onChange,
  theme: t,
  submitNames = false,
}: {
  value: LocationValue;
  onChange: (value: LocationValue) => void;
  theme: ResolvedTheme;
  submitNames?: boolean;
}) {
  const translate = useTranslations("Ui.Event.LocationFields");

  const set = (next: Partial<LocationValue>) => onChange({ ...value, ...next });

  return (
    <div>
      {submitNames && <input type="hidden" name="locationType" value={value.type} />}
      <div style={{ marginBottom: "16px" }}>
        <Label theme={t}>{translate("type")}</Label>
        <div style={{ display: "flex", gap: "8px" }}>
          {(["PHYSICAL", "VIRTUAL", "TBD"] as const).map((type) => (
            <Chip
              key={type}
              theme={t}
              selected={value.type === type}
              style={{ flex: 1 }}
              onClick={() => set({ type })}
            >
              {type === "PHYSICAL"
                ? translate("person")
                : type === "VIRTUAL"
                  ? translate("virtual")
                  : translate("tbd")}
            </Chip>
          ))}
        </div>
      </div>

      {value.type === "PHYSICAL" && (
        <>
          <Field theme={t} label={translate("venueName")}>
            <Input
              theme={t}
              name={submitNames ? "locationName" : undefined}
              placeholder={translate("venueOrPlaceName")}
              value={value.name}
              onChange={(event) => set({ name: event.target.value })}
            />
          </Field>
          <Field theme={t} label={translate("address")}>
            <Input
              theme={t}
              name={submitNames ? "locationAddress" : undefined}
              placeholder={translate("123MainStCity")}
              value={value.address}
              onChange={(event) => set({ address: event.target.value })}
            />
          </Field>
        </>
      )}

      {value.type === "VIRTUAL" && (
        <Field theme={t} label={translate("virtualLink")}>
          <Input
            theme={t}
            name={submitNames ? "virtualUrl" : undefined}
            type="url"
            placeholder="https://zoom.us/j/..."
            value={value.virtualUrl}
            onChange={(event) => set({ virtualUrl: event.target.value })}
          />
        </Field>
      )}

      {value.type === "TBD" && (
        <p
          style={{
            fontSize: "13px",
            color: t.textSecondary,
            margin: "6px 0 16px",
            lineHeight: 1.4,
          }}
        >
          {translate("weLlShowDeterminedTbdGuests")}
        </p>
      )}
    </div>
  );
}
