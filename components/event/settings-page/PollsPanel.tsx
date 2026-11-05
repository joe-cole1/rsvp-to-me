"use client";

import { useTranslations } from "next-intl";

import React, { useState } from "react";
import { Plus, X } from "lucide-react";
import type { ResolvedTheme } from "@/lib/theme";
import type { PollEntry } from "./types";
import type { SettingsPageStyles } from "./styles";
import { Section, Toggle } from "./ui";

export function PollsPanel({
  polls,
  newPollQuestion,
  setNewPollQuestion,
  newPollOptions,
  setNewPollOptions,
  newPollMultiChoice,
  setNewPollMultiChoice,
  newPollAllowGuestsToAdd,
  setNewPollAllowGuestsToAdd,
  newPollHideVoters,
  setNewPollHideVoters,
  newPollOptionTexts,
  setNewPollOptionTexts,
  handleAddPoll,
  handleDeletePoll,
  handleUpdatePollSettings,
  handleAddPollOption,
  handleDeletePollOption,
  isPending,
  t,
  S,
}: {
  polls: PollEntry[];
  newPollQuestion: string;
  setNewPollQuestion: React.Dispatch<React.SetStateAction<string>>;
  newPollOptions: string[];
  setNewPollOptions: React.Dispatch<React.SetStateAction<string[]>>;
  newPollMultiChoice: boolean;
  setNewPollMultiChoice: React.Dispatch<React.SetStateAction<boolean>>;
  newPollAllowGuestsToAdd: boolean;
  setNewPollAllowGuestsToAdd: React.Dispatch<React.SetStateAction<boolean>>;
  newPollHideVoters: boolean;
  setNewPollHideVoters: React.Dispatch<React.SetStateAction<boolean>>;
  newPollOptionTexts: Record<string, string>;
  setNewPollOptionTexts: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  handleAddPoll: () => void;
  handleDeletePoll: (pollId: string) => void;
  handleUpdatePollSettings: (
    pollId: string,
    settings: {
      question?: string;
      multiChoice?: boolean;
      allowGuestsToAdd?: boolean;
      locked?: boolean;
      hideVoters?: boolean;
    }
  ) => void;
  handleAddPollOption: (pollId: string) => void;
  handleDeletePollOption: (pollId: string, optionId: string) => void;
  isPending: boolean;
  t: ResolvedTheme;
  S: SettingsPageStyles;
}) {
  const translate = useTranslations("Ui.Event.PollsPanel");

  const [addingPoll, setAddingPoll] = useState(false);

  return (
    <Section title={translate("managePolls")} t={t}>
      {/* Create Poll Form */}
      {addingPoll ? (
        <div
          style={{
            background: "rgba(255, 255, 255, 0.03)",
            padding: "16px",
            borderRadius: t.cardRadius,
            border: `1px solid ${t.cardBorder}`,
            marginBottom: "20px",
          }}
        >
          <div
            style={{
              fontWeight: 700,
              fontSize: "14px",
              color: t.textPrimary,
              marginBottom: "12px",
            }}
          >
            {translate("createNewPoll")}
          </div>
          <div style={{ marginBottom: "12px" }}>
            <input
              style={S.inp}
              placeholder={translate("askQuestionEGWhatDay")}
              value={newPollQuestion}
              onChange={(e) => setNewPollQuestion(e.target.value)}
            />
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "8px",
              marginBottom: "12px",
            }}
          >
            <div style={{ fontSize: "12px", fontWeight: 700, color: t.textMuted }}>
              {translate("options")}
            </div>
            {newPollOptions.map((opt, idx) => (
              <div key={idx} style={{ display: "flex", gap: "6px" }}>
                <input
                  style={{ ...S.inp, padding: "8px 12px" }}
                  placeholder={translate("optionPlaceholder", { number: idx + 1 })}
                  value={opt}
                  onChange={(e) => {
                    const updated = [...newPollOptions];
                    updated[idx] = e.target.value;
                    setNewPollOptions(updated);
                  }}
                />
                {newPollOptions.length > 2 && (
                  <button
                    type="button"
                    onClick={() => {
                      setNewPollOptions(newPollOptions.filter((_, i) => i !== idx));
                    }}
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      color: t.textMuted,
                      padding: "4px",
                    }}
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={() => setNewPollOptions([...newPollOptions, ""])}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                color: t.accentText,
                fontSize: "12px",
                fontWeight: 600,
                display: "flex",
                alignItems: "center",
                gap: "4px",
                alignSelf: "flex-start",
                padding: "4px 0",
              }}
            >
              <Plus size={14} /> {translate("addOption")}
            </button>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "8px",
              marginBottom: "16px",
            }}
          >
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                fontSize: "13px",
                color: t.textSecondary,
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={newPollMultiChoice}
                onChange={(e) => setNewPollMultiChoice(e.target.checked)}
                style={{ cursor: "pointer" }}
              />
              <span>{translate("allowVotingMultipleOptions")}</span>
            </label>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                fontSize: "13px",
                color: t.textSecondary,
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={newPollAllowGuestsToAdd}
                onChange={(e) => setNewPollAllowGuestsToAdd(e.target.checked)}
                style={{ cursor: "pointer" }}
              />
              <span>{translate("allowGuestsSuggestOptions")}</span>
            </label>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                fontSize: "13px",
                color: t.textSecondary,
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={newPollHideVoters}
                onChange={(e) => setNewPollHideVoters(e.target.checked)}
                style={{ cursor: "pointer" }}
              />
              <span>{translate("hideVoterNamesOtherGuests")}</span>
            </label>
          </div>

          <div style={{ display: "flex", gap: "8px" }}>
            <button
              type="button"
              onClick={() => {
                handleAddPoll();
                setAddingPoll(false);
              }}
              disabled={
                !newPollQuestion.trim() ||
                newPollOptions.filter((o) => o.trim()).length < 2 ||
                isPending
              }
              style={{
                ...S.smallBtn,
                flex: 1,
                padding: "10px",
                borderRadius: "10px",
                fontSize: "13px",
              }}
            >
              {translate("createPoll")}
            </button>
            <button
              type="button"
              onClick={() => {
                setAddingPoll(false);
                setNewPollQuestion("");
                setNewPollOptions(["", ""]);
              }}
              style={{
                ...S.smallBtn,
                flex: 1,
                padding: "10px",
                borderRadius: "10px",
                fontSize: "13px",
                background: t.inputBg,
                color: t.textSecondary,
                border: `1px solid ${t.inputBorder}`,
              }}
            >
              {translate("cancel")}
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setAddingPoll(true)}
          style={{
            marginBottom: "20px",
            display: "flex",
            alignItems: "center",
            gap: "6px",
            background: t.inputBg,
            border: `1px dashed ${t.accentBorder}`,
            borderRadius: "10px",
            padding: "10px 14px",
            color: t.textMuted,
            cursor: "pointer",
            fontFamily: "inherit",
            fontSize: "13px",
            width: "100%",
          }}
        >
          <Plus size={14} /> {translate("addPoll")}
        </button>
      )}

      {/* List Existing Polls */}
      <div>
        <div
          style={{
            fontWeight: 700,
            fontSize: "14px",
            color: t.textPrimary,
            marginBottom: "12px",
          }}
        >
          {translate("activePolls")}
          {polls.length})
        </div>
        {polls.length === 0 ? (
          <div style={{ fontSize: "13px", color: t.textMuted, fontStyle: "italic" }}>
            {translate("noPollsCreatedYetUseForm")}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {polls.map((poll) => (
              <div
                key={poll.id}
                style={{
                  background: "rgba(255, 255, 255, 0.02)",
                  border: `1px solid ${t.cardBorder}`,
                  borderRadius: t.cardRadius,
                  padding: "14px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: "8px",
                  }}
                >
                  <div style={{ fontWeight: 600, fontSize: "14px", color: t.textPrimary }}>
                    {poll.question}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeletePoll(poll.id)}
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      color: "#ef4444",
                      fontSize: "12px",
                      fontWeight: 600,
                    }}
                  >
                    {translate("delete")}
                  </button>
                </div>

                {/* Poll options list with delete buttons */}
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "6px",
                    marginBottom: "12px",
                  }}
                >
                  {poll.options.map((opt) => (
                    <div
                      key={opt.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        background: t.inputBg,
                        padding: "6px 10px",
                        borderRadius: "8px",
                        fontSize: "12.5px",
                      }}
                    >
                      <span style={{ color: t.textSecondary }}>
                        {opt.text} {translate("voteCount", { count: opt.votes.length })}
                      </span>
                      {poll.options.length > 2 && (
                        <button
                          type="button"
                          onClick={() => handleDeletePollOption(poll.id, opt.id)}
                          style={{
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            color: t.textMuted,
                            display: "flex",
                            alignItems: "center",
                          }}
                        >
                          <X size={12} />
                        </button>
                      )}
                    </div>
                  ))}

                  {/* Add option to existing poll */}
                  <div style={{ display: "flex", gap: "6px", marginTop: "4px" }}>
                    <input
                      style={{ ...S.inp, padding: "6px 10px", fontSize: "12px" }}
                      placeholder={translate("addOption2")}
                      value={newPollOptionTexts[poll.id] ?? ""}
                      onChange={(e) =>
                        setNewPollOptionTexts({
                          ...newPollOptionTexts,
                          [poll.id]: e.target.value,
                        })
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleAddPollOption(poll.id);
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => handleAddPollOption(poll.id)}
                      style={{ ...S.smallBtn, padding: "6px 12px", fontSize: "12px" }}
                    >
                      {translate("add")}
                    </button>
                  </div>
                </div>

                {/* Poll controls */}
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "6px",
                    borderTop: `1px solid ${t.cardBorder}`,
                    paddingTop: "8px",
                  }}
                >
                  <Toggle
                    label={translate("lockedClosedVoting")}
                    value={poll.locked}
                    onChange={(val) => handleUpdatePollSettings(poll.id, { locked: val })}
                    t={t}
                  />
                  <Toggle
                    label={translate("multiChoiceVoting")}
                    value={poll.multiChoice}
                    onChange={(val) => handleUpdatePollSettings(poll.id, { multiChoice: val })}
                    t={t}
                  />
                  <Toggle
                    label={translate("allowGuestsAddOptions")}
                    value={poll.allowGuestsToAdd}
                    onChange={(val) => handleUpdatePollSettings(poll.id, { allowGuestsToAdd: val })}
                    t={t}
                  />
                  <Toggle
                    label={translate("hideVoterNames")}
                    value={poll.hideVoters}
                    onChange={(val) => handleUpdatePollSettings(poll.id, { hideVoters: val })}
                    t={t}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Section>
  );
}
