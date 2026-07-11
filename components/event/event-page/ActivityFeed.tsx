"use client";

import {
  Plus,
  Users,
  MessageSquare,
  Send,
  X,
  Pencil,
  Gift,
  Calendar,
  ShieldAlert,
} from "lucide-react";
import { timeAgo } from "./helpers";
import type { EventData } from "./types";
import type { ResolvedTheme } from "@/lib/theme";
import type { EventPageStyles } from "./styles";

export function ActivityFeed({
  event,
  renderAvatar,
  isPending,
  t,
  S,
  isHost,
  isPendingGuest,
  isApprovedGuest,
  isAdminBypass,
  canViewerComment,
  selfAuthorName,
  pendingNoticeStyle,
  guestRsvpId,
  commentText,
  setCommentText,
  replyingToId,
  setReplyingToId,
  replyText,
  setReplyText,
  feedPage,
  setFeedPage,
  updateDraft,
  setUpdateDraft,
  notifyOnUpdate,
  setNotifyOnUpdate,
  isPostingUpdate,
  submitComment,
  submitReply,
  postUpdate,
  removeUpdate,
  removeActivityEvent,
}: {
  event: EventData;
  renderAvatar: (
    name: string,
    rsvpId?: string | null,
    customStyle?: React.CSSProperties
  ) => React.ReactNode;
  isPending: boolean;
  t: ResolvedTheme;
  S: EventPageStyles;
  isHost: boolean;
  isPendingGuest: boolean;
  isApprovedGuest: boolean;
  isAdminBypass: boolean;
  canViewerComment: boolean;
  selfAuthorName: string;
  pendingNoticeStyle: React.CSSProperties;
  guestRsvpId: string | null;
  commentText: string;
  setCommentText: React.Dispatch<React.SetStateAction<string>>;
  replyingToId: string | null;
  setReplyingToId: React.Dispatch<React.SetStateAction<string | null>>;
  replyText: string;
  setReplyText: React.Dispatch<React.SetStateAction<string>>;
  feedPage: number;
  setFeedPage: React.Dispatch<React.SetStateAction<number>>;
  updateDraft: string;
  setUpdateDraft: React.Dispatch<React.SetStateAction<string>>;
  notifyOnUpdate: boolean;
  setNotifyOnUpdate: React.Dispatch<React.SetStateAction<boolean>>;
  isPostingUpdate: boolean;
  submitComment: () => Promise<void>;
  submitReply: (parentId: string) => Promise<void>;
  postUpdate: () => Promise<void>;
  removeUpdate: (id: string) => void;
  removeActivityEvent: (id: string) => void;
}) {
  return (
    <>
      {/* ── Activity (updates + comments unified) ── */}
      {(event.commentsEnabled || event.updates.length > 0 || isHost) && (
        <div style={S.card}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "16px" }}>
            <MessageSquare size={16} style={{ color: t.accent }} />
            <span style={{ fontWeight: 700, fontFamily: t.headingFont }}>Activity</span>
          </div>

          {/* Compose area — top of card */}
          {isHost && (
            <div
              style={{
                background: `rgba(${t.accentRgb}, 0.07)`,
                border: `1px solid rgba(${t.accentRgb}, 0.18)`,
                borderRadius: "12px",
                padding: "12px",
                marginBottom: "12px",
              }}
            >
              <div
                style={{
                  fontWeight: 700,
                  fontSize: "12px",
                  color: t.accent,
                  textTransform: "none" as const,
                  letterSpacing: "0.02em",
                  marginBottom: "8px",
                }}
              >
                Post an Update
              </div>
              <textarea
                style={{ ...S.inp, resize: "none", marginBottom: "8px" } as React.CSSProperties}
                rows={3}
                placeholder="Changed start time, new location, what to bring…"
                value={updateDraft}
                onChange={(e) => setUpdateDraft(e.target.value)}
              />
              <div
                style={{
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
                    gap: "6px",
                    fontSize: "13px",
                    color: t.textSecondary,
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={notifyOnUpdate}
                    onChange={(e) => setNotifyOnUpdate(e.target.checked)}
                    style={{ accentColor: t.accent }}
                  />
                  Notify guests of update
                </label>
                <button
                  onClick={postUpdate}
                  disabled={!updateDraft.trim() || isPostingUpdate}
                  style={{
                    ...S.btn,
                    width: "auto",
                    padding: "8px 18px",
                    opacity: !updateDraft.trim() || isPostingUpdate ? 0.5 : 1,
                  }}
                >
                  {isPostingUpdate ? "Posting…" : "Post"}
                </button>
              </div>
            </div>
          )}
          {event.commentsEnabled && !isHost && (isApprovedGuest || canViewerComment) && (
            <div style={{ marginBottom: "16px" }}>
              {isAdminBypass ? (
                <div
                  style={{
                    fontSize: "12px",
                    color: "#fbbf24",
                    marginBottom: "6px",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  <ShieldAlert size={13} />
                  Commenting as admin — you are not RSVP&apos;d to this event.
                </div>
              ) : (
                <div style={{ fontSize: "12px", color: t.textMuted, marginBottom: "6px" }}>
                  Commenting as <strong style={{ color: t.textSecondary }}>{selfAuthorName}</strong>
                </div>
              )}
              <div style={{ display: "flex", gap: "8px" }}>
                <input
                  style={{ ...S.inp, flex: 1 }}
                  placeholder="Leave a comment…"
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      submitComment();
                    }
                  }}
                />
                <button
                  onClick={submitComment}
                  disabled={!commentText.trim() || isPending}
                  style={{
                    background: t.accent,
                    color: t.accentFg,
                    border: "none",
                    borderRadius: t.btnRadius,
                    padding: "0 16px",
                    cursor: "pointer",
                    opacity: !commentText.trim() ? 0.5 : 1,
                  }}
                >
                  <Send size={16} />
                </button>
              </div>
            </div>
          )}
          {event.commentsEnabled && !isHost && isPendingGuest && (
            <div style={pendingNoticeStyle}>
              You must be an approved guest to comment. Your RSVP is awaiting host approval.
            </div>
          )}

          {(() => {
            type FeedItem =
              | { kind: "update"; id: string; body: string; createdAt: Date }
              | {
                  kind: "comment";
                  id: string;
                  guestName: string;
                  body: string;
                  rsvpId?: string | null;
                  createdAt: Date;
                  replies: {
                    id: string;
                    guestName: string;
                    body: string;
                    rsvpId?: string | null;
                    createdAt: Date;
                  }[];
                }
              | {
                  kind: "activity";
                  id: string;
                  type: string;
                  actorName: string | null;
                  detail: string;
                  createdAt: Date;
                };
            const feed: FeedItem[] = [
              ...event.updates.map((u) => ({
                kind: "update" as const,
                id: u.id,
                body: u.body,
                createdAt: new Date(u.createdAt),
              })),
              ...(event.commentsEnabled
                ? event.comments.map((c) => ({
                    kind: "comment" as const,
                    id: c.id,
                    guestName: c.guestName,
                    body: c.body,
                    rsvpId: c.rsvpId,
                    createdAt: new Date(c.createdAt),
                    replies: c.replies.map((r) => ({
                      id: r.id,
                      guestName: r.guestName,
                      body: r.body,
                      rsvpId: r.rsvpId,
                      createdAt: new Date(r.createdAt),
                    })),
                  }))
                : []),
              ...event.activityEvents
                .filter((a) => a.type !== "comment_new")
                .map((a) => ({
                  kind: "activity" as const,
                  id: a.id,
                  type: a.type,
                  actorName: a.actorName,
                  detail: a.detail,
                  createdAt: new Date(a.createdAt),
                })),
            ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

            const PAGE_SIZE = 10;
            const totalPages = Math.ceil(feed.length / PAGE_SIZE);
            const currentPage = Math.min(feedPage, Math.max(totalPages, 1));
            const displayedFeed = feed.slice(
              (currentPage - 1) * PAGE_SIZE,
              currentPage * PAGE_SIZE
            );

            return (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {displayedFeed.length === 0 ? (
                  <p
                    style={{
                      color: t.textMuted,
                      fontSize: "14px",
                      textAlign: "center",
                      padding: "12px 0",
                    }}
                  >
                    No activity yet — be the first!
                  </p>
                ) : (
                  <>
                    {displayedFeed.map((item) => {
                      if (item.kind === "update")
                        return (
                          <div
                            key={`u-${item.id}`}
                            style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}
                          >
                            <div style={{ fontSize: "18px", flexShrink: 0, marginTop: "2px" }}>
                              📣
                            </div>
                            <div
                              style={{
                                flex: 1,
                                minWidth: 0,
                                background: t.accentBg,
                                border: `1px solid ${t.accentBorder}`,
                                borderRadius: "14px",
                                padding: "10px 14px",
                              }}
                            >
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "space-between",
                                }}
                              >
                                <span
                                  style={{ fontWeight: 700, fontSize: "13px", color: t.accent }}
                                >
                                  Update from {event.host.name ?? event.host.email}
                                </span>
                                {isHost && (
                                  <button
                                    onClick={() => removeUpdate(item.id)}
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
                                )}
                              </div>
                              {event.showTimestamps && (
                                <span style={{ color: t.textMuted, fontSize: "11px" }}>
                                  {timeAgo(item.createdAt)}
                                </span>
                              )}
                              <p
                                style={{
                                  color: t.textSecondary,
                                  fontSize: "14px",
                                  margin: "4px 0 0",
                                  whiteSpace: "pre-wrap",
                                  lineHeight: 1.6,
                                }}
                              >
                                {item.body}
                              </p>
                            </div>
                          </div>
                        );
                      if (item.kind === "activity") {
                        const iconEl = (() => {
                          if (item.type === "rsvp_new" || item.type === "rsvp_update")
                            return <Users size={14} style={{ color: t.accent }} />;
                          if (item.type === "event_date")
                            return <Calendar size={14} style={{ color: t.accent }} />;
                          if (item.type === "info_add")
                            return <Plus size={14} style={{ color: t.accent }} />;
                          if (item.type === "info_delete")
                            return <X size={14} style={{ color: t.textMuted }} />;
                          if (item.type === "potluck_claim")
                            return <Gift size={14} style={{ color: t.accent }} />;
                          if (item.type === "potluck_unclaim")
                            return <Gift size={14} style={{ color: t.textMuted }} />;
                          return <Pencil size={14} style={{ color: t.accent }} />;
                        })();
                        const [mainDetail, ...commentLines] = item.detail.split("\n");
                        const rsvpComment = commentLines.join("\n").trim();
                        return (
                          <div
                            key={`a-${item.id}`}
                            style={{
                              display: "flex",
                              gap: "10px",
                              alignItems: "flex-start",
                              padding: "6px 0",
                            }}
                          >
                            <div
                              style={{
                                width: "28px",
                                height: "28px",
                                borderRadius: "50%",
                                background:
                                  item.type.startsWith("rsvp") || item.type === "potluck_claim"
                                    ? t.accentBg
                                    : t.pillBg,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                flexShrink: 0,
                                marginTop: rsvpComment ? "2px" : 0,
                              }}
                            >
                              {iconEl}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div>
                                <span style={{ fontSize: "13px", color: t.textSecondary }}>
                                  {item.actorName && (
                                    <strong style={{ fontWeight: 700, color: t.textPrimary }}>
                                      {item.actorName}{" "}
                                    </strong>
                                  )}
                                  {mainDetail}
                                </span>
                                {event.showTimestamps && (
                                  <span
                                    style={{
                                      color: t.textMuted,
                                      fontSize: "11px",
                                      marginLeft: "8px",
                                    }}
                                  >
                                    {timeAgo(item.createdAt)}
                                  </span>
                                )}
                              </div>
                              {rsvpComment && (
                                <div
                                  style={{
                                    marginTop: "6px",
                                    borderLeft: `3px solid ${t.cardBorder}`,
                                    paddingLeft: "10px",
                                    color: t.textMuted,
                                    fontSize: "13px",
                                    fontStyle: "italic",
                                    lineHeight: 1.5,
                                  }}
                                >
                                  {rsvpComment}
                                </div>
                              )}
                            </div>
                            {isHost && (
                              <button
                                onClick={() => removeActivityEvent(item.id)}
                                title="Hide from activity"
                                style={{
                                  background: "none",
                                  border: "none",
                                  cursor: "pointer",
                                  color: t.textMuted,
                                  padding: "2px",
                                  flexShrink: 0,
                                  opacity: 0.6,
                                }}
                              >
                                <X size={12} />
                              </button>
                            )}
                          </div>
                        );
                      }
                      return (
                        <div key={`c-${item.id}`} style={{ display: "flex", gap: "10px" }}>
                          {renderAvatar(item.guestName, item.rsvpId, {
                            width: "36px",
                            height: "36px",
                            minWidth: "36px",
                          })}
                          <div
                            style={{
                              flex: 1,
                              background: t.inputBg,
                              borderRadius: "14px",
                              padding: "10px 14px",
                            }}
                          >
                            <span style={{ fontWeight: 700, fontSize: "13px" }}>
                              {item.guestName}
                            </span>
                            {event.showTimestamps && (
                              <span
                                style={{
                                  color: t.textMuted,
                                  fontSize: "11px",
                                  marginLeft: "8px",
                                }}
                              >
                                {timeAgo(item.createdAt)}
                              </span>
                            )}
                            <p
                              style={{
                                color: t.textSecondary,
                                fontSize: "14px",
                                margin: "4px 0 0",
                              }}
                            >
                              {item.body}
                            </p>
                            {(isHost || guestRsvpId) && (
                              <button
                                onClick={() => {
                                  setReplyingToId(replyingToId === item.id ? null : item.id);
                                  setReplyText("");
                                }}
                                style={{
                                  background: "none",
                                  border: "none",
                                  color: t.textMuted,
                                  fontSize: "12px",
                                  fontWeight: 600,
                                  cursor: "pointer",
                                  padding: "4px 0",
                                  display: "inline-block",
                                  marginTop: "6px",
                                }}
                              >
                                Reply
                              </button>
                            )}
                            {item.replies.length > 0 && (
                              <div
                                style={{
                                  marginTop: "8px",
                                  display: "flex",
                                  flexDirection: "column",
                                  gap: "6px",
                                }}
                              >
                                {item.replies.map((r) => (
                                  <div key={r.id} style={{ display: "flex", gap: "8px" }}>
                                    {renderAvatar(r.guestName, r.rsvpId, {
                                      width: "26px",
                                      height: "26px",
                                      fontSize: "11px",
                                      minWidth: "26px",
                                    })}
                                    <div
                                      style={{
                                        flex: 1,
                                        background: "rgba(255,255,255,0.05)",
                                        borderRadius: "10px",
                                        padding: "6px 10px",
                                      }}
                                    >
                                      <span style={{ fontWeight: 700, fontSize: "12px" }}>
                                        {r.guestName}
                                      </span>
                                      {event.showTimestamps && (
                                        <span
                                          style={{
                                            color: t.textMuted,
                                            fontSize: "11px",
                                            marginLeft: "6px",
                                          }}
                                        >
                                          {timeAgo(r.createdAt)}
                                        </span>
                                      )}
                                      <p
                                        style={{
                                          fontSize: "13px",
                                          margin: "2px 0 0",
                                          color: t.textSecondary,
                                        }}
                                      >
                                        {r.body}
                                      </p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                            {replyingToId === item.id && (
                              <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
                                <input
                                  type="text"
                                  placeholder="Write a reply..."
                                  value={replyText}
                                  onChange={(e) => setReplyText(e.target.value)}
                                  style={{
                                    flex: 1,
                                    background: "rgba(255, 255, 255, 0.05)",
                                    border: `1px solid ${t.cardBorder}`,
                                    borderRadius: "10px",
                                    padding: "6px 12px",
                                    color: t.textPrimary,
                                    fontSize: "13px",
                                    outline: "none",
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter" && !isPending && replyText.trim()) {
                                      submitReply(item.id);
                                    }
                                  }}
                                />
                                <button
                                  onClick={() => submitReply(item.id)}
                                  disabled={!replyText.trim() || isPending}
                                  style={{
                                    background: t.accent,
                                    color: t.accentFg,
                                    border: "none",
                                    borderRadius: "10px",
                                    padding: "0 12px",
                                    cursor: "pointer",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    opacity: !replyText.trim() ? 0.5 : 1,
                                  }}
                                >
                                  <Send size={12} />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}

                    {/* Pagination Controls */}
                    {totalPages > 1 && (
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          marginTop: "16px",
                          paddingTop: "12px",
                          borderTop: `1px solid ${t.cardBorder || "rgba(255,255,255,0.1)"}`,
                        }}
                      >
                        <button
                          onClick={() => setFeedPage((prev) => Math.max(prev - 1, 1))}
                          disabled={currentPage === 1}
                          style={{
                            padding: "6px 12px",
                            background:
                              currentPage === 1
                                ? "rgba(255,255,255,0.02)"
                                : "rgba(255,255,255,0.06)",
                            border: `1px solid ${t.cardBorder || "rgba(255,255,255,0.1)"}`,
                            borderRadius: "8px",
                            color: currentPage === 1 ? t.textMuted : t.textPrimary,
                            fontSize: "12px",
                            fontWeight: 600,
                            cursor: currentPage === 1 ? "not-allowed" : "pointer",
                            transition: "all 0.2s",
                          }}
                        >
                          Prev
                        </button>
                        <span style={{ color: t.textSecondary, fontSize: "12px" }}>
                          Page {currentPage} of {totalPages}
                        </span>
                        <button
                          onClick={() => setFeedPage((prev) => Math.min(prev + 1, totalPages))}
                          disabled={currentPage === totalPages}
                          style={{
                            padding: "6px 12px",
                            background:
                              currentPage === totalPages
                                ? "rgba(255,255,255,0.02)"
                                : "rgba(255,255,255,0.06)",
                            border: `1px solid ${t.cardBorder || "rgba(255,255,255,0.1)"}`,
                            borderRadius: "8px",
                            color: currentPage === totalPages ? t.textMuted : t.textPrimary,
                            fontSize: "12px",
                            fontWeight: 600,
                            cursor: currentPage === totalPages ? "not-allowed" : "pointer",
                            transition: "all 0.2s",
                          }}
                        >
                          Next
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })()}
        </div>
      )}
    </>
  );
}
