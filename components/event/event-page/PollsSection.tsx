"use client";

import { useTranslations } from "next-intl";

import { BarChart3, Settings } from "lucide-react";
import type { EventData } from "./types";
import type { ResolvedTheme } from "@/lib/theme";
import { EventCard } from "./EventCard";
import { Button } from "@/components/ui/Button";
import { Check, Input } from "@/components/ui/Field";

export function PollsSection({
  event,
  isPending,
  t,
  isHost,
  rsvpStatus,
  rsvpDone,
  guestName,
  isPendingGuest,
  newPollOptionTexts,
  setNewPollOptionTexts,
  pendingNoticeStyle,
  handleVote,
  handleAddPollOption,
}: {
  event: EventData;
  isPending: boolean;
  t: ResolvedTheme;
  isHost: boolean;
  rsvpStatus: "GOING" | "MAYBE" | "NO" | "INVITED" | null;
  rsvpDone: boolean;
  guestName: string;
  isPendingGuest: boolean;
  newPollOptionTexts: Record<string, string>;
  setNewPollOptionTexts: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  pendingNoticeStyle: React.CSSProperties;
  handleVote: (pollId: string, pollOptionId: string, isVoted: boolean) => Promise<void>;
  handleAddPollOption: (pollId: string) => Promise<void>;
}) {
  const translate = useTranslations("Ui.Event.PollsSection");

  return (
    <>
      {/* ── Polls Section ── */}
      {event.polls && event.polls.length > 0 && (
        <EventCard id="polls" theme={t}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "16px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <BarChart3 size={16} style={{ color: t.accent }} />
              <span style={{ fontWeight: 700 }}>{translate("polls")}</span>
            </div>
            {isHost && (
              <a
                href={`/e/${event.slug}/settings?section=polls`}
                style={{ color: t.textMuted, display: "flex", alignItems: "center" }}
              >
                <Settings size={13} />
              </a>
            )}
          </div>

          {isPendingGuest && (
            <div style={pendingNoticeStyle}>{translate("mustApprovedGuestVoteRsvpAwaiting")}</div>
          )}

          {/* Polls List */}
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {event.polls?.map((poll) => {
              const totalVotes = poll.options.reduce((sum, o) => sum + o.votes.length, 0);
              const voter = isHost ? "Host" : guestName;
              const isEligibleToVote =
                isHost ||
                (rsvpDone && !isPendingGuest && (rsvpStatus === "GOING" || rsvpStatus === "MAYBE"));
              const canVote = isEligibleToVote && !poll.locked && !isPending;
              const shouldShowVoters = !poll.hideVoters || isHost;

              return (
                <div
                  key={poll.id}
                  style={{
                    borderBottom:
                      event.polls.length > 1 ? `1px solid rgba(255, 255, 255, 0.05)` : "none",
                    paddingBottom: event.polls.length > 1 ? "16px" : 0,
                    position: "relative" as const,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      gap: "8px",
                      marginBottom: "6px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        flexWrap: "wrap",
                      }}
                    >
                      <div style={{ fontWeight: 600, fontSize: "15px", color: t.textPrimary }}>
                        {poll.question}
                      </div>
                      {poll.locked && (
                        <span
                          style={{
                            fontSize: "10px",
                            fontWeight: 700,
                            padding: "2px 6px",
                            borderRadius: "99px",
                            background: t.status.error.bg,
                            color: t.status.error.text,
                          }}
                        >
                          {translate("locked")}
                        </span>
                      )}
                      {poll.hideVoters && (
                        <span
                          style={{
                            fontSize: "10px",
                            fontWeight: 700,
                            padding: "2px 6px",
                            borderRadius: "99px",
                            background: "rgba(255, 255, 255, 0.08)",
                            color: t.textSecondary,
                          }}
                        >
                          {translate("anonymous")}
                        </span>
                      )}
                    </div>
                  </div>

                  <div style={{ fontSize: "11px", color: t.textMuted, marginBottom: "12px" }}>
                    {poll.multiChoice ? translate("selectMultiple") : translate("selectOne")}
                    {poll.allowGuestsToAdd && translate("guestsCanSuggestOptions")}
                  </div>

                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "8px",
                      marginBottom: "12px",
                    }}
                  >
                    {poll.options.map((opt) => {
                      const optVotesCount = opt.votes.length;
                      const percent =
                        totalVotes > 0 ? Math.round((optVotesCount / totalVotes) * 100) : 0;
                      const isVoted = opt.votes.some((v) => v.voterName === voter);

                      return (
                        <div
                          key={opt.id}
                          style={{
                            position: "relative" as const,
                            borderRadius: t.btnRadius,
                            border: `1px solid ${isVoted ? t.accent : "rgba(255, 255, 255, 0.06)"}`,
                            overflow: "hidden" as const,
                            background: "rgba(255, 255, 255, 0.02)",
                            display: "flex",
                            flexDirection: "column",
                            justifyContent: "center",
                            padding: "10px 14px",
                            transition: "border-color 0.2s ease",
                          }}
                        >
                          {/* Accent colored progress bar fill */}
                          <div
                            style={{
                              position: "absolute" as const,
                              top: 0,
                              left: 0,
                              bottom: 0,
                              width: `${percent}%`,
                              background: t.accent,
                              opacity: 0.1,
                              zIndex: 0,
                              pointerEvents: "none" as const,
                              transition: "width 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
                            }}
                          />

                          <div
                            style={{
                              position: "relative" as const,
                              zIndex: 1,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              gap: "10px",
                            }}
                          >
                            <label
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "8px",
                                cursor: canVote ? "pointer" : "default",
                                flex: 1,
                                fontSize: "13.5px",
                                fontWeight: isVoted ? 600 : 500,
                                color: isVoted ? t.textPrimary : t.textSecondary,
                              }}
                            >
                              <Check
                                theme={t}
                                type={poll.multiChoice ? "checkbox" : "radio"}
                                name={`poll-${poll.id}`}
                                checked={isVoted}
                                disabled={!canVote}
                                onChange={(e) => handleVote(poll.id, opt.id, e.target.checked)}
                              />
                              <span>{opt.text}</span>
                              {opt.creatorName && (
                                <span
                                  style={{
                                    fontSize: "11px",
                                    color: t.textMuted,
                                    fontStyle: "italic",
                                  }}
                                >
                                  {translate("by")} {opt.creatorName})
                                </span>
                              )}
                            </label>

                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "8px",
                                zIndex: 2,
                              }}
                            >
                              <span
                                style={{
                                  fontSize: "12px",
                                  fontWeight: 700,
                                  color: isVoted ? t.accent : t.textSecondary,
                                }}
                              >
                                {percent}% ({optVotesCount})
                              </span>
                            </div>
                          </div>

                          {/* Show voters names */}
                          {optVotesCount > 0 && (
                            <div
                              style={{
                                position: "relative" as const,
                                zIndex: 1,
                                fontSize: "11px",
                                color: t.textMuted,
                                marginLeft: "22px",
                                marginTop: "2px",
                              }}
                            >
                              {shouldShowVoters ? (
                                opt.votes.map((v) => v.voterName).join(", ")
                              ) : (
                                <span style={{ fontStyle: "italic" }}>
                                  {translate("votersHidden")}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Suggest Option form for Guests */}
                  {poll.allowGuestsToAdd && isEligibleToVote && !poll.locked && (
                    <div style={{ display: "flex", gap: "6px", marginTop: "12px" }}>
                      <Input
                        theme={t}
                        aria-label={translate("suggestAnotherOption")}
                        placeholder={translate("suggestAnotherOption")}
                        value={newPollOptionTexts[poll.id] ?? ""}
                        onChange={(e) => {
                          setNewPollOptionTexts((prev) => ({
                            ...prev,
                            [poll.id]: e.target.value,
                          }));
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleAddPollOption(poll.id);
                        }}
                      />
                      <Button
                        theme={t}
                        variant="secondary"
                        onClick={() => handleAddPollOption(poll.id)}
                        disabled={!newPollOptionTexts[poll.id]?.trim() || isPending}
                        style={{ whiteSpace: "nowrap" }}
                      >
                        {translate("suggest")}
                      </Button>
                    </div>
                  )}

                  {!isEligibleToVote && !poll.locked && (
                    <div
                      style={{
                        fontSize: "11.5px",
                        color: t.textMuted,
                        fontStyle: "italic",
                        marginTop: "8px",
                        display: "flex",
                        alignItems: "center",
                        gap: "4px",
                      }}
                    >
                      {translate("rsvpGoingOrMaybeVoteSuggest")}
                    </div>
                  )}

                  {poll.locked && (
                    <div
                      style={{
                        fontSize: "11.5px",
                        color: t.textMuted,
                        fontStyle: "italic",
                        marginTop: "8px",
                        display: "flex",
                        alignItems: "center",
                        gap: "4px",
                      }}
                    >
                      {translate("pollLockedVotingClosed")}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </EventCard>
      )}
    </>
  );
}
