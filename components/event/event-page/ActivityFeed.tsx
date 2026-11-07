"use client";

import { useTranslations, useLocale } from "next-intl";

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
import { EventCard } from "./EventCard";
import { Button } from "@/components/ui/Button";
import { Check, Input, Textarea } from "@/components/ui/Field";
import { InlineAlert } from "@/components/ui/Feedback";
import { NotificationDeliveryFeedback } from "./NotificationDeliveryFeedback";
import type { NotificationFeedback } from "@/lib/notifications/types";

export function ActivityFeed({
  event,
  renderAvatar,
  isPending,
  t,
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
  replyError,
  feedPage,
  setFeedPage,
  updateDraft,
  setUpdateDraft,
  notifyOnUpdate,
  setNotifyOnUpdate,
  isPostingUpdate,
  notificationFeedback,
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
  /** Why the last reply failed, shown under that comment's reply box. */
  replyError?: { parentId: string; message: string } | null;
  feedPage: number;
  setFeedPage: React.Dispatch<React.SetStateAction<number>>;
  updateDraft: string;
  setUpdateDraft: React.Dispatch<React.SetStateAction<string>>;
  notifyOnUpdate: boolean;
  setNotifyOnUpdate: React.Dispatch<React.SetStateAction<boolean>>;
  isPostingUpdate: boolean;
  notificationFeedback: NotificationFeedback;
  submitComment: () => Promise<void>;
  submitReply: (parentId: string) => Promise<void>;
  postUpdate: () => Promise<void>;
  removeUpdate: (id: string) => void;
  removeActivityEvent: (id: string) => void;
}) {
  const translate = useTranslations("Ui.Event.ActivityFeed");
  const common = useTranslations("Ui.Common");
  const locale = useLocale();

  return (
    <>
      {/* ── Activity (updates + comments unified) ── */}
      {(event.commentsEnabled || event.updates.length > 0 || isHost) && (
        <EventCard theme={t}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "16px" }}>
            <MessageSquare size={16} style={{ color: t.accent }} />
            <span style={{ fontWeight: 700 }}>{translate("activity")}</span>
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
                  color: t.accentText,
                  textTransform: "none" as const,
                  letterSpacing: "0.02em",
                  marginBottom: "8px",
                }}
              >
                {translate("postUpdate")}
              </div>
              <Textarea
                theme={t}
                style={{ resize: "none", marginBottom: "8px" }}
                rows={3}
                aria-label={translate("postUpdate")}
                placeholder={translate("changedStartTimeNewLocationWhat")}
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
                  <Check
                    theme={t}
                    checked={notifyOnUpdate}
                    onChange={(e) => setNotifyOnUpdate(e.target.checked)}
                  />
                  {translate("notifyGuestsUpdate")}
                </label>
                <Button
                  theme={t}
                  variant="primary"
                  onClick={postUpdate}
                  disabled={!updateDraft.trim() || isPostingUpdate}
                >
                  {isPostingUpdate ? translate("posting") : translate("post")}
                </Button>
              </div>
              <NotificationDeliveryFeedback feedback={notificationFeedback} />
            </div>
          )}
          {event.commentsEnabled && !isHost && (isApprovedGuest || canViewerComment) && (
            <div style={{ marginBottom: "16px" }}>
              {isAdminBypass ? (
                <div
                  style={{
                    fontSize: "12px",
                    color: t.status.warning.text,
                    marginBottom: "6px",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  <ShieldAlert size={13} />
                  {translate("commentingAsAdminNotRsvpD")}
                </div>
              ) : (
                <div style={{ fontSize: "12px", color: t.textMuted, marginBottom: "6px" }}>
                  {translate("commentingAs")}{" "}
                  <strong style={{ color: t.textSecondary }}>{selfAuthorName}</strong>
                </div>
              )}
              <div style={{ display: "flex", gap: "8px" }}>
                <Input
                  theme={t}
                  style={{ flex: 1, width: "auto" }}
                  aria-label={translate("leaveComment")}
                  placeholder={translate("leaveComment")}
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      submitComment();
                    }
                  }}
                />
                <Button
                  theme={t}
                  variant="primary"
                  onClick={submitComment}
                  disabled={!commentText.trim() || isPending}
                  aria-label={translate("leaveComment")}
                >
                  <Send size={16} aria-hidden="true" />
                </Button>
              </div>
            </div>
          )}
          {event.commentsEnabled && !isHost && isPendingGuest && (
            <div style={pendingNoticeStyle}>
              {translate("mustApprovedGuestCommentRsvpAwaiting")}
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
                    {translate("noActivityYetFirst")}
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
                                  style={{ fontWeight: 700, fontSize: "13px", color: t.accentText }}
                                >
                                  {translate("update")} {event.host.name ?? event.host.email}
                                </span>
                                {isHost && (
                                  <Button
                                    theme={t}
                                    variant="icon"
                                    size="sm"
                                    onClick={() => removeUpdate(item.id)}
                                    aria-label={common("remove")}
                                    title={common("remove")}
                                  >
                                    <X size={14} aria-hidden="true" />
                                  </Button>
                                )}
                              </div>
                              {event.showTimestamps && (
                                <span style={{ color: t.textMuted, fontSize: "11px" }}>
                                  {timeAgo(item.createdAt, locale)}
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
                                    {timeAgo(item.createdAt, locale)}
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
                              <Button
                                theme={t}
                                variant="icon"
                                size="sm"
                                onClick={() => removeActivityEvent(item.id)}
                                aria-label={translate("hideActivity")}
                                title={translate("hideActivity")}
                              >
                                <X size={14} aria-hidden="true" />
                              </Button>
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
                                {timeAgo(item.createdAt, locale)}
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
                              <div style={{ marginTop: "6px", fontSize: "13px" }}>
                                <Button
                                  theme={t}
                                  variant="link"
                                  aria-expanded={replyingToId === item.id}
                                  onClick={() => {
                                    setReplyingToId(replyingToId === item.id ? null : item.id);
                                    setReplyText("");
                                  }}
                                >
                                  {translate("reply")}
                                </Button>
                              </div>
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
                                          {timeAgo(r.createdAt, locale)}
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
                                <Input
                                  theme={t}
                                  type="text"
                                  aria-label={translate("writeReply")}
                                  placeholder={translate("writeReply")}
                                  value={replyText}
                                  onChange={(e) => setReplyText(e.target.value)}
                                  style={{ flex: 1, width: "auto" }}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter" && !isPending && replyText.trim()) {
                                      submitReply(item.id);
                                    }
                                  }}
                                />
                                <Button
                                  theme={t}
                                  variant="primary"
                                  onClick={() => submitReply(item.id)}
                                  disabled={!replyText.trim() || isPending}
                                  aria-label={translate("reply")}
                                >
                                  <Send size={14} aria-hidden="true" />
                                </Button>
                              </div>
                            )}
                            {replyingToId === item.id && replyError?.parentId === item.id && (
                              <InlineAlert theme={t} style={{ margin: "8px 0 0" }}>
                                {replyError.message}
                              </InlineAlert>
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
                        <Button
                          theme={t}
                          variant="secondary"
                          size="sm"
                          onClick={() => setFeedPage((prev) => Math.max(prev - 1, 1))}
                          disabled={currentPage === 1}
                        >
                          {translate("prev")}
                        </Button>
                        <span style={{ color: t.textSecondary, fontSize: "12px" }}>
                          {translate("pagination", { page: currentPage, total: totalPages })}
                        </span>
                        <Button
                          theme={t}
                          variant="secondary"
                          size="sm"
                          onClick={() => setFeedPage((prev) => Math.min(prev + 1, totalPages))}
                          disabled={currentPage === totalPages}
                        >
                          {translate("next")}
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })()}
        </EventCard>
      )}
    </>
  );
}
