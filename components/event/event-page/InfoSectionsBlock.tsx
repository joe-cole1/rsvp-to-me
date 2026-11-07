"use client";

import { useTranslations } from "next-intl";

import { Plus, X, ExternalLink, Pencil, ChevronUp, ChevronDown } from "lucide-react";
import { IconPicker } from "./IconPicker";
import { getIconItem, getPlaceholder, ICON_SET, PRESET_CHIPS } from "./helpers";
import type { EventData } from "./types";
import type { ResolvedTheme } from "@/lib/theme";
import { EventCard } from "./EventCard";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Field";
import { Toast } from "@/components/ui/Feedback";

export function InfoSectionsBlock({
  event,
  t,
  isHost,
  pendingDelete,
  addingSection,
  setAddingSection,
  sectionDraft,
  setSectionDraft,
  editingSection,
  setEditingSection,
  editDraft,
  setEditDraft,
  commitInfoSection,
  deleteSection,
  undoDeleteSection,
  startEditSection,
  commitEditSection,
  moveSection,
}: {
  event: EventData;
  t: ResolvedTheme;
  isHost: boolean;
  pendingDelete: {
    id: string;
    section: EventData["infoSections"][number];
    timer: ReturnType<typeof setTimeout>;
  } | null;
  addingSection: boolean;
  setAddingSection: React.Dispatch<React.SetStateAction<boolean>>;
  sectionDraft: { iconKey: string; content: string; url: string; title: string };
  setSectionDraft: React.Dispatch<
    React.SetStateAction<{ iconKey: string; content: string; url: string; title: string }>
  >;
  editingSection: string | null;
  setEditingSection: React.Dispatch<React.SetStateAction<string | null>>;
  editDraft: { iconKey: string; content: string; url: string; title: string };
  setEditDraft: React.Dispatch<
    React.SetStateAction<{ iconKey: string; content: string; url: string; title: string }>
  >;
  commitInfoSection: () => Promise<void>;
  deleteSection: (id: string) => void;
  undoDeleteSection: () => void;
  startEditSection: (sec: EventData["infoSections"][number]) => void;
  commitEditSection: (id: string) => Promise<void>;
  moveSection?: (index: number, direction: -1 | 1) => void;
}) {
  const shared = useTranslations("Ui.Event.shared");
  const translate = useTranslations("Ui.Event.InfoSectionsBlock");
  const common = useTranslations("Ui.Common");

  return (
    <>
      {/* ── Info sections ── */}
      {event.infoSections.length > 0 && (
        <EventCard theme={t} flush>
          {event.infoSections.map((sec, i) => {
            const item = getIconItem(sec.type);
            const Icon = item.icon;
            const isEditing = editingSection === sec.id;
            let displayContent = sec.content;
            let targetUrl = sec.url;

            if (sec.type === "venmo") {
              if (!displayContent.startsWith("Venmo:")) {
                displayContent = `Venmo: ${displayContent}`;
              }
              if (!targetUrl) {
                const rawUsername = sec.content.replace(/^Venmo:\s*/i, "").trim();
                if (rawUsername && !rawUsername.includes("://") && !rawUsername.includes(".")) {
                  const cleanUsername = rawUsername.replace(/^@/, "");
                  targetUrl = `https://venmo.com/${cleanUsername}`;
                }
              }
            } else if (sec.type === "zelle") {
              if (!displayContent.startsWith("Zelle:")) {
                displayContent = `Zelle: ${displayContent}`;
              }
            }
            return (
              <div key={sec.id} style={{ borderTop: i > 0 ? `1px solid ${t.cardBorder}` : "none" }}>
                {isEditing ? (
                  <div
                    style={{
                      padding: "14px 16px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "10px",
                    }}
                  >
                    <IconPicker
                      selected={editDraft.iconKey}
                      onSelect={(key) => setEditDraft((d) => ({ ...d, iconKey: key }))}
                      t={t}
                    />
                    <Textarea
                      theme={t}
                      aria-label={getPlaceholder(editDraft.iconKey, (key) =>
                        shared("placeholders." + key)
                      )}
                      style={{ resize: "none" }}
                      rows={2}
                      placeholder={getPlaceholder(editDraft.iconKey, (key) =>
                        shared("placeholders." + key)
                      )}
                      value={editDraft.content}
                      onChange={(e) => setEditDraft((d) => ({ ...d, content: e.target.value }))}
                      autoFocus
                    />
                    {(editDraft.iconKey === "zelle" || editDraft.iconKey === "venmo") && (
                      <Input
                        theme={t}
                        type="text"
                        aria-label={translate("suggestedDonationAmountOptionalEG")}
                        placeholder={translate("suggestedDonationAmountOptionalEG")}
                        value={editDraft.title}
                        onChange={(e) => setEditDraft((d) => ({ ...d, title: e.target.value }))}
                      />
                    )}
                    <Input
                      theme={t}
                      type="url"
                      aria-label={translate("linkOptional")}
                      placeholder={translate("linkOptional")}
                      value={editDraft.url}
                      onChange={(e) => setEditDraft((d) => ({ ...d, url: e.target.value }))}
                    />
                    <div style={{ display: "flex", gap: "8px" }}>
                      <Button
                        theme={t}
                        variant="primary"
                        onClick={() => commitEditSection(sec.id)}
                        style={{ flex: 1 }}
                      >
                        {translate("save")}
                      </Button>
                      <Button theme={t} variant="secondary" onClick={() => setEditingSection(null)}>
                        {translate("cancel")}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div
                    style={{
                      display: "flex",
                      gap: "10px",
                      alignItems: "center",
                      padding: "6px 8px 6px 16px",
                      minHeight: "44px",
                      boxSizing: "border-box",
                    }}
                  >
                    <Icon size={15} style={{ color: t.accent, flexShrink: 0 }} aria-hidden="true" />
                    <div style={{ flex: 1, fontSize: "13px" }}>
                      {targetUrl ? (
                        <a
                          href={targetUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: t.accentText, textDecoration: "none" }}
                        >
                          {displayContent}{" "}
                          <ExternalLink
                            size={11}
                            style={{ display: "inline", verticalAlign: "middle" }}
                          />
                        </a>
                      ) : (
                        <span style={{ color: t.textSecondary }}>{displayContent}</span>
                      )}
                      {sec.title && (sec.type === "zelle" || sec.type === "venmo") && (
                        <span style={{ marginLeft: "6px", color: t.textMuted, fontSize: "12px" }}>
                          {translate("donation", { amount: sec.title })}
                        </span>
                      )}
                    </div>
                    {isHost && (
                      <>
                        {moveSection && i > 0 && (
                          <Button
                            theme={t}
                            variant="icon"
                            size="sm"
                            onClick={() => moveSection(i, -1)}
                            aria-label={translate("moveUp")}
                            title={translate("moveUp")}
                          >
                            <ChevronUp size={16} aria-hidden="true" />
                          </Button>
                        )}
                        {moveSection && i < event.infoSections.length - 1 && (
                          <Button
                            theme={t}
                            variant="icon"
                            size="sm"
                            onClick={() => moveSection(i, 1)}
                            aria-label={translate("moveDown")}
                            title={translate("moveDown")}
                          >
                            <ChevronDown size={16} aria-hidden="true" />
                          </Button>
                        )}
                        <Button
                          theme={t}
                          variant="icon"
                          size="sm"
                          onClick={() => startEditSection(sec)}
                          aria-label={`${common("edit")}: ${displayContent}`}
                          title={common("edit")}
                        >
                          <Pencil size={14} aria-hidden="true" />
                        </Button>
                        <Button
                          theme={t}
                          variant="icon"
                          size="sm"
                          onClick={() => deleteSection(sec.id)}
                          aria-label={`${common("remove")}: ${displayContent}`}
                          title={common("remove")}
                        >
                          <X size={14} aria-hidden="true" />
                        </Button>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </EventCard>
      )}

      {/* ── Undo delete toast ── */}
      <Toast
        theme={t}
        toast={pendingDelete ? { tone: "info", message: translate("sectionRemoved") } : null}
        action={{ label: translate("undo"), onClick: undoDeleteSection }}
      />

      {/* ── Add info section (host only) ── */}
      {isHost &&
        (addingSection ? (
          <EventCard theme={t} style={{ marginBottom: "24px" }}>
            <IconPicker
              selected={sectionDraft.iconKey}
              onSelect={(key) => setSectionDraft((d) => ({ ...d, iconKey: key }))}
              t={t}
            />
            <Textarea
              theme={t}
              aria-label={getPlaceholder(sectionDraft.iconKey, (key) =>
                shared("placeholders." + key)
              )}
              style={{ resize: "none", marginBottom: "10px" }}
              rows={2}
              placeholder={getPlaceholder(sectionDraft.iconKey, (key) =>
                shared("placeholders." + key)
              )}
              value={sectionDraft.content}
              onChange={(e) => setSectionDraft((d) => ({ ...d, content: e.target.value }))}
              autoFocus
            />
            {(sectionDraft.iconKey === "zelle" || sectionDraft.iconKey === "venmo") && (
              <Input
                theme={t}
                style={{ marginBottom: "10px" }}
                type="text"
                aria-label={translate("suggestedDonationAmountOptionalEG")}
                placeholder={translate("suggestedDonationAmountOptionalEG")}
                value={sectionDraft.title}
                onChange={(e) => setSectionDraft((d) => ({ ...d, title: e.target.value }))}
              />
            )}
            <Input
              theme={t}
              style={{ marginBottom: "10px" }}
              type="url"
              aria-label={translate("linkOptional")}
              placeholder={translate("linkOptional")}
              value={sectionDraft.url}
              onChange={(e) => setSectionDraft((d) => ({ ...d, url: e.target.value }))}
            />
            <div style={{ display: "flex", gap: "8px" }}>
              <Button theme={t} variant="primary" onClick={commitInfoSection} style={{ flex: 1 }}>
                {translate("save")}
              </Button>
              <Button theme={t} variant="secondary" onClick={() => setAddingSection(false)}>
                {translate("cancel")}
              </Button>
            </div>
          </EventCard>
        ) : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "24px" }}>
            {PRESET_CHIPS.filter((p) => !event.infoSections.some((s) => s.type === p.key)).map(
              (preset) => {
                const Icon = preset.icon;
                return (
                  <Button
                    key={preset.key}
                    theme={t}
                    variant="add"
                    size="sm"
                    onClick={() => {
                      setAddingSection(true);
                      setSectionDraft({ iconKey: preset.key, content: "", url: "", title: "" });
                    }}
                  >
                    <Icon size={14} aria-hidden="true" />
                    {shared("chips." + preset.key)}
                  </Button>
                );
              }
            )}
            <Button
              theme={t}
              variant="add"
              size="sm"
              onClick={() => {
                setAddingSection(true);
                setSectionDraft({ iconKey: ICON_SET[0].key, content: "", url: "", title: "" });
              }}
            >
              <Plus size={14} aria-hidden="true" />
              {translate("addCustom")}
            </Button>
          </div>
        ))}
    </>
  );
}
