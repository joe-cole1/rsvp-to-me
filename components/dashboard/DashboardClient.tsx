"use client";

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
import { APP_SHELL } from "@/lib/theme";
import { appCardStyle } from "@/components/ui/AppPrimitives";
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

      let key = "Older";
      if (actDate.getTime() === today.getTime()) {
        key = "Today";
      } else if (actDate.getTime() === yesterday.getTime()) {
        key = "Yesterday";
      } else {
        key = actDate.toLocaleDateString(undefined, {
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
    const weekday = d.toLocaleDateString("en-US", { weekday: "short" });
    const dateStr = d.toLocaleDateString("en-US", { month: "numeric", day: "numeric" });
    const hour = d.getHours();
    const minute = d.getMinutes();
    const ampm = hour >= 12 ? "pm" : "am";
    const formattedHour = hour % 12 === 0 ? 12 : hour % 12;
    const formattedMin = minute === 0 ? "" : `:${minute.toString().padStart(2, "0")}`;
    return `${weekday} ${dateStr} at ${formattedHour}${formattedMin}${ampm}`;
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

    if (diffSec < 60) return "just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHr < 24) return `${diffHr}h ago`;
    if (diffDays === 1) return "yesterday";
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  // Activity type icon lookup
  const getActivityMeta = (type: string) => {
    switch (type) {
      case "rsvp_new":
        return { Icon: UserCheck, color: "#a855f7" }; // Purple
      case "rsvp_update":
        return { Icon: Edit3, color: "#6366f1" }; // Indigo
      case "rsvp_delete":
        return { Icon: Trash2, color: "#ef4444" }; // Red
      case "comment_new":
        return { Icon: MessageSquare, color: "#10b981" }; // Green
      case "potluck_claim":
        return { Icon: Utensils, color: "#10b981" }; // Green
      case "potluck_unclaim":
        return { Icon: Trash2, color: "#f59e0b" }; // Orange
      case "event_title":
      case "event_description":
        return { Icon: Edit3, color: "#3b82f6" }; // Blue
      case "event_date":
        return { Icon: Calendar, color: "#ec4899" }; // Pink
      case "event_location":
        return { Icon: MapPin, color: "#ef4444" }; // Red
      default:
        return { Icon: Activity, color: "#a855f7" };
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
          .new-event-card { aspect-ratio: auto !important; padding: 20px 16px; }
        }
      `}</style>

      {/* 1. Header greeting */}
      <div style={{ marginBottom: "32px" }}>
        <h1
          style={{
            fontSize: "36px",
            fontWeight: 900,
            color: "#fff",
            marginBottom: "8px",
            letterSpacing: "-0.03em",
          }}
        >
          Welcome back {userName}!
        </h1>
        <p style={{ color: APP_SHELL.textSecondary, fontSize: "15px", margin: 0 }}>
          {counts.upcoming === 0 ? (
            <>
              {"You don't have any upcoming events right now. "}
              {showNewEventCard && (
                <Link
                  href={userRole === "GUEST" ? "/auth/register" : "/dashboard/events/new"}
                  style={{ color: APP_SHELL.accent, fontWeight: 800, textDecoration: "none" }}
                >
                  Host one!
                </Link>
              )}
            </>
          ) : (
            `You have ${counts.upcoming} upcoming event${counts.upcoming > 1 ? "s" : ""} scheduled.`
          )}
        </p>
      </div>

      {/* 2. Filter Pills row */}
      <div
        style={{
          display: "flex",
          gap: "10px",
          flexWrap: "wrap",
          alignItems: "center",
          marginBottom: "32px",
        }}
      >
        {/* Search Toggle Pill */}
        <button
          onClick={() => {
            setShowSearchInput(!showSearchInput);
            if (showSearchInput) setSearchQuery("");
          }}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            padding: "8px 18px",
            background: showSearchInput ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.03)",
            border: showSearchInput ? "1px solid #fff" : "1px solid rgba(255,255,255,0.1)",
            borderRadius: "99px",
            color: "#fff",
            fontSize: "13px",
            fontWeight: 700,
            cursor: "pointer",
            transition: "all 0.15s ease-in-out",
          }}
        >
          <Search size={14} strokeWidth={2.5} />
          Search
        </button>

        {/* Filter Tab Pills */}
        <PillTab
          filter="upcoming"
          active={activeFilter}
          label="Upcoming"
          count={counts.upcoming}
          onClick={setActiveFilter}
        />
        {userRole !== "GUEST" && (
          <PillTab
            filter="hosting"
            active={activeFilter}
            label="Hosting"
            count={counts.hosting}
            onClick={setActiveFilter}
          />
        )}
        <PillTab
          filter="invites"
          active={activeFilter}
          label="Open invite"
          count={counts.invites}
          onClick={setActiveFilter}
        />
        <PillTab
          filter="attended"
          active={activeFilter}
          label="Attended"
          count={counts.attended}
          onClick={setActiveFilter}
        />
        <PillTab
          filter="past"
          active={activeFilter}
          label="All past events"
          count={counts.past}
          onClick={setActiveFilter}
        />
      </div>

      {/* Inline Search Input */}
      {showSearchInput && (
        <div style={{ marginBottom: "28px", animation: "slideDown 0.2s ease-out" }}>
          <input
            type="text"
            placeholder="Search events by title..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            autoFocus
            style={{
              width: "100%",
              maxWidth: "400px",
              padding: "10px 16px",
              background: APP_SHELL.inputBg,
              border: `1px solid ${APP_SHELL.inputBorder}`,
              borderRadius: "20px",
              color: "#fff",
              fontSize: "14px",
              outline: "none",
              borderImage: `linear-gradient(to right, ${APP_SHELL.accent}, #ec4899) 1`,
            }}
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
              <div style={{ fontSize: "36px", marginBottom: "12px" }}>🎉</div>
              <h3 style={{ fontSize: "16px", fontWeight: 700, color: "#fff", marginBottom: "6px" }}>
                No events found
              </h3>
              <p style={{ color: APP_SHELL.textSecondary, fontSize: "14px", margin: 0 }}>
                {searchQuery
                  ? "Try a different search query."
                  : "When you host or get invited, they will show up here!"}
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
                <Link
                  href={userRole === "GUEST" ? "/auth/register" : "/dashboard/events/new"}
                  style={{ textDecoration: "none" }}
                >
                  <div
                    className="new-event-card"
                    style={{
                      aspectRatio: "4/3",
                      borderRadius: "16px",
                      border: "2px dashed rgba(255,255,255,0.15)",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "8px",
                      color: APP_SHELL.textSecondary,
                      cursor: "pointer",
                      transition: "all 0.2s ease-in-out",
                      background: "rgba(255,255,255,0.01)",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = APP_SHELL.accent;
                      e.currentTarget.style.color = "#fff";
                      e.currentTarget.style.background = "rgba(255,255,255,0.03)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = "rgba(255,255,255,0.15)";
                      e.currentTarget.style.color = APP_SHELL.textSecondary;
                      e.currentTarget.style.background = "rgba(255,255,255,0.01)";
                    }}
                  >
                    <Plus size={24} strokeWidth={2.5} />
                    <span style={{ fontSize: "14px", fontWeight: 800 }}>New event</span>
                  </div>
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
              <Clock size={16} color={APP_SHELL.accent} />
              <h3 style={{ fontSize: "14px", fontWeight: 800, color: APP_SHELL.textPrimary }}>
                Recent Activity
              </h3>
            </div>
            {recentActivities.length === 0 ? (
              <div
                style={{
                  padding: "30px 10px",
                  textAlign: "center",
                  color: APP_SHELL.textMuted,
                  fontSize: "13px",
                }}
              >
                <Sparkles
                  size={24}
                  style={{ display: "block", margin: "0 auto 8px", opacity: 0.5 }}
                />
                No activity logged yet. When guests RSVP or comments are posted, they will appear
                here!
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
                      <select
                        value={activityTypeFilter}
                        onChange={(e) => {
                          setActivityTypeFilter(
                            e.target.value as "all" | "rsvp" | "potluck" | "comment" | "event"
                          );
                          setActivityPage(1);
                        }}
                        style={{
                          width: "100%",
                          padding: "8px 10px",
                          borderRadius: "8px",
                          background: "rgba(255,255,255,0.05)",
                          border: `1px solid ${APP_SHELL.cardBorder}`,
                          color: APP_SHELL.textPrimary,
                          fontSize: "12px",
                          fontWeight: 600,
                          outline: "none",
                          cursor: "pointer",
                        }}
                      >
                        <option value="all" style={{ background: "#12121c" }}>
                          All Activity Types
                        </option>
                        <option value="rsvp" style={{ background: "#12121c" }}>
                          RSVPs Only
                        </option>
                        <option value="potluck" style={{ background: "#12121c" }}>
                          Potluck Sign-ups
                        </option>
                        <option value="comment" style={{ background: "#12121c" }}>
                          Comments Only
                        </option>
                        <option value="event" style={{ background: "#12121c" }}>
                          Event Updates
                        </option>
                      </select>

                      <select
                        value={activityEventFilter}
                        onChange={(e) => {
                          setActivityEventFilter(e.target.value);
                          setActivityPage(1);
                        }}
                        style={{
                          width: "100%",
                          padding: "8px 10px",
                          borderRadius: "8px",
                          background: "rgba(255,255,255,0.05)",
                          border: `1px solid ${APP_SHELL.cardBorder}`,
                          color: APP_SHELL.textPrimary,
                          fontSize: "12px",
                          fontWeight: 600,
                          outline: "none",
                          cursor: "pointer",
                        }}
                      >
                        <option value="all" style={{ background: "#12121c" }}>
                          All Events
                        </option>
                        {activityEventsList.map((e) => (
                          <option key={e.id} value={e.id} style={{ background: "#12121c" }}>
                            {e.title}
                          </option>
                        ))}
                      </select>
                    </div>

                    {filteredActivities.length === 0 ? (
                      <div
                        style={{
                          padding: "20px 10px",
                          textAlign: "center",
                          color: APP_SHELL.textMuted,
                          fontSize: "12px",
                        }}
                      >
                        No matching activities found.
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
                                fontSize: "10px",
                                fontWeight: 800,
                                textTransform: "uppercase",
                                color: APP_SHELL.textMuted,
                                letterSpacing: "0.05em",
                                borderBottom: `1px solid rgba(255,255,255,0.05)`,
                                paddingBottom: "4px",
                                marginTop: "4px",
                              }}
                            >
                              {dateGroup}
                            </div>
                            {items.map((act) => {
                              const { Icon, color } = getActivityMeta(act.type);
                              const actorDisplayName = act.actorName || "Someone";
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
                                      background: `linear-gradient(135deg, ${APP_SHELL.accent}, ${APP_SHELL.accentSecondary})`,
                                      color: "#fff",
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      fontWeight: 700,
                                      fontSize: "11px",
                                      flexShrink: 0,
                                      position: "relative",
                                      marginTop: "2px",
                                      border: `1.5px solid ${APP_SHELL.cardBorder}`,
                                    }}
                                  >
                                    {actorInitials}
                                    {/* Mini overlay icon */}
                                    <div
                                      style={{
                                        position: "absolute",
                                        bottom: "-2px",
                                        right: "-2px",
                                        width: "14px",
                                        height: "14px",
                                        borderRadius: "50%",
                                        background: color,
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        border: `1px solid ${APP_SHELL.cardBg}`,
                                        boxShadow: "0 1px 3px rgba(0,0,0,0.5)",
                                      }}
                                    >
                                      <Icon size={8} color="#fff" />
                                    </div>
                                  </div>

                                  {/* Details */}
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <p
                                      style={{
                                        color: APP_SHELL.textPrimary,
                                        fontSize: "12px",
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
                                          color: APP_SHELL.accent,
                                          textDecoration: "none",
                                          fontSize: "11px",
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
                                        style={{ color: APP_SHELL.textTertiary, fontSize: "11px" }}
                                      >
                                        ·
                                      </span>
                                      <span
                                        style={{ color: APP_SHELL.textMuted, fontSize: "11px" }}
                                      >
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
                        <button
                          onClick={() => setActivityPage((prev) => Math.max(prev - 1, 1))}
                          disabled={currentPage === 1}
                          style={{
                            padding: "6px 12px",
                            background:
                              currentPage === 1
                                ? "rgba(255,255,255,0.02)"
                                : "rgba(255,255,255,0.06)",
                            border: `1px solid ${APP_SHELL.cardBorder}`,
                            borderRadius: "8px",
                            color: currentPage === 1 ? APP_SHELL.textMuted : APP_SHELL.textPrimary,
                            fontSize: "11px",
                            fontWeight: 600,
                            cursor: currentPage === 1 ? "not-allowed" : "pointer",
                            transition: "all 0.2s",
                          }}
                        >
                          Prev
                        </button>
                        <span style={{ color: APP_SHELL.textSecondary, fontSize: "11px" }}>
                          Page {currentPage} of {totalPages}
                        </span>
                        <button
                          onClick={() => setActivityPage((prev) => Math.min(prev + 1, totalPages))}
                          disabled={currentPage === totalPages}
                          style={{
                            padding: "6px 12px",
                            background:
                              currentPage === totalPages
                                ? "rgba(255,255,255,0.02)"
                                : "rgba(255,255,255,0.06)",
                            border: `1px solid ${APP_SHELL.cardBorder}`,
                            borderRadius: "8px",
                            color:
                              currentPage === totalPages
                                ? APP_SHELL.textMuted
                                : APP_SHELL.textPrimary,
                            fontSize: "11px",
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
    <button
      onClick={() => onClick(filter)}
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "8px 18px",
        background: isActive ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.02)",
        border: isActive ? "1px solid #fff" : "1px solid rgba(255,255,255,0.08)",
        borderRadius: "99px",
        color: isActive ? "#fff" : APP_SHELL.textSecondary,
        fontSize: "13px",
        fontWeight: isActive ? 800 : 600,
        cursor: "pointer",
        transition: "all 0.15s ease-in-out",
      }}
      onMouseEnter={(e) => {
        if (!isActive) e.currentTarget.style.color = "#fff";
      }}
      onMouseLeave={(e) => {
        if (!isActive) e.currentTarget.style.color = APP_SHELL.textSecondary;
      }}
    >
      {label}{" "}
      <span style={{ marginLeft: "4px", opacity: isActive ? 1 : 0.6, fontSize: "11px" }}>
        {count}
      </span>
    </button>
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
  const accent = item.theme?.accentColor ?? APP_SHELL.accent;
  const coverUrl = item.theme?.coverImageUrl;
  const isInvite = item.isInvite;

  // Status/Badge mapping
  let overlayText = "";
  let overlayColor = "rgba(0,0,0,0.75)";

  if (!isInvite) {
    overlayText = item.isCohost ? "👑 CO-HOST" : "👑 HOSTING";
  } else {
    if (item.userRsvpStatus === "GOING") {
      overlayText = "✅ GOING";
      overlayColor = "rgba(16,185,129,0.9)"; // green
    } else if (item.userRsvpStatus === "MAYBE") {
      overlayText = "❓ MAYBE";
      overlayColor = "rgba(245,158,11,0.9)"; // amber
    } else if (item.userRsvpStatus === "NO") {
      overlayText = "❌ DECLINED";
      overlayColor = "rgba(239,68,68,0.9)"; // red
    }
  }

  const hostName =
    item.hostDisplayName || item.host?.name || item.host?.email?.split("@")[0] || "Host";

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
          background: coverUrl
            ? "transparent"
            : `linear-gradient(135deg, #18181b 0%, ${accent}aa 100%)`,
          boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
          transition: "transform 0.2s ease-in-out",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = "scale(1.01)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = "scale(1)";
        }}
      >
        {/* Clickable Image Cover Link */}
        <Link
          href={`/e/${item.slug}`}
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
        <div
          style={{
            position: "absolute",
            top: "12px",
            left: "12px",
            background: "rgba(255, 255, 255, 0.95)",
            color: "#000",
            fontSize: "11px",
            fontWeight: 800,
            padding: "5px 10px",
            borderRadius: "99px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
            letterSpacing: "-0.01em",
            zIndex: 2,
            pointerEvents: "none", // click passes through to the Link
          }}
        >
          {formatPartifulDate(item.startAt)}
        </div>

        {/* Dots Menu Button (Top-Right) */}
        <div style={{ position: "absolute", top: "12px", right: "12px", zIndex: 3 }}>
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation(); // prevent navigating to event page
              onToggleDropdown(!isDropdownOpen);
            }}
            style={{
              width: "28px",
              height: "28px",
              borderRadius: "50%",
              background: "rgba(0,0,0,0.5)",
              border: "1px solid rgba(255,255,255,0.2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              cursor: "pointer",
              backdropFilter: "blur(4px)",
            }}
          >
            <MoreHorizontal size={14} strokeWidth={2.5} />
          </button>

          {/* Dropdown Menu */}
          {isDropdownOpen && (
            <div
              ref={dropdownRef}
              style={{
                position: "absolute",
                top: "34px",
                right: 0,
                background: "#18181b",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: "10px",
                padding: "6px",
                minWidth: "120px",
                boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
                zIndex: 50,
                display: "flex",
                flexDirection: "column",
                gap: "2px",
              }}
            >
              {!isInvite ? (
                <>
                  <DropdownLink href={`/e/${item.slug}`}>View Page</DropdownLink>
                  <DropdownLink href={`/e/${item.slug}/guests`}>Guests List</DropdownLink>
                  <DropdownLink href={`/e/${item.slug}/settings`}>Settings</DropdownLink>
                </>
              ) : (
                <>
                  <DropdownLink href={`/e/${item.slug}`}>View Invite</DropdownLink>
                  {item.userRsvpEditToken && (
                    <DropdownLink href={`/e/${item.slug}/rsvp?token=${item.userRsvpEditToken}`}>
                      Edit RSVP
                    </DropdownLink>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* Status Overlay Badge (Bottom-Right) */}
        {overlayText && (
          <div
            style={{
              position: "absolute",
              bottom: "12px",
              right: "12px",
              background: overlayColor,
              color: "#fff",
              fontSize: "10px",
              fontWeight: 900,
              padding: "4px 10px",
              borderRadius: "6px",
              letterSpacing: "0.03em",
              boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
              zIndex: 2,
              pointerEvents: "none", // click passes through to the Link
            }}
          >
            {overlayText}
          </div>
        )}
      </div>

      {/* 2. Text Details below photo */}
      <div style={{ marginTop: "12px", padding: "0 2px" }}>
        {/* Title */}
        <Link
          href={`/e/${item.slug}`}
          style={{
            fontSize: "15px",
            fontWeight: 800,
            color: "#fff",
            textDecoration: "none",
            display: "-webkit-box",
            WebkitLineClamp: 1,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
            transition: "color 0.15s ease-in-out",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = accent)}
          onMouseLeave={(e) => (e.currentTarget.style.color = "#fff")}
        >
          {item.title}
        </Link>

        {/* Hosted By & Avatars */}
        <div style={{ display: "flex", alignItems: "center", marginTop: "4px", gap: "6px" }}>
          <span style={{ color: APP_SHELL.textSecondary, fontSize: "11px" }}>Hosted by</span>
          <div style={{ display: "flex", alignItems: "center" }}>
            {/* Host avatar */}
            <AvatarBubble name={hostName} avatarUrl={item.host?.avatarUrl} accentColor={accent} />
            {/* Co-hosts avatars */}
            {item.coHosts &&
              item.coHosts.map((ch: CoHostProfile) => (
                <AvatarBubble
                  key={ch.id}
                  name={ch.name || ch.email?.split("@")[0] || "Co-host"}
                  avatarUrl={ch.avatarUrl}
                  accentColor={accent}
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
            color: APP_SHELL.textTertiary,
            fontSize: "11px",
          }}
        >
          <span>{item.going} going</span>
          {item.commentCount > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: "3px" }}>
              <span>·</span>
              <MessageSquare size={10} />
              <span>{item.commentCount}</span>
            </div>
          )}
          {item.rsvpDeadline &&
            (() => {
              const deadline = new Date(item.rsvpDeadline);
              const now = new Date();
              const hasPassed = deadline < now;
              const formatted = deadline.toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              });
              return (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "3px",
                    color: hasPassed ? "#ef4444" : APP_SHELL.textTertiary,
                    fontWeight: hasPassed ? 700 : 500,
                  }}
                >
                  <span>·</span>
                  <Clock size={10} />
                  <span>RSVPs {hasPassed ? "closed" : `by ${formatted}`}</span>
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
      style={{
        display: "block",
        padding: "6px 12px",
        color: APP_SHELL.textSecondary,
        fontSize: "12px",
        fontWeight: 600,
        textDecoration: "none",
        borderRadius: "6px",
        transition: "all 0.15s ease",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "rgba(255,255,255,0.05)";
        e.currentTarget.style.color = "#fff";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent";
        e.currentTarget.style.color = APP_SHELL.textSecondary;
      }}
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
  accentColor,
  isSibling,
}: {
  name: string;
  avatarUrl: string | null | undefined;
  accentColor: string;
  isSibling?: boolean;
}) {
  const initial = name ? name.charAt(0).toUpperCase() : "?";
  return (
    <div
      title={name}
      style={{
        width: "18px",
        height: "18px",
        borderRadius: "50%",
        background: avatarUrl
          ? "transparent"
          : `rgba(${parseInt(accentColor.slice(1, 3), 16)}, ${parseInt(accentColor.slice(3, 5), 16)}, ${parseInt(accentColor.slice(5, 7), 16)}, 0.3)`,
        border: "1.5px solid #09090b",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: "8px",
        fontWeight: 800,
        color: "#fff",
        marginLeft: isSibling ? "-5px" : "0",
        overflow: "hidden",
        position: "relative",
        flexShrink: 0,
      }}
    >
      {avatarUrl ? (
        <Image src={avatarUrl} alt={name} fill sizes="18px" style={{ objectFit: "cover" }} />
      ) : (
        initial
      )}
    </div>
  );
}
