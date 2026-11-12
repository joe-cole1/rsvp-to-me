"use client";
import { useLocale, useTranslations } from "next-intl";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Search,
  Plus,
  UserCheck,
  Edit3,
  Trash2,
  Utensils,
  Calendar,
  MapPin,
  Activity,
  Clock,
  Sparkles,
  MessageSquare,
  MoreHorizontal,
} from "lucide-react";
import { APP_SHELL, APP_SHELL_THEME as T, PHOTO_OVERLAY } from "@/lib/theme";
import { appCardStyle } from "@/components/ui/AppPrimitives";
import { Button, buttonStyle, hoverWash } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Choice";
import { Field, Input, Select } from "@/components/ui/Field";
import type { DashboardEvent, DashboardInvite, DashboardActivity } from "@/app/actions/event";

export interface DashboardGridItem {
  id: string;
  slug: string;
  title: string;
  startAt: Date | string;
  status: string;
  theme: {
    gradientFrom: string;
    gradientTo: string;
    accentColor: string;
    coverImageUrl: string | null;
  } | null;
  going: number;
  maybe: number;
  pending: number;
  isCohost: boolean;
  host?: { name: string | null; email: string | null; avatarUrl: string | null } | null;
  coHosts?: { id: string; name: string | null; email: string | null; avatarUrl: string | null }[];
  commentCount: number;
  isInvite: boolean;
  userRsvpStatus?: string;
  userRsvpEditToken?: string;
  rsvpDeadline?: Date | string | null;
  hostDisplayName?: string | null;
}

export interface CoHostProfile {
  id: string;
  name: string | null;
  email: string | null;
  avatarUrl: string | null;
}

interface DashboardClientProps {
  initialEvents: DashboardEvent[];
  initialInvites: DashboardInvite[];
  recentActivities: DashboardActivity[];
  userName: string;
  userRole: "GUEST" | "HOST" | "ADMIN";
  openRegistration: boolean;
}

export function DashboardClient({
  initialEvents,
  initialInvites,
  recentActivities,
  userName,
  userRole,
  openRegistration,
}: DashboardClientProps) {
  const tr = useTranslations("Ui.Dashboard");
  const locale = useLocale();

  // Filter state: "upcoming" | "hosting" | "invites" | "attended" | "past"
  const [activeFilter, setActiveFilter] = useState<
    "upcoming" | "hosting" | "invites" | "attended" | "past"
  >("upcoming");
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearchInput, setShowSearchInput] = useState(false);
  const [activityPage, setActivityPage] = useState(1);
  const [activeDropdownCardId, setActiveDropdownCardId] = useState<string | null>(null);

  const [activityTypeFilter, setActivityTypeFilter] = useState<
    "all" | "rsvp" | "potluck" | "comment" | "event"
  >("all");
  const [activityEventFilter, setActivityEventFilter] = useState<"all" | string>("all");

  const groupActivitiesByDate = (activities: DashboardActivity[]) => {
    const groups: Record<string, DashboardActivity[]> = {};
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    activities.forEach((act) => {
      const actDate = new Date(act.createdAt);
      actDate.setHours(0, 0, 0, 0);

      let key = tr("older");
      if (actDate.getTime() === today.getTime()) {
        key = tr("today");
      } else if (actDate.getTime() === yesterday.getTime()) {
        key = tr("yesterday");
      } else {
        key = actDate.toLocaleDateString(locale, {
          month: "short",
          day: "numeric",
          year: "numeric",
        });
      }

      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(act);
    });

    return groups;
  };

  const now = new Date();

  // Unified items structure
  const hostedOrCohosted = initialEvents.map((e) => ({
    ...e,
    isInvite: false,
    userRsvpStatus: undefined,
    userRsvpEditToken: undefined,
  }));

  const guestInvites = initialInvites.map((i) => ({
    ...i,
    isInvite: true,
  }));

  // Helper to close dropdown when clicking outside
  const dropdownRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setActiveDropdownCardId(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Filter computations
  const upcomingItems = [
    ...hostedOrCohosted.filter((e) => new Date(e.startAt) >= now),
    ...guestInvites.filter((i) => new Date(i.startAt) >= now),
  ].sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());

  const hostingItems = hostedOrCohosted.sort(
    (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime()
  );

  const openInviteItems = guestInvites
    .filter((i) => new Date(i.startAt) >= now)
    .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());

  const attendedItems = guestInvites
    .filter(
      (i) =>
        new Date(i.startAt) < now && (i.userRsvpStatus === "GOING" || i.userRsvpStatus === "MAYBE")
    )
    .sort((a, b) => new Date(b.startAt).getTime() - new Date(a.startAt).getTime()); // newest past first

  const pastItems = [
    ...hostedOrCohosted.filter((e) => new Date(e.startAt) < now),
    ...guestInvites.filter((i) => new Date(i.startAt) < now),
  ].sort((a, b) => new Date(b.startAt).getTime() - new Date(a.startAt).getTime()); // newest past first

  // Select items based on active pill
  let displayedItems =
    activeFilter === "upcoming"
      ? upcomingItems
      : activeFilter === "hosting"
        ? hostingItems
        : activeFilter === "invites"
          ? openInviteItems
          : activeFilter === "attended"
            ? attendedItems
            : pastItems;

  // Apply search query
  if (searchQuery.trim() !== "") {
    displayedItems = displayedItems.filter((item) =>
      item.title.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }

  // Counts for pills
  const counts = {
    upcoming: upcomingItems.length,
    hosting: hostingItems.length,
    invites: openInviteItems.length,
    attended: attendedItems.length,
    past: pastItems.length,
  };

  // Helper to format date Partiful-style: "Sat 11/15 at 4pm"
  const formatPartifulDate = (dateVal: Date | string) => {
    const d = new Date(dateVal);
    return new Intl.DateTimeFormat(locale, {
      weekday: "short",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(d);
  };

  // Relative time helper for activity log
  const formatRelativeTime = (dateInput: Date | string) => {
    const date = new Date(dateInput);
    const currTime = new Date();
    const diffMs = currTime.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHr = Math.floor(diffMin / 60);
    const diffDays = Math.floor(diffHr / 24);

    if (diffSec < 60) return tr("justNow");
    if (diffMin < 60) return tr("minutesAgo", { count: diffMin });
    if (diffHr < 24) return tr("hoursAgo", { count: diffHr });
    if (diffDays === 1) return tr("yesterday");
    return date.toLocaleDateString(locale, { month: "short", day: "numeric" });
  };

  // Activity type icon lookup: colors come from the shell theme's accent and status set.
  const getActivityMeta = (type: string) => {
    switch (type) {
      case "rsvp_new":
        return { Icon: UserCheck, color: T.accentText };
      case "rsvp_update":
        return { Icon: Edit3, color: T.status.info.text };
      case "rsvp_delete":
        return { Icon: Trash2, color: T.status.error.text };
      case "comment_new":
        return { Icon: MessageSquare, color: T.status.success.text };
      case "potluck_claim":
        return { Icon: Utensils, color: T.status.success.text };
      case "potluck_unclaim":
        return { Icon: Trash2, color: T.status.warning.text };
      case "event_title":
      case "event_description":
        return { Icon: Edit3, color: T.status.info.text };
      case "event_date":
        return { Icon: Calendar, color: T.status.info.text };
      case "event_location":
        return { Icon: MapPin, color: T.status.info.text };
      default:
        return { Icon: Activity, color: T.accentText };
    }
  };

  // Determine if Guest sees the + New Event card
  const showNewEventCardForGuest = userRole === "GUEST" && openRegistration;
  const showNewEventCard = userRole !== "GUEST" || showNewEventCardForGuest;

  // We only show + New Event card on active filters where new events belong
  const displayNewEventPlaceholder =
    showNewEventCard && (activeFilter === "upcoming" || activeFilter === "hosting");

  return (
    <div style={{ maxWidth: "1150px", margin: "0 auto", padding: "40px 24px 100px" }}>
      <style>{`
        @media (max-width: 640px) {
          .new-event-card { aspect-ratio: auto !important; padding: 20px 16px !important; }
        }
      `}</style>

      {/* 1. Header greeting */}
      <div style={{ marginBottom: "32px" }}>
        <h1
          style={{
            fontSize: "36px",
            fontWeight: 900,
            color: T.textPrimary,
            marginBottom: "8px",
            letterSpacing: "-0.03em",
          }}
        >
          {tr("welcome", { name: userName })}
        </h1>
        <p style={{ color: T.textSecondary, fontSize: "15px", margin: 0 }}>
          {counts.upcoming === 0 ? (
            <>
              {tr("noUpcomingEvents")}{" "}
              {showNewEventCard && (
                <Link
                  href={userRole === "GUEST" ? "/auth/register" : "/dashboard/events/new"}
                  style={{ color: T.accentText, fontWeight: 800, textDecoration: "none" }}
                >
                  {tr("hostOne")}
                </Link>
              )}
            </>
          ) : (
            tr("upcomingEventCount", { count: counts.upcoming })
          )}
        </p>
      </div>

      {/* 2. Filter chips: one row that scrolls sideways inside itself (design language,
          Filter chips). The 3px padding and matching negative margin keep focus rings
          unclipped. Chips with no results are hidden; Upcoming and the selected chip stay. */}
      <div
        style={{
          display: "flex",
          gap: "8px",
          alignItems: "center",
          overflowX: "auto",
          padding: "3px",
          margin: "-3px -3px 29px",
        }}
      >
        {/* Search Toggle Pill */}
        <Chip
          theme={T}
          selected={showSearchInput}
          aria-expanded={showSearchInput}
          onClick={() => {
            setShowSearchInput(!showSearchInput);
            if (showSearchInput) setSearchQuery("");
          }}
          style={{ flexShrink: 0 }}
        >
          <Search size={14} strokeWidth={2.5} aria-hidden="true" />
          {tr("search")}
        </Chip>

        {(
          [
            ["upcoming", tr("upcoming")],
            ...(userRole !== "GUEST" ? ([["hosting", tr("hosting")]] as const) : []),
            ["invites", tr("openInvite")],
            ["attended", tr("attended")],
            ["past", tr("allPastEvents")],
          ] as const
        )
          .filter(
            ([filter]) => filter === "upcoming" || filter === activeFilter || counts[filter] > 0
          )
          .map(([filter, label]) => (
            <PillTab
              key={filter}
              filter={filter}
              active={activeFilter}
              label={label}
              count={counts[filter]}
              onClick={setActiveFilter}
            />
          ))}
      </div>

      {/* Inline Search Input */}
      {showSearchInput && (
        <div style={{ marginBottom: "28px", animation: "slideDown 0.2s ease-out" }}>
          <Input
            theme={T}
            type="text"
            aria-label={tr("searchEventsByTitle")}
            placeholder={tr("searchEventsByTitle")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            autoFocus
            style={{ maxWidth: "400px" }}
          />
        </div>
      )}

      {/* 3. Split view: Grid of events (left) + Recent activity (right) */}
      <div className="flex flex-col lg:flex-row gap-10" style={{ alignItems: "flex-start" }}>
        {/* Left Section: Event Cards Grid */}
        <div style={{ flex: 1, minWidth: 0, width: "100%" }}>
          {displayedItems.length === 0 && !displayNewEventPlaceholder ? (
            <div
              style={{
                textAlign: "center",
                padding: "60px 20px",
                ...appCardStyle,
              }}
            >
              <div aria-hidden="true" style={{ fontSize: "36px", marginBottom: "12px" }}>
                🎉
              </div>
              <h3
                style={{
                  fontSize: "16px",
                  fontWeight: 700,
                  color: T.textPrimary,
                  marginBottom: "6px",
                }}
              >
                {tr("noEventsFound")}
              </h3>
              <p style={{ color: T.textSecondary, fontSize: "14px", margin: 0 }}>
                {searchQuery
                  ? tr("tryADifferentSearchQuery")
                  : tr("whenYouHostOrGetInvitedTheyWillShow")}
              </p>
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
                gap: "24px",
              }}
            >
              {/* + New Event Card (if active and allowed) */}
              {displayNewEventPlaceholder && (
                // The Add look (dashed accentBorder, accentText), drawn as a grid tile.
                <Link
                  href={userRole === "GUEST" ? "/auth/register" : "/dashboard/events/new"}
                  className="rsvp-control rsvp-press new-event-card"
                  style={{
                    ...buttonStyle(T, { variant: "add" }),
                    aspectRatio: "4/3",
                    width: "100%",
                    borderRadius: "16px",
                    flexDirection: "column",
                    fontSize: "14px",
                    fontWeight: 800,
                  }}
                >
                  <Plus size={24} strokeWidth={2.5} aria-hidden="true" />
                  {tr("newEvent")}
                </Link>
              )}

              {/* Event Cards */}
              {displayedItems.map((item) => (
                <EventCard
                  key={item.id}
                  item={item}
                  formatPartifulDate={formatPartifulDate}
                  isDropdownOpen={activeDropdownCardId === item.id}
                  onToggleDropdown={(open) => {
                    setActiveDropdownCardId(open ? item.id : null);
                  }}
                  dropdownRef={activeDropdownCardId === item.id ? dropdownRef : undefined}
                />
              ))}
            </div>
          )}
        </div>

        {/* Right Section: Recent Activity (Sidebar) */}
        <div
          style={{ width: "100%", maxWidth: "340px", flexShrink: 0 }}
          className="dashboard-sidebar"
        >
          <div
            style={{
              ...appCardStyle,
              padding: "24px",
              position: "sticky",
              top: "24px",
            }}
          >
            <div
              style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "18px" }}
            >
              <Clock size={16} color={T.accent} aria-hidden="true" />
              <h3 style={{ fontSize: "15px", fontWeight: 800, color: T.textPrimary }}>
                {tr("recentActivity")}
              </h3>
            </div>
            {recentActivities.length === 0 ? (
              <div
                style={{
                  padding: "30px 10px",
                  textAlign: "center",
                  color: T.textSecondary,
                  fontSize: "13px",
                }}
              >
                <Sparkles
                  size={24}
                  aria-hidden="true"
                  style={{ display: "block", margin: "0 auto 8px", opacity: 0.5 }}
                />
                {tr("noActivityLoggedYetWhenGuestsRsvpOrComments")}
              </div>
            ) : (
              (() => {
                const activityEventsList = Array.from(
                  new Map(
                    recentActivities.map((act) => [
                      act.eventId,
                      { id: act.eventId, title: act.event.title, slug: act.event.slug },
                    ])
                  ).values()
                );

                const filteredActivities = recentActivities.filter((act) => {
                  if (activityEventFilter !== "all" && act.eventId !== activityEventFilter) {
                    return false;
                  }
                  if (activityTypeFilter !== "all") {
                    if (activityTypeFilter === "rsvp") {
                      return ["rsvp_new", "rsvp_update", "rsvp_delete"].includes(act.type);
                    }
                    if (activityTypeFilter === "potluck") {
                      return ["potluck_claim", "potluck_unclaim"].includes(act.type);
                    }
                    if (activityTypeFilter === "comment") {
                      return act.type === "comment_new";
                    }
                    if (activityTypeFilter === "event") {
                      return [
                        "event_title",
                        "event_description",
                        "event_date",
                        "event_location",
                      ].includes(act.type);
                    }
                  }
                  return true;
                });

                const PAGE_SIZE = 10;
                const totalPages = Math.ceil(filteredActivities.length / PAGE_SIZE);
                const currentPage = Math.min(activityPage, Math.max(totalPages, 1));
                const displayedActivities = filteredActivities.slice(
                  (currentPage - 1) * PAGE_SIZE,
                  currentPage * PAGE_SIZE
                );
                const grouped = groupActivitiesByDate(displayedActivities);

                return (
                  <>
                    {/* Filters */}
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "8px",
                        marginBottom: "20px",
                      }}
                    >
                      <Field theme={T} label={tr("activityTypeLabel")} style={{ marginBottom: 0 }}>
                        <Select
                          theme={T}
                          value={activityTypeFilter}
                          onChange={(e) => {
                            setActivityTypeFilter(
                              e.target.value as "all" | "rsvp" | "potluck" | "comment" | "event"
                            );
                            setActivityPage(1);
                          }}
                        >
                          <option value="all">{tr("allActivityTypes")}</option>
                          <option value="rsvp">{tr("rsvpsOnly")}</option>
                          <option value="potluck">{tr("potluckSignUps")}</option>
                          <option value="comment">{tr("commentsOnly")}</option>
                          <option value="event">{tr("eventUpdates")}</option>
                        </Select>
                      </Field>

                      <Field theme={T} label={tr("activityEventLabel")} style={{ marginBottom: 0 }}>
                        <Select
                          theme={T}
                          value={activityEventFilter}
                          onChange={(e) => {
                            setActivityEventFilter(e.target.value);
                            setActivityPage(1);
                          }}
                        >
                          <option value="all">{tr("allEvents")}</option>
                          {activityEventsList.map((e) => (
                            <option key={e.id} value={e.id}>
                              {e.title}
                            </option>
                          ))}
                        </Select>
                      </Field>
                    </div>

                    {filteredActivities.length === 0 ? (
                      <div
                        style={{
                          padding: "20px 10px",
                          textAlign: "center",
                          color: T.textSecondary,
                          fontSize: "13px",
                        }}
                      >
                        {tr("noMatchingActivitiesFound")}
                      </div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                        {Object.entries(grouped).map(([dateGroup, items]) => (
                          <div
                            key={dateGroup}
                            style={{ display: "flex", flexDirection: "column", gap: "10px" }}
                          >
                            <div
                              style={{
                                fontSize: "12px",
                                fontWeight: 700,
                                color: T.textSecondary,
                                borderBottom: `1px solid ${T.cardBorder}`,
                                paddingBottom: "4px",
                                marginTop: "4px",
                              }}
                            >
                              {dateGroup}
                            </div>
                            {items.map((act) => {
                              const { Icon, color } = getActivityMeta(act.type);
                              const actorDisplayName = act.actorName || tr("someone");
                              const actorInitials = actorDisplayName.slice(0, 2).toUpperCase();
                              return (
                                <div
                                  key={act.id}
                                  style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}
                                >
                                  {/* Premium Initials Avatar with overlay badge */}
                                  <div
                                    style={{
                                      width: "32px",
                                      height: "32px",
                                      borderRadius: "50%",
                                      background: T.avatarGradient,
                                      color: T.accentFg,
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      fontWeight: 700,
                                      fontSize: "12px",
                                      flexShrink: 0,
                                      position: "relative",
                                      marginTop: "2px",
                                      border: `1.5px solid ${APP_SHELL.cardBorder}`,
                                    }}
                                  >
                                    {actorInitials}
                                    {/* Mini type badge: the type's color on the dark shell */}
                                    <div
                                      aria-hidden="true"
                                      style={{
                                        position: "absolute",
                                        bottom: "-3px",
                                        right: "-3px",
                                        width: "16px",
                                        height: "16px",
                                        borderRadius: "50%",
                                        background: APP_SHELL.chromeSurface,
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        border: `1px solid ${T.cardBorder}`,
                                      }}
                                    >
                                      <Icon size={10} color={color} />
                                    </div>
                                  </div>

                                  {/* Details */}
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <p
                                      style={{
                                        color: T.textPrimary,
                                        fontSize: "13px",
                                        lineHeight: "1.4",
                                        margin: 0,
                                        wordBreak: "break-word",
                                      }}
                                    >
                                      {act.detail}
                                    </p>

                                    {/* Link and Time */}
                                    <div
                                      style={{
                                        display: "flex",
                                        gap: "6px",
                                        alignItems: "center",
                                        marginTop: "4px",
                                      }}
                                    >
                                      <Link
                                        href={`/e/${act.event.slug}`}
                                        style={{
                                          color: T.accentText,
                                          textDecoration: "none",
                                          fontSize: "12px",
                                          fontWeight: 600,
                                          whiteSpace: "nowrap",
                                          overflow: "hidden",
                                          textOverflow: "ellipsis",
                                          maxWidth: "110px",
                                          display: "inline-block",
                                        }}
                                      >
                                        {act.event.title}
                                      </Link>
                                      <span
                                        aria-hidden="true"
                                        style={{ color: T.textMuted, fontSize: "12px" }}
                                      >
                                        ·
                                      </span>
                                      <span style={{ color: T.textMuted, fontSize: "12px" }}>
                                        {formatRelativeTime(act.createdAt)}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Pagination */}
                    {totalPages > 1 && (
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          marginTop: "20px",
                          paddingTop: "12px",
                          borderTop: `1px solid ${APP_SHELL.cardBorder}`,
                        }}
                      >
                        <Button
                          theme={T}
                          variant="secondary"
                          size="sm"
                          onClick={() => setActivityPage((prev) => Math.max(prev - 1, 1))}
                          disabled={currentPage === 1}
                        >
                          {tr("prev")}
                        </Button>
                        <span style={{ color: T.textSecondary, fontSize: "12px" }}>
                          {tr("pageOfMessage", { value0: currentPage, value1: totalPages })}
                        </span>
                        <Button
                          theme={T}
                          variant="secondary"
                          size="sm"
                          onClick={() => setActivityPage((prev) => Math.min(prev + 1, totalPages))}
                          disabled={currentPage === totalPages}
                        >
                          {tr("next")}
                        </Button>
                      </div>
                    )}
                  </>
                );
              })()
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// Helper Component: PillTab
// ──────────────────────────────────────────────
interface PillTabProps {
  filter: "upcoming" | "hosting" | "invites" | "attended" | "past";
  active: "upcoming" | "hosting" | "invites" | "attended" | "past";
  label: string;
  count: number;
  onClick: (f: "upcoming" | "hosting" | "invites" | "attended" | "past") => void;
}

function PillTab({ filter, active, label, count, onClick }: PillTabProps) {
  const isActive = active === filter;
  return (
    <Chip theme={T} selected={isActive} onClick={() => onClick(filter)} style={{ flexShrink: 0 }}>
      {/* The space keeps the accessible name "Upcoming 3", not "Upcoming3". */}
      {label} <span style={{ color: T.textSecondary }}>{count}</span>
    </Chip>
  );
}

// ──────────────────────────────────────────────
// Helper Component: Event Card
// ──────────────────────────────────────────────
interface EventCardProps {
  item: DashboardGridItem;
  formatPartifulDate: (d: Date | string) => string;
  isDropdownOpen: boolean;
  onToggleDropdown: (open: boolean) => void;
  dropdownRef?: React.RefObject<HTMLDivElement | null>;
}

function EventCard({
  item,
  formatPartifulDate,
  isDropdownOpen,
  onToggleDropdown,
  dropdownRef,
}: EventCardProps) {
  const tr = useTranslations("Ui.Dashboard");
  const locale = useLocale();

  const coverUrl = item.theme?.coverImageUrl;
  const isInvite = item.isInvite;
  // A placeholder uses the event's own gradient, like avatarGradient on event pages.
  const placeholderBg = item.theme
    ? `linear-gradient(135deg, ${item.theme.gradientFrom}, ${item.theme.gradientTo})`
    : T.avatarGradient;

  // Status badge: photo-overlay glass with white text; a dot in the status color.
  let overlayText = "";
  let overlayDot: string | null = null;

  if (!isInvite) {
    overlayText = item.isCohost ? tr("cohostBadge") : tr("hostingBadge");
  } else {
    if (item.userRsvpStatus === "GOING") {
      overlayText = tr("goingBadge");
      overlayDot = T.status.success.text;
    } else if (item.userRsvpStatus === "MAYBE") {
      overlayText = tr("maybeBadge");
      overlayDot = T.status.warning.text;
    } else if (item.userRsvpStatus === "NO") {
      overlayText = tr("declinedBadge");
      overlayDot = T.status.error.text;
    }
  }

  const photoLabel: React.CSSProperties = {
    position: "absolute",
    display: "flex",
    alignItems: "center",
    gap: "6px",
    background: PHOTO_OVERLAY.background,
    border: `1px solid ${PHOTO_OVERLAY.border}`,
    backdropFilter: "blur(8px)",
    color: PHOTO_OVERLAY.text,
    fontSize: "12px",
    fontWeight: 700,
    padding: "4px 10px",
    borderRadius: "99px",
    zIndex: 2,
    pointerEvents: "none", // click passes through to the Link
  };

  const hostName =
    item.hostDisplayName ||
    item.host?.name ||
    item.host?.email?.split("@")[0] ||
    tr("hostFallback");

  return (
    <div style={{ display: "flex", flexDirection: "column", width: "100%" }}>
      {/* 1. Cover Photo Area */}
      <div
        style={{
          position: "relative",
          width: "100%",
          paddingBottom: "75%", // 4:3 Aspect ratio
          borderRadius: "16px",
          overflow: "hidden",
          background: coverUrl ? "transparent" : placeholderBg,
        }}
      >
        {/* Clickable cover. The title link below is the named, focusable one, so this
            duplicate stays out of the tab order and the accessibility tree. */}
        <Link
          href={`/e/${item.slug}`}
          tabIndex={-1}
          aria-hidden="true"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            zIndex: 1,
            display: "block",
          }}
        >
          {/* Actual Cover image */}
          {coverUrl && (
            <Image
              src={coverUrl}
              alt={item.title}
              fill
              sizes="(max-width: 600px) calc(100vw - 32px), (max-width: 1000px) 50vw, 33vw"
              style={{
                objectFit: "cover",
              }}
            />
          )}

          {/* Fallback pattern if no cover url */}
          {!coverUrl && (
            <div
              style={{
                width: "100%",
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "48px",
                opacity: 0.85,
              }}
            >
              🎉
            </div>
          )}
        </Link>

        {/* Date Overlay (Top-Left) */}
        <div style={{ ...photoLabel, top: "12px", left: "12px" }}>
          {formatPartifulDate(item.startAt)}
        </div>

        {/* Dots Menu Button (Top-Right) */}
        <div style={{ position: "absolute", top: "12px", right: "12px", zIndex: 3 }}>
          <Button
            theme={T}
            variant="overlay"
            size="sm"
            aria-label={tr("eventMenu", { title: item.title })}
            aria-expanded={isDropdownOpen}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation(); // prevent navigating to event page
              onToggleDropdown(!isDropdownOpen);
            }}
            style={{ width: "32px", padding: 0 }}
          >
            <MoreHorizontal size={16} strokeWidth={2.5} aria-hidden="true" />
          </Button>

          {/* Dropdown Menu */}
          {isDropdownOpen && (
            <div
              ref={dropdownRef}
              style={{
                position: "absolute",
                top: "34px",
                right: 0,
                background: APP_SHELL.chromeSurface,
                border: `1px solid ${T.cardBorder}`,
                borderRadius: "10px",
                padding: "6px",
                minWidth: "140px",
                boxShadow: APP_SHELL.chromeShadow,
                zIndex: 50,
                display: "flex",
                flexDirection: "column",
                gap: "2px",
              }}
            >
              {!isInvite ? (
                <>
                  <DropdownLink href={`/e/${item.slug}`}>{tr("viewPage")}</DropdownLink>
                  <DropdownLink href={`/e/${item.slug}/guests`}>{tr("guestsList")}</DropdownLink>
                  <DropdownLink href={`/e/${item.slug}/settings`}>{tr("settings")}</DropdownLink>
                </>
              ) : (
                <>
                  <DropdownLink href={`/e/${item.slug}`}>{tr("viewInvite")}</DropdownLink>
                  {item.userRsvpEditToken && (
                    <DropdownLink href={`/e/${item.slug}/rsvp?token=${item.userRsvpEditToken}`}>
                      {tr("editRsvp")}
                    </DropdownLink>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* Status Overlay Badge (Bottom-Right) */}
        {overlayText && (
          <div style={{ ...photoLabel, bottom: "12px", right: "12px" }}>
            {overlayDot && (
              <span
                aria-hidden="true"
                style={{
                  width: "8px",
                  height: "8px",
                  borderRadius: "50%",
                  background: overlayDot,
                  flexShrink: 0,
                }}
              />
            )}
            {overlayText}
          </div>
        )}
      </div>

      {/* 2. Text Details below photo */}
      <div style={{ marginTop: "12px", padding: "0 2px" }}>
        {/* Title */}
        <Link
          href={`/e/${item.slug}`}
          className="rsvp-control rsvp-link"
          style={
            {
              "--rsvp-focus": T.accent,
              fontSize: "15px",
              fontWeight: 800,
              color: T.textPrimary,
              textDecoration: "none",
              borderRadius: "4px",
              display: "-webkit-box",
              WebkitLineClamp: 1,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            } as React.CSSProperties
          }
        >
          {item.title}
        </Link>

        {/* Hosted By & Avatars */}
        <div style={{ display: "flex", alignItems: "center", marginTop: "4px", gap: "6px" }}>
          <span style={{ color: T.textSecondary, fontSize: "12px" }}>{tr("hostedBy")}</span>
          <div style={{ display: "flex", alignItems: "center" }}>
            {/* Host avatar */}
            <AvatarBubble name={hostName} avatarUrl={item.host?.avatarUrl} />
            {/* Co-hosts avatars */}
            {item.coHosts &&
              item.coHosts.map((ch: CoHostProfile) => (
                <AvatarBubble
                  key={ch.id}
                  name={ch.name || ch.email?.split("@")[0] || tr("cohostFallback")}
                  avatarUrl={ch.avatarUrl}
                  isSibling
                />
              ))}
          </div>
        </div>

        {/* Comment count and Stats subtext */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            marginTop: "6px",
            color: T.textMuted,
            fontSize: "12px",
          }}
        >
          <span>{tr("goingMessage", { value0: item.going })}</span>
          {item.commentCount > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: "3px" }}>
              <span aria-hidden="true">·</span>
              <MessageSquare size={12} aria-hidden="true" />
              <span>{item.commentCount}</span>
            </div>
          )}
          {item.rsvpDeadline &&
            (() => {
              const deadline = new Date(item.rsvpDeadline);
              const now = new Date();
              const hasPassed = deadline < now;
              const formatted = deadline.toLocaleDateString(locale, {
                month: "short",
                day: "numeric",
              });
              return (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "3px",
                    color: hasPassed ? T.status.error.text : T.textMuted,
                    fontWeight: hasPassed ? 700 : 500,
                  }}
                >
                  <span aria-hidden="true">·</span>
                  <Clock size={12} aria-hidden="true" />
                  <span>{hasPassed ? tr("rsvpsClosed") : tr("rsvpsBy", { date: formatted })}</span>
                </div>
              );
            })()}
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// Helper Component: DropdownLink
// ──────────────────────────────────────────────
function DropdownLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="rsvp-control rsvp-press"
      style={
        {
          "--rsvp-focus": T.accent,
          "--rsvp-hover": hoverWash(true),
          display: "block",
          padding: "10px 12px",
          color: T.textPrimary,
          fontSize: "13px",
          fontWeight: 600,
          textDecoration: "none",
          borderRadius: "6px",
        } as React.CSSProperties
      }
    >
      {children}
    </Link>
  );
}

// ──────────────────────────────────────────────
// Helper Component: AvatarBubble
// ──────────────────────────────────────────────
function AvatarBubble({
  name,
  avatarUrl,
  isSibling,
}: {
  name: string;
  avatarUrl: string | null | undefined;
  isSibling?: boolean;
}) {
  const initial = name ? name.charAt(0).toUpperCase() : "?";
  return (
    <div
      title={name}
      style={{
        width: "24px",
        height: "24px",
        borderRadius: "50%",
        background: avatarUrl ? "transparent" : T.avatarGradient,
        // The ring separates overlapping avatars against the dark shell.
        border: `2px solid ${APP_SHELL.chromeSurface}`,
        boxSizing: "border-box",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: "12px",
        fontWeight: 800,
        color: T.accentFg,
        marginLeft: isSibling ? "-6px" : "0",
        overflow: "hidden",
        position: "relative",
        flexShrink: 0,
      }}
    >
      {avatarUrl ? (
        <Image src={avatarUrl} alt={name} fill sizes="24px" style={{ objectFit: "cover" }} />
      ) : (
        initial
      )}
    </div>
  );
}
