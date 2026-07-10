"use client";

import { Plus, X, ExternalLink, Pencil, ChevronUp, ChevronDown } from "lucide-react";
import { IconPicker } from "./IconPicker";
import { getIconItem, getPlaceholder, ICON_SET, PRESET_CHIPS } from "./helpers";
import type { EventData } from "./types";
import type { ResolvedTheme } from "@/lib/theme";
import type { EventPageStyles } from "./styles";

export function InfoSectionsBlock({
  event,
  t,
  S,
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
  getChipStyle,
  commitInfoSection,
  deleteSection,
  undoDeleteSection,
  startEditSection,
  commitEditSection,
  moveSection,
}: {
  event: EventData;
  t: ResolvedTheme;
  S: EventPageStyles;
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
  getChipStyle: (isCustom: boolean) => React.CSSProperties;
  commitInfoSection: () => Promise<void>;
  deleteSection: (id: string) => void;
  undoDeleteSection: () => void;
  startEditSection: (sec: EventData["infoSections"][number]) => void;
  commitEditSection: (id: string) => Promise<void>;
  moveSection?: (index: number, direction: -1 | 1) => void;
}) {
  return (
    <>
      {/* ── Info sections ── */}
      {event.infoSections.length > 0 && (
        <div
          style={{
            background: t.cardBg,
            border: `1px solid ${t.cardBorder}`,
            borderRadius: t.cardRadius,
            backdropFilter: "blur(12px)",
            marginBottom: "16px",
            overflow: "hidden",
          }}
        >
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
                    <textarea
                      style={{ ...S.inp, resize: "none" } as React.CSSProperties}
                      rows={2}
                      placeholder={getPlaceholder(editDraft.iconKey)}
                      value={editDraft.content}
                      onChange={(e) => setEditDraft((d) => ({ ...d, content: e.target.value }))}
                      autoFocus
                    />
                    {(editDraft.iconKey === "zelle" || editDraft.iconKey === "venmo") && (
                      <input
                        style={S.inp}
                        type="text"
                        placeholder="Suggested donation amount (optional, e.g. 15)"
                        value={editDraft.title}
                        onChange={(e) => setEditDraft((d) => ({ ...d, title: e.target.value }))}
                      />
                    )}
                    <input
                      style={S.inp}
                      type="url"
                      placeholder="Link (optional)"
                      value={editDraft.url}
                      onChange={(e) => setEditDraft((d) => ({ ...d, url: e.target.value }))}
                    />
                    <div style={{ display: "flex", gap: "8px" }}>
                      <button
                        onClick={() => commitEditSection(sec.id)}
                        style={{ ...S.btn, flex: 1, padding: "8px" }}
                      >
                        Save
                      </button>
                      <button onClick={() => setEditingSection(null)} style={S.mutedBtn}>
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    style={{
                      display: "flex",
                      gap: "10px",
                      alignItems: "center",
                      padding: "11px 16px",
                    }}
                  >
                    <Icon size={15} style={{ color: t.accent, flexShrink: 0 }} />
                    <div style={{ flex: 1, fontSize: "13px" }}>
                      {targetUrl ? (
                        <a
                          href={targetUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: t.accent, textDecoration: "none" }}
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
                          (Suggested: ${sec.title})
                        </span>
                      )}
                    </div>
                    {isHost && (
                      <>
                        {moveSection && i > 0 && (
                          <button
                            onClick={() => moveSection(i, -1)}
                            style={{
                              background: "none",
                              border: "none",
                              cursor: "pointer",
                              color: t.textMuted,
                              padding: "2px",
                              flexShrink: 0,
                            }}
                            title="Move Up"
                          >
                            <ChevronUp size={13} />
                          </button>
                        )}
                        {moveSection && i < event.infoSections.length - 1 && (
                          <button
                            onClick={() => moveSection(i, 1)}
                            style={{
                              background: "none",
                              border: "none",
                              cursor: "pointer",
                              color: t.textMuted,
                              padding: "2px",
                              flexShrink: 0,
                            }}
                            title="Move Down"
                          >
                            <ChevronDown size={13} />
                          </button>
                        )}
                        <button
                          onClick={() => startEditSection(sec)}
                          style={{
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            color: t.textMuted,
                            padding: "2px",
                            flexShrink: 0,
                          }}
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          onClick={() => deleteSection(sec.id)}
                          style={{
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            color: t.textMuted,
                            padding: "2px",
                            flexShrink: 0,
                          }}
                        >
                          <X size={13} />
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Undo delete toast ── */}
      {pendingDelete && (
        <div
          style={{
            position: "fixed",
            top: "20px",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: t.cardBg,
            border: `1px solid ${t.cardBorder}`,
            borderRadius: t.cardRadius,
            padding: "12px 16px",
            gap: "12px",
            boxShadow: "0 8px 30px rgba(0, 0, 0, 0.15)",
            backdropFilter: "blur(8px)",
          }}
        >
          <span style={{ fontSize: "13px", color: t.textSecondary }}>Section removed</span>
          <button
            onClick={undoDeleteSection}
            style={{
              background: "none",
              border: `1px solid ${t.cardBorder}`,
              borderRadius: t.btnRadius,
              padding: "4px 12px",
              cursor: "pointer",
              fontSize: "12px",
              fontWeight: 700,
              color: t.accent,
              fontFamily: "inherit",
            }}
          >
            Undo
          </button>
        </div>
      )}

      {/* ── Add info section (host only) ── */}
      {isHost &&
        (addingSection ? (
          <div style={{ ...S.card, marginBottom: "24px" }}>
            <IconPicker
              selected={sectionDraft.iconKey}
              onSelect={(key) => setSectionDraft((d) => ({ ...d, iconKey: key }))}
              t={t}
            />
            <textarea
              style={{ ...S.inp, resize: "none", marginBottom: "10px" } as React.CSSProperties}
              rows={2}
              placeholder={getPlaceholder(sectionDraft.iconKey)}
              value={sectionDraft.content}
              onChange={(e) => setSectionDraft((d) => ({ ...d, content: e.target.value }))}
              autoFocus
            />
            {(sectionDraft.iconKey === "zelle" || sectionDraft.iconKey === "venmo") && (
              <input
                style={{ ...S.inp, marginBottom: "10px" }}
                type="text"
                placeholder="Suggested donation amount (optional, e.g. 15)"
                value={sectionDraft.title}
                onChange={(e) => setSectionDraft((d) => ({ ...d, title: e.target.value }))}
              />
            )}
            <input
              style={{ ...S.inp, marginBottom: "10px" }}
              type="url"
              placeholder="Link (optional)"
              value={sectionDraft.url}
              onChange={(e) => setSectionDraft((d) => ({ ...d, url: e.target.value }))}
            />
            <div style={{ display: "flex", gap: "8px" }}>
              <button onClick={commitInfoSection} style={{ ...S.btn, flex: 1, padding: "10px" }}>
                Save
              </button>
              <button onClick={() => setAddingSection(false)} style={S.mutedBtn}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "24px" }}>
            {PRESET_CHIPS.filter((p) => !event.infoSections.some((s) => s.type === p.key)).map(
              (preset) => {
                const Icon = preset.icon;
                return (
                  <button
                    key={preset.key}
                    className="chip-button"
                    onClick={() => {
                      setAddingSection(true);
                      setSectionDraft({ iconKey: preset.key, content: "", url: "", title: "" });
                    }}
                    style={getChipStyle(false)}
                  >
                    <Icon size={13} />
                    {preset.label}
                  </button>
                );
              }
            )}
            <button
              className="chip-button"
              onClick={() => {
                setAddingSection(true);
                setSectionDraft({ iconKey: ICON_SET[0].key, content: "", url: "", title: "" });
              }}
              style={getChipStyle(true)}
            >
              <Plus size={13} />
              Add Custom
            </button>
          </div>
        ))}
    </>
  );
}
