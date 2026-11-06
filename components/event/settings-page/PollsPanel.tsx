"use client";

import { useTranslations } from "next-intl";

import React, { useState } from "react";
import { Plus, X } from "lucide-react";
import type { ResolvedTheme } from "@/lib/theme";
import type { PollEntry } from "./types";
import { Section } from "./ui";
import { Button } from "@/components/ui/Button";
import { Check, Input, Label } from "@/components/ui/Field";
import { Toggle } from "@/components/ui/Toggle";

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
}) {
  const translate = useTranslations("Ui.Event.PollsPanel");

  const [addingPoll, setAddingPoll] = useState(false);
  const checkRow: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    fontSize: "13px",
    color: t.textSecondary,
    cursor: "pointer",
  };

  return (
    <Section title={translate("managePolls")} t={t}>
      {/* Create Poll Form */}
      {addingPoll ? (
        <div
          style={{
            padding: "16px",
            borderRadius: "12px",
            border: `1px solid ${t.inputBorder}`,
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
            <Input
              theme={t}
              aria-label={translate("createNewPoll")}
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
            <Label theme={t} style={{ marginBottom: 0 }}>
              {translate("options")}
            </Label>
            {newPollOptions.map((opt, idx) => (
              <div key={idx} style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                <Input
                  theme={t}
                  aria-label={translate("optionPlaceholder", { number: idx + 1 })}
                  placeholder={translate("optionPlaceholder", { number: idx + 1 })}
                  value={opt}
                  onChange={(e) => {
                    const updated = [...newPollOptions];
                    updated[idx] = e.target.value;
                    setNewPollOptions(updated);
                  }}
                />
                {newPollOptions.length > 2 && (
                  <Button
                    theme={t}
                    variant="icon"
                    type="button"
                    aria-label={`${translate("delete")}: ${translate("optionPlaceholder", { number: idx + 1 })}`}
                    onClick={() => {
                      setNewPollOptions(newPollOptions.filter((_, i) => i !== idx));
                    }}
                  >
                    <X size={16} aria-hidden="true" />
                  </Button>
                )}
              </div>
            ))}
            <Button
              theme={t}
              variant="add"
              size="sm"
              type="button"
              onClick={() => setNewPollOptions([...newPollOptions, ""])}
              style={{ alignSelf: "flex-start" }}
            >
              <Plus size={14} aria-hidden="true" /> {translate("addOption")}
            </Button>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "8px",
              marginBottom: "16px",
            }}
          >
            <label style={checkRow}>
              <Check
                theme={t}
                checked={newPollMultiChoice}
                onChange={(e) => setNewPollMultiChoice(e.target.checked)}
              />
              <span>{translate("allowVotingMultipleOptions")}</span>
            </label>
            <label style={checkRow}>
              <Check
                theme={t}
                checked={newPollAllowGuestsToAdd}
                onChange={(e) => setNewPollAllowGuestsToAdd(e.target.checked)}
              />
              <span>{translate("allowGuestsSuggestOptions")}</span>
            </label>
            <label style={checkRow}>
              <Check
                theme={t}
                checked={newPollHideVoters}
                onChange={(e) => setNewPollHideVoters(e.target.checked)}
              />
              <span>{translate("hideVoterNamesOtherGuests")}</span>
            </label>
          </div>

          <div style={{ display: "flex", gap: "8px" }}>
            <Button
              theme={t}
              variant="primary"
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
              style={{ flex: 1 }}
            >
              {translate("createPoll")}
            </Button>
            <Button
              theme={t}
              variant="secondary"
              type="button"
              onClick={() => {
                setAddingPoll(false);
                setNewPollQuestion("");
                setNewPollOptions(["", ""]);
              }}
              style={{ flex: 1 }}
            >
              {translate("cancel")}
            </Button>
          </div>
        </div>
      ) : (
        <Button
          theme={t}
          variant="add"
          fullWidth
          onClick={() => setAddingPoll(true)}
          style={{ marginBottom: "20px" }}
        >
          <Plus size={14} aria-hidden="true" /> {translate("addPoll")}
        </Button>
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
          <div style={{ fontSize: "13px", color: t.textSecondary }}>
            {translate("noPollsCreatedYetUseForm")}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {polls.map((poll) => (
              <div
                key={poll.id}
                style={{
                  border: `1px solid ${t.inputBorder}`,
                  borderRadius: "12px",
                  padding: "14px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "8px",
                    marginBottom: "8px",
                  }}
                >
                  <div style={{ fontWeight: 600, fontSize: "14px", color: t.textPrimary }}>
                    {poll.question}
                  </div>
                  <Button
                    theme={t}
                    variant="destructive"
                    size="sm"
                    type="button"
                    onClick={() => handleDeletePoll(poll.id)}
                  >
                    {translate("delete")}
                  </Button>
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
                        minHeight: "40px",
                        boxSizing: "border-box",
                        background: t.inputBg,
                        padding: "0 4px 0 12px",
                        borderRadius: "10px",
                        fontSize: "13px",
                      }}
                    >
                      <span style={{ color: t.textSecondary }}>
                        {opt.text} {translate("voteCount", { count: opt.votes.length })}
                      </span>
                      {poll.options.length > 2 && (
                        <Button
                          theme={t}
                          variant="icon"
                          size="sm"
                          type="button"
                          aria-label={`${translate("delete")}: ${opt.text}`}
                          onClick={() => handleDeletePollOption(poll.id, opt.id)}
                        >
                          <X size={14} aria-hidden="true" />
                        </Button>
                      )}
                    </div>
                  ))}

                  {/* Add option to existing poll */}
                  <div style={{ display: "flex", gap: "6px", marginTop: "4px" }}>
                    <Input
                      theme={t}
                      aria-label={translate("addOption2")}
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
                    <Button
                      theme={t}
                      variant="secondary"
                      type="button"
                      onClick={() => handleAddPollOption(poll.id)}
                    >
                      {translate("add")}
                    </Button>
                  </div>
                </div>

                {/* Poll controls */}
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    borderTop: `1px solid ${t.cardBorder}`,
                    paddingTop: "8px",
                  }}
                >
                  <Toggle
                    label={translate("lockedClosedVoting")}
                    value={poll.locked}
                    onChange={(val) => handleUpdatePollSettings(poll.id, { locked: val })}
                    theme={t}
                    style={{ marginBottom: 0 }}
                  />
                  <Toggle
                    label={translate("multiChoiceVoting")}
                    value={poll.multiChoice}
                    onChange={(val) => handleUpdatePollSettings(poll.id, { multiChoice: val })}
                    theme={t}
                    style={{ marginBottom: 0 }}
                  />
                  <Toggle
                    label={translate("allowGuestsAddOptions")}
                    value={poll.allowGuestsToAdd}
                    onChange={(val) => handleUpdatePollSettings(poll.id, { allowGuestsToAdd: val })}
                    theme={t}
                    style={{ marginBottom: 0 }}
                  />
                  <Toggle
                    label={translate("hideVoterNames")}
                    value={poll.hideVoters}
                    onChange={(val) => handleUpdatePollSettings(poll.id, { hideVoters: val })}
                    theme={t}
                    style={{ marginBottom: 0 }}
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
