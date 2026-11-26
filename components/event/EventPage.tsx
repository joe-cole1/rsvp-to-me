"use client";

import { useTranslations } from "next-intl";

import { useState, useRef, useEffect, useTransition } from "react";
import NextImage from "@/components/ui/UploadedImage";
import type { ResolvedTheme } from "@/lib/theme";
import {
  saveEventField,
  saveCoverImage,
  removeCoverImage,
  addComment,
  deleteComment,
  addInfoSection,
  updateInfoSection,
  removeInfoSection,
  reorderInfoSections,
  approveRsvp,
  declineRsvp,
  addEventUpdate,
  deleteEventUpdate,
  claimPotluckItem,
  unclaimPotluckItem,
  deleteActivityEvent,
  castVote,
  addPollOption,
} from "@/app/actions/event";
import { HostBar } from "./HostBar";
import QRCode from "qrcode";
import type { EventData, GuestRsvp } from "./event-page/types";
import { resolveIconKey, ICON_SET } from "./event-page/helpers";
import { compressImage } from "@/lib/client-image";
import { buildStyles } from "./event-page/styles";
import { GuestInviteFriendCard } from "./event-page/GuestInviteFriendCard";
import { ActivityFeed } from "./event-page/ActivityFeed";
import { EventAtmosphere } from "./EventAtmosphere";
import type { EffectConfig } from "@/lib/effects";
import { EventHero } from "./event-page/EventHero";
import { GuestListSection } from "./event-page/GuestListSection";
import { GuestSharingCard } from "./event-page/GuestSharingCard";
import { InfoSectionsBlock } from "./event-page/InfoSectionsBlock";
import { PendingApprovalsCard, ApprovalMessageModal } from "./event-page/PendingApprovals";
import { PollsSection } from "./event-page/PollsSection";
import { PotluckSection } from "./event-page/PotluckSection";
import {
  QuestionnaireSection,
  type ViewerQuestionnaireSubmission,
} from "./event-page/QuestionnaireSection";
import { RsvpSection } from "./event-page/RsvpSection";
import { ShareQrModal } from "./event-page/ShareQrModal";
import { useCaptcha } from "@/components/ui/CaptchaProvider";
import { CAPTCHA_RESPONSE_FIELD } from "@/lib/captcha-types";
import type { NotificationFeedback } from "@/lib/notifications/types";

// ── Main Component ─────────────────────────────────────────────────────────────

export function EventPage({
  event: initial,
  isHost,
  theme,
  effect = null,
  coverUploadEnabled = false,
  guestRsvp = null,
  sessionUser = null,
  channelConfig = { email: true, sms: true },
  initialVoterName = "",
  initialQuestionnaireSubmission = null,
  hasPassword = false,
}: {
  event: EventData;
  isHost: boolean;
  theme: ResolvedTheme;
  effect?: EffectConfig | null;
  coverUploadEnabled?: boolean;
  guestRsvp?: GuestRsvp | null;
  sessionUser?: {
    email: string;
    name?: string | null;
    avatarUrl?: string | null;
    role: "GUEST" | "HOST" | "ADMIN";
  } | null;
  channelConfig?: { email: boolean; sms: boolean };
  initialVoterName?: string;
  initialQuestionnaireSubmission?: ViewerQuestionnaireSubmission | null;
  hasPassword?: boolean;
}) {
  const translate = useTranslations("Ui.Event.EventPage");

  const [event, setEvent] = useState(initial);
  const { runWithCaptcha } = useCaptcha();
  const [prevInitial, setPrevInitial] = useState(initial);
  const detailsRef = useRef<HTMLSpanElement>(null);
  const titleRef = useRef<HTMLSpanElement>(null);

  const [eventLinkCopied, setEventLinkCopied] = useState(false);

  const getAvatarUrl = (name: string, rsvpId?: string | null) => {
    // Check host
    const isHostName =
      (event.hostDisplayName && name.startsWith(event.hostDisplayName)) ||
      (event.host.name && name.startsWith(event.host.name));
    if (isHostName && event.host.avatarUrl) {
      return event.host.avatarUrl;
    }
    // Check RSVP list
    if (rsvpId) {
      const match = event.rsvps.find((r) => r.id === rsvpId);
      if (match?.user?.avatarUrl) return match.user.avatarUrl;
    }
    const matchByName = event.rsvps.find((r) => r.guestName === name);
    if (matchByName?.user?.avatarUrl) return matchByName.user.avatarUrl;
    return null;
  };

  const renderAvatar = (
    name: string,
    rsvpId?: string | null,
    customStyle: React.CSSProperties = {}
  ) => {
    const url = getAvatarUrl(name, rsvpId);
    const initial = name[0]?.toUpperCase() || "?";

    const baseAvatarStyle = {
      width: "28px",
      height: "28px",
      borderRadius: "50%",
      background: theme.avatarGradient,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: "12px",
      fontWeight: 700,
      color: theme.accentFg,
      flexShrink: 0,
      minWidth: "28px",
      ...customStyle,
    };

    if (url) {
      return (
        <div
          style={{
            ...baseAvatarStyle,
            position: "relative",
            overflow: "hidden",
          }}
        >
          <NextImage
            src={url}
            alt={name}
            fill
            sizes="48px"
            style={{
              objectFit: "cover",
            }}
          />
        </div>
      );
    }
    return <div style={baseAvatarStyle as React.CSSProperties}>{initial}</div>;
  };

  if (initial !== prevInitial) {
    setPrevInitial(initial);
    setEvent(initial);
  }

  const [guestName] = useState(guestRsvp?.guestName ?? "");
  const [guestRsvpId] = useState<string | null>(guestRsvp?.id ?? null);
  const [guestEditToken] = useState<string | null>(guestRsvp?.editToken ?? null);
  const rsvpStatus = guestRsvp?.status ?? null;
  const rsvpDone = !!guestRsvp?.id && guestRsvp.responded;
  // SEC-17 / participation gating, mirroring the server rules.
  // Polls & potluck need an APPROVED RSVP (host/co-host/admin excepted).
  // Comments are looser: a pending RSVP still can't comment, but a logged-in
  // user with NO RSVP may comment on a PUBLIC/UNLISTED event (it's publicly
  // viewable) — only PRIVATE events require a host/guest relationship.
  const isAdmin = sessionUser?.role === "ADMIN";
  const isApprovedGuest = !!guestRsvpId && (guestRsvp?.approved ?? false);
  const isPendingGuest = !!guestRsvpId && !(guestRsvp?.approved ?? false);
  // An admin browsing an event they have no relationship to may still act, but
  // is shown a notice that they are doing so without an RSVP.
  const isAdminBypass = isAdmin && !isHost && !guestRsvpId;
  const rsvpEnabled = event.rsvpEnabled !== false;
  // A logged-in viewer with no RSVP may comment on public/unlisted events
  // (admins anywhere); blocked on private events. On info-only events, any
  // viewer who cleared resolveEventAccess (including password-unlocked PRIVATE)
  // may comment.
  const isLoggedInViewer = !!sessionUser && !guestRsvpId && !isHost;
  const canViewerComment = rsvpEnabled
    ? isLoggedInViewer && (isAdmin || event.visibility !== "PRIVATE")
    : !isHost;
  // Display name the current user authors content under, matching the value the
  // server derives (RSVP name for approved guests, user record otherwise).
  const selfAuthorName =
    isApprovedGuest && !isHost && !isAdmin
      ? guestName || "Guest"
      : sessionUser?.name || sessionUser?.email || guestName || "Guest";
  const [commentError, setCommentError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{
    id: string;
    section: EventData["infoSections"][number];
    timer: ReturnType<typeof setTimeout>;
  } | null>(null);
  const [commentText, setCommentText] = useState("");
  const [replyingToId, setReplyingToId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [replyError, setReplyError] = useState<{ parentId: string; message: string } | null>(null);
  const [feedPage, setFeedPage] = useState(1);
  const [addingSection, setAddingSection] = useState(false);
  const [sectionDraft, setSectionDraft] = useState({
    iconKey: ICON_SET[0].key,
    content: "",
    url: "",
    title: "",
  });
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState({
    iconKey: ICON_SET[0].key,
    content: "",
    url: "",
    title: "",
  });
  const [isUploading, setIsUploading] = useState(false);
  const [updateDraft, setUpdateDraft] = useState("");
  const [notifyOnUpdate, setNotifyOnUpdate] = useState(true);
  const [isPostingUpdate, setIsPostingUpdate] = useState(false);
  const [notificationFeedback, setNotificationFeedback] = useState<NotificationFeedback>(null);
  const [claimingItemId, setClaimingItemId] = useState<string | null>(null);
  const [claimName, setClaimName] = useState("");
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [showShareQr, setShowShareQr] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [activeApproval, setActiveApproval] = useState<{
    rsvpId: string;
    type: "APPROVE" | "DECLINE";
    guestName: string;
  } | null>(null);
  const [approvalMessage, setApprovalMessage] = useState("");
  const [claimQty, setClaimQty] = useState(1);

  // Poll states
  const [newPollOptionTexts, setNewPollOptionTexts] = useState<Record<string, string>>({});
  const [voterNameDraft, setVoterNameDraft] = useState(initialVoterName || sessionUser?.name || "");
  const [pollError, setPollError] = useState<string | null>(null);

  useEffect(() => {
    if (showShareQr && typeof window !== "undefined") {
      QRCode.toDataURL(window.location.origin + `/e/${event.slug}`, {
        width: 200,
        margin: 1,
        color: { dark: "#000000", light: "#ffffff" },
      })
        .then((url) => setQrDataUrl(url))
        .catch((err) => console.error("Error generating QR code:", err));
    }
  }, [showShareQr, event.slug]);

  useEffect(() => {
    const handleScrollToHash = () => {
      const hash = window.location.hash;
      if (!hash) return;
      const id = hash.substring(1);
      const element = document.getElementById(id);
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    };

    const timer = setTimeout(handleScrollToHash, 250);

    window.addEventListener("hashchange", handleScrollToHash);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("hashchange", handleScrollToHash);
    };
  }, [event]);

  const t = theme;

  // Shared notice shown to pending guests on the comment, poll, and potluck
  // sections — they may view the event but cannot act until the host approves.
  const pendingNoticeStyle: React.CSSProperties = {
    marginBottom: "16px",
    padding: "10px 12px",
    borderRadius: "8px",
    background: "rgba(148,163,184,0.1)",
    border: "1px solid rgba(148,163,184,0.25)",
    fontSize: "12.5px",
    color: t.textMuted,
    lineHeight: 1.5,
  };

  // Derived
  const going = event.rsvps.filter((r) => r.status === "GOING");
  const maybe = event.rsvps.filter((r) => r.status === "MAYBE");
  const no = event.rsvps.filter((r) => r.status === "NO");
  const totalGoing = going.reduce((s, r) => s + 1 + r.plusOneCount, 0);
  const now = new Date();
  const eventStarted = new Date(event.startAt) <= now;
  const deadlinePassed = event.rsvpDeadline ? new Date(event.rsvpDeadline) < now : false;
  const rsvpOpen =
    !eventStarted && (!deadlinePassed || (Boolean(guestEditToken) && event.allowEditAfterDeadline));

  // Saves
  const save = (field: string, value: string) => {
    startTransition(async () => {
      await runWithCaptcha("event_edit", (token) => saveEventField(event.id, field, value, token));
      setEvent((e) => ({ ...e, [field]: value }));
    });
  };

  const [uploadStatus, setUploadStatus] = useState<"idle" | "compressing" | "uploading">("idle");
  const [coverUploadError, setCoverUploadError] = useState<string | null>(null);

  const handleCoverRemove = async () => {
    startTransition(async () => {
      await removeCoverImage(event.id);
      setEvent((ev) => ({
        ...ev,
        theme: ev.theme ? { ...ev.theme, coverImageUrl: null } : ev.theme,
      }));
    });
  };

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    setCoverUploadError(null);
    try {
      setUploadStatus("compressing");
      const compressed = await compressImage(file, { maxWidth: 1600, maxHeight: 900 });
      setUploadStatus("uploading");
      const form = new FormData();
      form.append("file", compressed);
      const res = await runWithCaptcha("image_upload", (token) => {
        if (token) form.set(CAPTCHA_RESPONSE_FIELD, token);
        return fetch("/api/upload", { method: "POST", body: form });
      });
      const result = (await res.json()) as { url?: string; code?: string };
      if (!res.ok) {
        setCoverUploadError(
          translate(
            result.code === "UPLOAD_QUOTA_EXCEEDED" ? "uploadQuotaExceeded" : "coverUploadFailed"
          )
        );
        return;
      }
      const url = result.url;
      if (!url) throw new Error("Missing upload URL");
      await runWithCaptcha("image_assign", (token) => saveCoverImage(event.id, url, token));
      setEvent((ev) => ({
        ...ev,
        theme: {
          ...(ev.theme ?? {
            baseTheme: "DARK" as const,
            gradientFrom: "#7c3aed",
            gradientTo: "#1e40af",
            accentColor: "#a855f7",
          }),
          coverImageUrl: url,
        },
      }));
    } catch {
      setCoverUploadError(translate("coverUploadFailed"));
    } finally {
      setIsUploading(false);
      setUploadStatus("idle");
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const submitComment = async () => {
    if (!commentText.trim()) return;
    const authorName =
      !rsvpEnabled && !isHost && !sessionUser ? voterNameDraft.trim() : selfAuthorName;
    if (!authorName) return;
    setCommentError(null);
    startTransition(async () => {
      try {
        const result = await runWithCaptcha("comment", (token) =>
          addComment(
            {
              eventId: event.id,
              guestName: authorName,
              body: commentText.trim(),
              guestEditToken: guestEditToken ?? undefined,
            },
            token
          )
        );
        if (result.success) {
          setCommentText("");
          setEvent((e) => ({
            ...e,
            comments: [
              {
                id: result.id!,
                guestName: authorName,
                body: commentText.trim(),
                createdAt: new Date(),
                replies: [],
              },
              ...e.comments,
            ],
          }));
          setFeedPage(1);
        } else {
          setCommentError(result.error || translate("failedAddComment"));
        }
      } catch (err) {
        setCommentError(err instanceof Error ? err.message : translate("failedAddComment"));
      }
    });
  };

  const submitReply = async (parentId: string) => {
    if (!replyText.trim()) return;
    const name = !rsvpEnabled && !isHost && !sessionUser ? voterNameDraft.trim() : selfAuthorName;
    if (!name) return;
    setReplyError(null);

    startTransition(async () => {
      try {
        const result = await runWithCaptcha("comment", (token) =>
          addComment(
            {
              eventId: event.id,
              guestName: name,
              body: replyText.trim(),
              guestEditToken: guestEditToken ?? undefined,
              parentId,
            },
            token
          )
        );

        if (result.success) {
          setReplyText("");
          setReplyingToId(null);
          setEvent((e) => ({
            ...e,
            comments: e.comments.map((c) => {
              if (c.id === parentId) {
                return {
                  ...c,
                  replies: [
                    ...c.replies,
                    {
                      id: result.id!,
                      guestName: name,
                      body: replyText.trim(),
                      createdAt: new Date(),
                    },
                  ],
                };
              }
              return c;
            }),
          }));
          setFeedPage(1);
        } else {
          setReplyError({ parentId, message: result.error || translate("failedAddReply") });
        }
      } catch (err) {
        setReplyError({
          parentId,
          message: err instanceof Error ? err.message : translate("failedAddReply"),
        });
      }
    });
  };

  const commitInfoSection = async () => {
    if (!sectionDraft.content.trim() && !sectionDraft.url.trim()) return;
    startTransition(async () => {
      const result = await runWithCaptcha("event_content", (token) =>
        addInfoSection(
          {
            eventId: event.id,
            type: sectionDraft.iconKey,
            title: sectionDraft.title.trim() || null,
            content: sectionDraft.content,
            url: sectionDraft.url || null,
            order: event.infoSections.length,
          },
          token
        )
      );
      if (result.success) {
        setEvent((e) => ({
          ...e,
          infoSections: [
            ...e.infoSections,
            {
              id: result.id!,
              type: sectionDraft.iconKey,
              title: sectionDraft.title.trim() || null,
              content: sectionDraft.content,
              url: sectionDraft.url || null,
              order: e.infoSections.length,
            },
          ],
          activityEvents: result.activityEvent
            ? [result.activityEvent, ...e.activityEvents]
            : e.activityEvents,
        }));
        setAddingSection(false);
        setSectionDraft({ iconKey: ICON_SET[0].key, content: "", url: "", title: "" });
      }
    });
  };

  const deleteSection = (id: string) => {
    const section = event.infoSections.find((s) => s.id === id);
    if (!section) return;
    // Optimistically hide; commit to DB after 5s unless undone
    setEvent((e) => ({ ...e, infoSections: e.infoSections.filter((s) => s.id !== id) }));
    if (pendingDelete) {
      clearTimeout(pendingDelete.timer);
      startTransition(() => removeInfoSection(pendingDelete.id).then(() => {}));
    }
    const timer = setTimeout(() => {
      startTransition(async () => {
        const result = await removeInfoSection(id);
        if (result?.activityEvent) {
          setEvent((e) => ({ ...e, activityEvents: [result.activityEvent!, ...e.activityEvents] }));
        }
      });
      setPendingDelete(null);
    }, 5000);
    setPendingDelete({ id, section, timer });
  };

  const undoDeleteSection = () => {
    if (!pendingDelete) return;
    clearTimeout(pendingDelete.timer);
    setEvent((e) => ({
      ...e,
      infoSections: [...e.infoSections, pendingDelete.section].sort((a, b) => a.order - b.order),
    }));
    setPendingDelete(null);
  };

  const startEditSection = (sec: EventData["infoSections"][number]) => {
    setEditingSection(sec.id);
    setEditDraft({
      iconKey: resolveIconKey(sec.type),
      content: sec.content,
      url: sec.url ?? "",
      title: sec.title ?? "",
    });
  };

  const commitEditSection = async (id: string) => {
    if (!editDraft.content.trim() && !editDraft.url.trim()) return;
    startTransition(async () => {
      await runWithCaptcha("event_content", (token) =>
        updateInfoSection(
          id,
          {
            type: editDraft.iconKey,
            title: editDraft.title.trim() || null,
            content: editDraft.content,
            url: editDraft.url || null,
          },
          token
        )
      );
      setEvent((e) => ({
        ...e,
        infoSections: e.infoSections.map((s) =>
          s.id === id
            ? {
                ...s,
                type: editDraft.iconKey,
                title: editDraft.title.trim() || null,
                content: editDraft.content,
                url: editDraft.url || null,
              }
            : s
        ),
      }));
      setEditingSection(null);
    });
  };

  const moveSection = (index: number, direction: -1 | 1) => {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= event.infoSections.length) return;

    startTransition(async () => {
      const newSections = [...event.infoSections];
      // Swap
      const temp = newSections[index];
      newSections[index] = newSections[newIndex];
      newSections[newIndex] = temp;

      // Reassign order properties optimistically
      const orderedSections = newSections.map((sec, idx) => ({ ...sec, order: idx }));

      setEvent((e) => ({
        ...e,
        infoSections: orderedSections,
      }));

      const result = await reorderInfoSections(
        event.id,
        orderedSections.map((s) => s.id)
      );
      if (!result.success) {
        // Revert to original on failure
        setEvent((e) => ({ ...e, infoSections: event.infoSections }));
      }
    });
  };

  const postUpdate = async () => {
    if (!updateDraft.trim() || isPostingUpdate) return;
    setIsPostingUpdate(true);
    setNotificationFeedback(null);
    try {
      const result = await runWithCaptcha("event_update", (token) =>
        addEventUpdate(event.id, updateDraft.trim(), notifyOnUpdate, token)
      );
      if (result.success) {
        setNotificationFeedback(result.notifications);
        setEvent((e) => ({
          ...e,
          updates: [
            {
              id: result.id!,
              body: updateDraft.trim(),
              notifyGuests: notifyOnUpdate,
              createdAt: result.createdAt!,
            },
            ...e.updates,
          ],
        }));
        setUpdateDraft("");
        setFeedPage(1);
      }
    } finally {
      setIsPostingUpdate(false);
    }
  };

  const removeComment = async (id: string) => {
    const result = await deleteComment(event.id, id);
    const removed = new Set(result.removedIds);
    setEvent((e) => ({
      ...e,
      comments: e.comments
        .filter((c) => !removed.has(c.id))
        .map((c) => ({
          ...c,
          replies: c.replies.filter((r) => !removed.has(r.id)),
        })),
    }));
    if (replyingToId && removed.has(replyingToId)) {
      setReplyingToId(null);
      setReplyText("");
    }
  };

  const removeUpdate = (id: string) => {
    startTransition(async () => {
      await deleteEventUpdate(id);
      setEvent((e) => ({ ...e, updates: e.updates.filter((u) => u.id !== id) }));
    });
  };

  const claimItem = async (itemId: string, name: string) => {
    const result = await claimPotluckItem(itemId, name, claimQty, guestEditToken ?? undefined);
    if (result.success && result.claim) {
      // Cast the claim to match the type expected in claims array (Date for createdAt)
      const newClaim = {
        ...result.claim,
        isMine: true,
        createdAt: new Date(result.claim.createdAt),
      };
      setEvent((e) => ({
        ...e,
        potluckItems: e.potluckItems.map((i) =>
          i.id === itemId ? { ...i, claims: [...i.claims, newClaim] } : i
        ),
        activityEvents: result.activityEvent
          ? [result.activityEvent, ...e.activityEvents]
          : e.activityEvents,
      }));
      setClaimingItemId(null);
      setClaimName("");
      setClaimQty(1);
    }
  };

  const unclaimItem = async (itemId: string, claimId: string) => {
    const result = await unclaimPotluckItem(itemId, claimId, guestEditToken ?? undefined);
    if (result.success) {
      setEvent((e) => ({
        ...e,
        potluckItems: e.potluckItems.map((i) =>
          i.id === itemId ? { ...i, claims: i.claims.filter((c) => c.id !== claimId) } : i
        ),
        activityEvents: result.activityEvent
          ? [result.activityEvent, ...e.activityEvents]
          : e.activityEvents,
      }));
    }
  };

  const handleVote = async (pollId: string, pollOptionId: string, isVoted: boolean) => {
    const targetPoll = event.polls.find((p) => p.id === pollId);
    const voter = isHost
      ? sessionUser?.name || "Host"
      : rsvpDone
        ? guestName
        : sessionUser?.name?.trim() || voterNameDraft.trim();
    if (isVoted && !voter) {
      setPollError(translate("failedCastVote"));
      return;
    }
    if (!isVoted && !voter && targetPoll?.requireRsvp !== false) return;

    setPollError(null);
    const previousPolls = event.polls;
    const optimisticVoterName = voter || "Guest";

    // Optimistic Update
    setEvent((e) => {
      const updatedPolls = e.polls.map((p) => {
        if (p.id !== pollId) return p;

        const updatedOptions = p.options.map((opt) => {
          if (isVoted) {
            if (!p.multiChoice && opt.id !== pollOptionId) {
              return {
                ...opt,
                votes: opt.votes.filter((v) => !v.isMine),
              };
            }
            if (opt.id === pollOptionId) {
              const alreadyVoted = opt.votes.some((v) => v.isMine);
              return {
                ...opt,
                votes: alreadyVoted
                  ? opt.votes
                  : [
                      ...opt.votes,
                      {
                        id: `temp-vote-${Date.now()}`,
                        voterName: optimisticVoterName,
                        isMine: true,
                        createdAt: new Date(),
                      },
                    ],
              };
            }
          } else {
            if (opt.id === pollOptionId) {
              return {
                ...opt,
                votes: opt.votes.filter((v) => !v.isMine),
              };
            }
          }
          return opt;
        });

        return { ...p, options: updatedOptions };
      });

      return { ...e, polls: updatedPolls };
    });

    try {
      const isOpenPoll = !rsvpEnabled || targetPoll?.requireRsvp === false;
      if (isOpenPoll && !isHost && !rsvpDone) {
        await runWithCaptcha("poll_vote", (captchaToken) =>
          castVote(
            pollId,
            pollOptionId,
            optimisticVoterName,
            isVoted,
            guestEditToken ?? undefined,
            captchaToken
          )
        );
      } else {
        await castVote(pollId, pollOptionId, voter, isVoted, guestEditToken ?? undefined);
      }
    } catch (err) {
      console.error(translate("failedCastVote"), err);
      setEvent((e) => ({ ...e, polls: previousPolls }));
      setPollError(err instanceof Error ? err.message : translate("failedCastVote"));
    }
  };

  const handleAddPollOption = async (pollId: string) => {
    const optionText = newPollOptionTexts[pollId]?.trim();
    if (!optionText) return;

    const voter = isHost
      ? "Host"
      : rsvpDone
        ? guestName
        : sessionUser?.name?.trim() || voterNameDraft.trim();
    if (!voter) return;

    setPollError(null);

    startTransition(async () => {
      try {
        const result = await runWithCaptcha("poll_option", (token) =>
          addPollOption(pollId, optionText, voter, guestEditToken ?? undefined, token)
        );
        if (result.success) {
          setEvent((e) => {
            const updatedPolls = e.polls.map((p) => {
              if (p.id !== pollId) return p;
              return {
                ...p,
                options: [
                  ...p.options,
                  {
                    id: result.id!,
                    text: optionText,
                    creatorName: isHost ? null : voter,
                    createdAt: new Date(),
                    votes: [],
                  },
                ],
              };
            });
            return { ...e, polls: updatedPolls };
          });

          setNewPollOptionTexts((prev) => ({ ...prev, [pollId]: "" }));
        }
      } catch (err) {
        console.error(translate("failedAddOption"), err);
        setPollError(err instanceof Error ? err.message : translate("failedAddOption"));
      }
    });
  };

  const removeActivityEvent = (id: string) => {
    setEvent((e) => ({ ...e, activityEvents: e.activityEvents.filter((a) => a.id !== id) }));
    deleteActivityEvent(id).catch((err) =>
      console.error(translate("failedDeleteActivityEvent"), err)
    );
  };

  const handleApprove = (rsvpId: string, message?: string) => {
    startTransition(async () => {
      const result = await runWithCaptcha("rsvp_moderation", (token) =>
        approveRsvp(rsvpId, message, token)
      );
      if (result.success) {
        const pending = event.pendingRsvps.find((r) => r.id === rsvpId);
        setEvent((e) => ({
          ...e,
          pendingRsvps: e.pendingRsvps.filter((r) => r.id !== rsvpId),
          rsvps: pending
            ? [
                ...e.rsvps,
                {
                  id: pending.id,
                  guestName: pending.guestName,
                  status: pending.status,
                  plusOneCount: pending.plusOneCount,
                  note: null,
                  createdAt: pending.createdAt,
                },
              ]
            : e.rsvps,
        }));
      }
    });
  };

  const handleDecline = (rsvpId: string, message?: string) => {
    startTransition(async () => {
      const result = await runWithCaptcha("rsvp_moderation", (token) =>
        declineRsvp(rsvpId, message, token)
      );
      if (result.success) {
        setEvent((e) => ({ ...e, pendingRsvps: e.pendingRsvps.filter((r) => r.id !== rsvpId) }));
      }
    });
  };

  // ── Styles ──────────────────────────────────────────────────────────────────

  const S = buildStyles(t);

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div style={S.page}>
      {/* ── Top nav ── */}

      <EventAtmosphere theme={t} effect={effect} />

      <div style={S.container}>
        <EventHero
          event={event}
          setEvent={setEvent}
          detailsRef={detailsRef}
          titleRef={titleRef}
          fileInputRef={fileInputRef}
          renderAvatar={renderAvatar}
          isUploading={isUploading}
          isPending={isPending}
          t={t}
          save={save}
          uploadStatus={uploadStatus}
          uploadError={coverUploadError}
          handleCoverRemove={handleCoverRemove}
          handleCoverUpload={handleCoverUpload}
          isHost={isHost}
          coverUploadEnabled={coverUploadEnabled}
        />

        <InfoSectionsBlock
          event={event}
          t={t}
          isHost={isHost}
          pendingDelete={pendingDelete}
          addingSection={addingSection}
          setAddingSection={setAddingSection}
          sectionDraft={sectionDraft}
          setSectionDraft={setSectionDraft}
          editingSection={editingSection}
          setEditingSection={setEditingSection}
          editDraft={editDraft}
          setEditDraft={setEditDraft}
          commitInfoSection={commitInfoSection}
          deleteSection={deleteSection}
          undoDeleteSection={undoDeleteSection}
          startEditSection={startEditSection}
          commitEditSection={commitEditSection}
          moveSection={moveSection}
        />

        {rsvpEnabled && (
          <>
            <RsvpSection
              event={event}
              t={t}
              isHost={isHost}
              guestEditToken={guestEditToken}
              rsvpStatus={rsvpStatus}
              rsvpDone={rsvpDone}
              rsvpApproved={guestRsvp?.approved ?? true}
            />

            <PendingApprovalsCard
              event={event}
              renderAvatar={renderAvatar}
              isPending={isPending}
              t={t}
              isHost={isHost}
              setActiveApproval={setActiveApproval}
            />
          </>
        )}

        <GuestSharingCard
          event={event}
          t={t}
          isHost={isHost}
          eventLinkCopied={eventLinkCopied}
          setEventLinkCopied={setEventLinkCopied}
          setShowShareQr={setShowShareQr}
        />

        {/* ── Guest Invite Friend Block (for private events when guestsCanInvite is enabled) ── */}
        {rsvpEnabled &&
          !isHost &&
          event.visibility === "PRIVATE" &&
          event.guestsCanInvite &&
          rsvpDone &&
          (rsvpStatus === "GOING" || rsvpStatus === "MAYBE") && (
            <GuestInviteFriendCard eventId={event.id} guestToken={guestEditToken ?? ""} theme={t} />
          )}

        {!rsvpEnabled && (
          <QuestionnaireSection
            event={event}
            t={t}
            isHost={isHost}
            initialSubmission={initialQuestionnaireSubmission}
            hasSessionName={Boolean(sessionUser?.name?.trim())}
            voterNameDraft={voterNameDraft}
            setVoterNameDraft={setVoterNameDraft}
          />
        )}

        <PollsSection
          event={event}
          isPending={isPending}
          t={t}
          isHost={isHost}
          rsvpStatus={rsvpStatus}
          rsvpDone={rsvpDone}
          isPendingGuest={isPendingGuest}
          guestEditToken={guestEditToken}
          voterNameDraft={voterNameDraft}
          setVoterNameDraft={setVoterNameDraft}
          hasSessionOrRsvp={isHost || rsvpDone || Boolean(sessionUser?.name?.trim())}
          rsvpOpen={rsvpOpen}
          pollError={pollError}
          newPollOptionTexts={newPollOptionTexts}
          setNewPollOptionTexts={setNewPollOptionTexts}
          pendingNoticeStyle={pendingNoticeStyle}
          handleVote={handleVote}
          handleAddPollOption={handleAddPollOption}
        />

        {rsvpEnabled && (
          <>
            <PotluckSection
              event={event}
              t={t}
              isHost={isHost}
              rsvpStatus={rsvpStatus}
              rsvpDone={rsvpDone}
              guestEditToken={guestEditToken}
              rsvpOpen={rsvpOpen}
              guestName={guestName}
              isPendingGuest={isPendingGuest}
              pendingNoticeStyle={pendingNoticeStyle}
              claimingItemId={claimingItemId}
              setClaimingItemId={setClaimingItemId}
              claimName={claimName}
              setClaimName={setClaimName}
              claimQty={claimQty}
              setClaimQty={setClaimQty}
              claimItem={claimItem}
              unclaimItem={unclaimItem}
            />

            <GuestListSection
              event={event}
              renderAvatar={renderAvatar}
              t={t}
              isHost={isHost}
              going={going}
              maybe={maybe}
              no={no}
              totalGoing={totalGoing}
            />
          </>
        )}

        <ActivityFeed
          event={event}
          renderAvatar={renderAvatar}
          isPending={isPending}
          t={t}
          isHost={isHost}
          isPendingGuest={isPendingGuest}
          isApprovedGuest={isApprovedGuest}
          isAdminBypass={isAdminBypass}
          canViewerComment={canViewerComment}
          selfAuthorName={selfAuthorName}
          hasSessionUser={Boolean(sessionUser)}
          voterNameDraft={voterNameDraft}
          setVoterNameDraft={setVoterNameDraft}
          commentError={commentError}
          pendingNoticeStyle={pendingNoticeStyle}
          guestRsvpId={guestRsvpId}
          commentText={commentText}
          setCommentText={setCommentText}
          replyingToId={replyingToId}
          setReplyingToId={setReplyingToId}
          replyText={replyText}
          replyError={replyError}
          setReplyText={setReplyText}
          feedPage={feedPage}
          setFeedPage={setFeedPage}
          updateDraft={updateDraft}
          setUpdateDraft={setUpdateDraft}
          notifyOnUpdate={notifyOnUpdate}
          setNotifyOnUpdate={setNotifyOnUpdate}
          isPostingUpdate={isPostingUpdate}
          notificationFeedback={notificationFeedback}
          submitComment={submitComment}
          submitReply={submitReply}
          postUpdate={postUpdate}
          removeComment={removeComment}
          removeUpdate={removeUpdate}
          removeActivityEvent={removeActivityEvent}
        />

        <p
          style={{
            textAlign: "center",
            marginTop: "32px",
            fontSize: "12px",
            color: t.textMuted,
            opacity: 0.5,
          }}
        >
          rsvp to me
        </p>
      </div>

      {/* ── Host Bar ── */}
      {isHost && (
        <HostBar
          eventId={event.id}
          eventSlug={event.slug}
          theme={t}
          visibility={event.visibility}
          channelConfig={channelConfig}
          rsvpEnabled={rsvpEnabled}
          hasPassword={hasPassword}
        />
      )}

      <ShareQrModal
        t={t}
        showShareQr={showShareQr}
        setShowShareQr={setShowShareQr}
        qrDataUrl={qrDataUrl}
        setQrDataUrl={setQrDataUrl}
      />

      <ApprovalMessageModal
        t={t}
        activeApproval={activeApproval}
        setActiveApproval={setActiveApproval}
        approvalMessage={approvalMessage}
        setApprovalMessage={setApprovalMessage}
        handleApprove={handleApprove}
        handleDecline={handleDecline}
      />
    </div>
  );
}
