"use client";

import React, { useState } from "react";
import Link from "next/link";
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
  Users, 
  Hourglass,
  Clock,
  Sparkles,
  ChevronRight
} from "lucide-react";
import { APP_SHELL } from "@/lib/theme";
import type { DashboardEvent, DashboardActivity } from "@/app/actions/event";

interface DashboardClientProps {
  initialEvents: DashboardEvent[];
  recentActivities: DashboardActivity[];
  userName: string;
}

export function DashboardClient({ initialEvents, recentActivities, userName }: DashboardClientProps) {
  // State for search and filtering
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | "hosting" | "co-hosting">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "PUBLISHED" | "DRAFT" | "CANCELLED">("all");
  
  // State for card hovers to add micro-animations
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);
  const [hoveredEventId, setHoveredEventId] = useState<string | null>(null);

  const now = new Date();

  // Statistics calculation based on upcoming events
  const upcomingEvents = initialEvents.filter(e => new Date(e.startAt) >= now);
  const activeEventsCount = upcomingEvents.length;
  const totalGoingRSVPs = upcomingEvents.reduce((acc, curr) => acc + curr.going, 0);
  const totalPendingApprovals = upcomingEvents.reduce((acc, curr) => acc + curr.pending, 0);

  // Client-side filtering logic
  const filteredEvents = initialEvents.filter(event => {
    const matchesSearch = event.title.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesRole = 
      roleFilter === "all" ? true :
      roleFilter === "hosting" ? !event.isCohost :
      event.isCohost;

    const matchesStatus = 
      statusFilter === "all" ? true :
      event.status === statusFilter;

    return matchesSearch && matchesRole && matchesStatus;
  });

  const upcomingFiltered = filteredEvents.filter(e => new Date(e.startAt) >= now);
  const pastFiltered = filteredEvents.filter(e => new Date(e.startAt) < now);

  // Helper for formatting date
  const formatEventDate = (dateVal: Date | string) => {
    const d = new Date(dateVal);
    return d.toLocaleDateString("en-US", { 
      weekday: "short", 
      month: "short", 
      day: "numeric", 
      year: "numeric" 
    });
  };

  // Helper for relative time in activity log
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

  // Helper to resolve activity type to icon & color
  const getActivityMeta = (type: string) => {
    switch (type) {
      case "rsvp_new":
        return { Icon: UserCheck, color: "#a855f7" }; // Purple
      case "rsvp_update":
        return { Icon: Edit3, color: "#6366f1" }; // Indigo
      case "rsvp_delete":
        return { Icon: Trash2, color: "#ef4444" }; // Red
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

  return (
    <div style={{ maxWidth: "1000px", margin: "0 auto", padding: "40px 20px 100px" }}>
      
      {/* 1. Dashboard Greeting/Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "36px", flexWrap: "wrap", gap: "20px" }}>
        <div>
          <h1 style={{ 
            fontSize: "28px", 
            fontWeight: 900, 
            background: "linear-gradient(to right, #ffffff, rgba(255,255,255,0.7))", 
            WebkitBackgroundClip: "text", 
            WebkitTextFillColor: "transparent",
            marginBottom: "6px" 
          }}>
            Hey, {userName}!
          </h1>
          <p style={{ color: APP_SHELL.textSecondary, fontSize: "14px" }}>
            Welcome back to your events cockpit.
          </p>
        </div>
        
        <Link
          href="/dashboard/events/new"
          style={{ 
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            padding: "12px 24px", 
            background: `linear-gradient(135deg, ${APP_SHELL.accent} 0%, #ec4899 100%)`, 
            color: APP_SHELL.textPrimary, 
            borderRadius: APP_SHELL.btnRadius, 
            textDecoration: "none", 
            fontSize: "14px", 
            fontWeight: 800, 
            boxShadow: `0 4px 14px rgba(168, 85, 247, 0.4)`,
            transition: "transform 0.2s, box-shadow 0.2s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "translateY(-1px)";
            e.currentTarget.style.boxShadow = `0 6px 18px rgba(168, 85, 247, 0.5)`;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "translateY(0)";
            e.currentTarget.style.boxShadow = `0 4px 14px rgba(168, 85, 247, 0.4)`;
          }}
        >
          <Plus size={16} strokeWidth={3} />
          New Event
        </Link>
      </div>

      {/* 2. Glassmorphic Analytics Panel */}
      <div style={{ 
        display: "grid", 
        gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", 
        gap: "16px", 
        marginBottom: "40px" 
      }}>
        {/* Metric 1: Active Invites */}
        <div 
          style={{ 
            background: APP_SHELL.cardBg, 
            border: `1px solid ${hoveredCard === "active" ? `rgba(168, 85, 247, 0.4)` : APP_SHELL.cardBorder}`, 
            borderRadius: APP_SHELL.cardRadius, 
            padding: "20px 24px",
            boxShadow: hoveredCard === "active" ? "0 8px 30px rgba(168, 85, 247, 0.08)" : "none",
            transform: hoveredCard === "active" ? "translateY(-2px)" : "translateY(0)",
            transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
            cursor: "default"
          }}
          onMouseEnter={() => setHoveredCard("active")}
          onMouseLeave={() => setHoveredCard(null)}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
            <span style={{ fontSize: "13px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: APP_SHELL.textSecondary }}>Active Invites</span>
            <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: "rgba(168, 85, 247, 0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Calendar size={16} color={APP_SHELL.accent} />
            </div>
          </div>
          <div style={{ fontSize: "28px", fontWeight: 900, color: APP_SHELL.textPrimary }}>{activeEventsCount}</div>
          <div style={{ fontSize: "12px", color: APP_SHELL.textMuted, marginTop: "4px" }}>Upcoming scheduled events</div>
        </div>

        {/* Metric 2: Going Guests */}
        <div 
          style={{ 
            background: APP_SHELL.cardBg, 
            border: `1px solid ${hoveredCard === "going" ? `rgba(236, 72, 153, 0.4)` : APP_SHELL.cardBorder}`, 
            borderRadius: APP_SHELL.cardRadius, 
            padding: "20px 24px",
            boxShadow: hoveredCard === "going" ? "0 8px 30px rgba(236, 72, 153, 0.08)" : "none",
            transform: hoveredCard === "going" ? "translateY(-2px)" : "translateY(0)",
            transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
            cursor: "default"
          }}
          onMouseEnter={() => setHoveredCard("going")}
          onMouseLeave={() => setHoveredCard(null)}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
            <span style={{ fontSize: "13px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: APP_SHELL.textSecondary }}>Going Guests</span>
            <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: "rgba(236, 72, 153, 0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Users size={16} color="#ec4899" />
            </div>
          </div>
          <div style={{ fontSize: "28px", fontWeight: 900, color: APP_SHELL.textPrimary }}>{totalGoingRSVPs}</div>
          <div style={{ fontSize: "12px", color: APP_SHELL.textMuted, marginTop: "4px" }}>RSVPs across upcoming events</div>
        </div>

        {/* Metric 3: Pending Approvals */}
        <div 
          style={{ 
            background: APP_SHELL.cardBg, 
            border: `1px solid ${totalPendingApprovals > 0 ? (hoveredCard === "pending" ? `rgba(245, 158, 11, 0.6)` : `rgba(245, 158, 11, 0.3)`) : APP_SHELL.cardBorder}`, 
            borderRadius: APP_SHELL.cardRadius, 
            padding: "20px 24px",
            boxShadow: hoveredCard === "pending" ? "0 8px 30px rgba(245, 158, 11, 0.08)" : "none",
            transform: hoveredCard === "pending" ? "translateY(-2px)" : "translateY(0)",
            transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
            cursor: "default"
          }}
          onMouseEnter={() => setHoveredCard("pending")}
          onMouseLeave={() => setHoveredCard(null)}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
            <span style={{ fontSize: "13px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: APP_SHELL.textSecondary }}>Pending RSVPs</span>
            <div style={{ 
              width: "32px", 
              height: "32px", 
              borderRadius: "8px", 
              background: totalPendingApprovals > 0 ? "rgba(245, 158, 11, 0.15)" : "rgba(255,255,255,0.05)", 
              display: "flex", 
              alignItems: "center", 
              justifyContent: "center" 
            }}>
              <Hourglass size={16} color={totalPendingApprovals > 0 ? "#f59e0b" : APP_SHELL.textMuted} />
            </div>
          </div>
          <div style={{ 
            fontSize: "28px", 
            fontWeight: 900, 
            color: totalPendingApprovals > 0 ? "#f59e0b" : APP_SHELL.textPrimary 
          }}>{totalPendingApprovals}</div>
          <div style={{ fontSize: "12px", color: totalPendingApprovals > 0 ? "#fbbf24" : APP_SHELL.textMuted, marginTop: "4px" }}>
            {totalPendingApprovals > 0 ? "⚠️ Requires host review" : "No pending approvals"}
          </div>
        </div>
      </div>

      {/* 3. Main Split View: Left list, Right activity feed */}
      <div className="flex flex-col lg:flex-row gap-8">
        
        {/* Left Section: Event Listing */}
        <div style={{ flex: 1, minWidth: 0 }}>
          
          {/* Controls Bar: Search & Tabs */}
          <div style={{ 
            background: "rgba(255,255,255,0.02)", 
            border: `1px solid ${APP_SHELL.cardBorder}`,
            borderRadius: APP_SHELL.itemRadius,
            padding: "16px",
            marginBottom: "24px"
          }}>
            {/* Search Input */}
            <div style={{ position: "relative", marginBottom: "16px" }}>
              <Search 
                size={18} 
                style={{ 
                  position: "absolute", 
                  left: "14px", 
                  top: "50%", 
                  transform: "translateY(-50%)", 
                  color: APP_SHELL.textMuted 
                }} 
              />
              <input 
                type="text" 
                placeholder="Search events by title..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ 
                  width: "100%", 
                  padding: "12px 14px 12px 42px", 
                  background: APP_SHELL.inputBg, 
                  border: `1px solid ${APP_SHELL.inputBorder}`, 
                  borderRadius: APP_SHELL.inputRadius, 
                  color: APP_SHELL.textPrimary,
                  fontSize: "14px",
                  outline: "none",
                  transition: "border-color 0.2s"
                }}
                onFocus={(e) => e.target.style.borderColor = APP_SHELL.accent}
                onBlur={(e) => e.target.style.borderColor = APP_SHELL.inputBorder}
              />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery("")}
                  style={{ 
                    position: "absolute", 
                    right: "14px", 
                    top: "50%", 
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    color: APP_SHELL.textMuted,
                    cursor: "pointer",
                    fontSize: "13px"
                  }}
                >
                  Clear
                </button>
              )}
            </div>

            {/* Filter Tabs */}
            <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "12px", alignItems: "center" }}>
              
              {/* Role tabs */}
              <div style={{ display: "flex", background: "rgba(0,0,0,0.2)", padding: "4px", borderRadius: "10px", gap: "4px" }}>
                {(["all", "hosting", "co-hosting"] as const).map((role) => (
                  <button
                    key={role}
                    onClick={() => setRoleFilter(role)}
                    style={{
                      padding: "6px 12px",
                      background: roleFilter === role ? "rgba(255,255,255,0.08)" : "transparent",
                      color: roleFilter === role ? APP_SHELL.textPrimary : APP_SHELL.textSecondary,
                      border: "none",
                      borderRadius: "8px",
                      fontSize: "12px",
                      fontWeight: 700,
                      cursor: "pointer",
                      textTransform: "capitalize",
                      transition: "all 0.2s"
                    }}
                  >
                    {role === "all" ? "All Roles" : role === "co-hosting" ? "Co-Hosting" : "Hosting"}
                  </button>
                ))}
              </div>

              {/* Status tabs */}
              <div style={{ display: "flex", background: "rgba(0,0,0,0.2)", padding: "4px", borderRadius: "10px", gap: "4px" }}>
                {(["all", "PUBLISHED", "DRAFT", "CANCELLED"] as const).map((status) => (
                  <button
                    key={status}
                    onClick={() => setStatusFilter(status)}
                    style={{
                      padding: "6px 10px",
                      background: statusFilter === status ? "rgba(255,255,255,0.08)" : "transparent",
                      color: statusFilter === status ? APP_SHELL.textPrimary : APP_SHELL.textSecondary,
                      border: "none",
                      borderRadius: "8px",
                      fontSize: "11px",
                      fontWeight: 700,
                      cursor: "pointer",
                      transition: "all 0.2s"
                    }}
                  >
                    {status === "all" ? "All Status" : status}
                  </button>
                ))}
              </div>

            </div>
          </div>

          {/* Results Lists */}
          {filteredEvents.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 20px", background: APP_SHELL.cardBg, border: `1px solid ${APP_SHELL.cardBorder}`, borderRadius: APP_SHELL.cardRadius }}>
              <div style={{ fontSize: "40px", marginBottom: "16px" }}>🔍</div>
              <p style={{ color: APP_SHELL.textMuted, fontSize: "14px", marginBottom: "20px" }}>
                No events found matching your search and filters.
              </p>
              {(searchQuery || roleFilter !== "all" || statusFilter !== "all") && (
                <button 
                  onClick={() => {
                    setSearchQuery("");
                    setRoleFilter("all");
                    setStatusFilter("all");
                  }}
                  style={{
                    padding: "8px 16px",
                    background: "rgba(255,255,255,0.05)",
                    border: `1px solid ${APP_SHELL.cardBorder}`,
                    color: APP_SHELL.textPrimary,
                    borderRadius: "8px",
                    fontSize: "13px",
                    fontWeight: 600,
                    cursor: "pointer"
                  }}
                >
                  Reset All Filters
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Upcoming Section */}
              {upcomingFiltered.length > 0 && (
                <div style={{ marginBottom: "32px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
                    <div style={{ width: "6px", height: "6px", borderRadius: "99px", background: APP_SHELL.accent }}></div>
                    <h2 style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: APP_SHELL.textSecondary }}>
                      Upcoming ({upcomingFiltered.length})
                    </h2>
                  </div>
                  {upcomingFiltered.map(event => (
                    <EventCard 
                      key={event.id} 
                      event={event} 
                      isHovered={hoveredEventId === event.id}
                      onHover={(isHover) => setHoveredEventId(isHover ? event.id : null)}
                      formatEventDate={formatEventDate}
                    />
                  ))}
                </div>
              )}

              {/* Past Section */}
              {pastFiltered.length > 0 && (
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
                    <div style={{ width: "6px", height: "6px", borderRadius: "99px", background: APP_SHELL.textMuted }}></div>
                    <h2 style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: APP_SHELL.textTertiary }}>
                      Past Events ({pastFiltered.length})
                    </h2>
                  </div>
                  {pastFiltered.map(event => (
                    <EventCard 
                      key={event.id} 
                      event={event} 
                      isHovered={hoveredEventId === event.id}
                      onHover={(isHover) => setHoveredEventId(isHover ? event.id : null)}
                      formatEventDate={formatEventDate}
                    />
                  ))}
                </div>
              )}
            </>
          )}

        </div>

        {/* Right Section: Recent Activity (1/3 width on wide screens) */}
        <div style={{ width: "100%", maxWidth: "340px", flexShrink: 0 }} className="dashboard-sidebar">
          <div style={{ 
            background: APP_SHELL.cardBg, 
            border: `1px solid ${APP_SHELL.cardBorder}`, 
            borderRadius: APP_SHELL.cardRadius,
            padding: "24px",
            position: "sticky",
            top: "24px"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "18px" }}>
              <Clock size={16} color={APP_SHELL.accent} />
              <h3 style={{ fontSize: "14px", fontWeight: 800, color: APP_SHELL.textPrimary }}>
                Recent Activity
              </h3>
            </div>

            {recentActivities.length === 0 ? (
              <div style={{ padding: "30px 10px", textAlign: "center", color: APP_SHELL.textMuted, fontSize: "13px" }}>
                <Sparkles size={24} style={{ display: "block", margin: "0 auto 8px", opacity: 0.5 }} />
                No activity logged yet. When guests RSVP or comments are posted, they will appear here!
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                {recentActivities.map((act) => {
                  const { Icon, color } = getActivityMeta(act.type);
                  return (
                    <div key={act.id} style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
                      {/* Activity icon box */}
                      <div style={{ 
                        width: "28px", 
                        height: "28px", 
                        borderRadius: "6px", 
                        background: `rgba(${parseInt(color.slice(1,3), 16)}, ${parseInt(color.slice(3,5), 16)}, ${parseInt(color.slice(5,7), 16)}, 0.1)`, 
                        display: "flex", 
                        alignItems: "center", 
                        justifyContent: "center",
                        flexShrink: 0,
                        marginTop: "2px"
                      }}>
                        <Icon size={14} color={color} />
                      </div>
                      
                      {/* Activity details */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ color: APP_SHELL.textPrimary, fontSize: "12px", lineHeight: "1.4", margin: 0, wordBreak: "break-word" }}>
                          {act.detail}
                        </p>
                        
                        {/* Event Link & Time */}
                        <div style={{ display: "flex", gap: "6px", alignItems: "center", marginTop: "4px" }}>
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
                              display: "inline-block"
                            }}
                          >
                            {act.event.title}
                          </Link>
                          <span style={{ color: APP_SHELL.textTertiary, fontSize: "11px" }}>·</span>
                          <span style={{ color: APP_SHELL.textMuted, fontSize: "11px" }}>
                            {formatRelativeTime(act.createdAt)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// Helper Child Component: Status Badge
// ──────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  if (status === "PUBLISHED") return null;
  const colors: Record<string, { bg: string; text: string }> = {
    DRAFT:     { bg: "rgba(245,158,11,0.15)", text: "#fbbf24" },
    CANCELLED: { bg: "rgba(239,68,68,0.15)",  text: "#f87171" },
  };
  const c = colors[status] ?? colors.DRAFT;
  return (
    <span style={{ 
      fontSize: "10px", 
      fontWeight: 700, 
      background: c.bg, 
      color: c.text, 
      padding: "2px 8px", 
      borderRadius: "99px", 
      flexShrink: 0, 
      letterSpacing: "0.04em" 
    }}>
      {status}
    </span>
  );
}

// ──────────────────────────────────────────────
// Helper Child Component: Stat Item inside Cards
// ──────────────────────────────────────────────
function MiniStat({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <div style={{ textAlign: "right", minWidth: "50px" }}>
      <div style={{ color, fontWeight: 800, fontSize: "14px", lineHeight: "1.1" }}>{value}</div>
      <div style={{ color: APP_SHELL.textTertiary, fontSize: "10px", fontWeight: 600, textTransform: "uppercase", marginTop: "2px" }}>{label}</div>
    </div>
  );
}

// ──────────────────────────────────────────────
// Helper Child Component: Event Card
// ──────────────────────────────────────────────
interface EventCardProps {
  event: DashboardEvent;
  isHovered: boolean;
  onHover: (hover: boolean) => void;
  formatEventDate: (date: Date | string) => string;
}

function EventCard({ event, isHovered, onHover, formatEventDate }: EventCardProps) {
  const accent = event.theme?.accentColor ?? APP_SHELL.accent;
  
  return (
    <div 
      style={{ 
        background: APP_SHELL.cardBg, 
        border: `1px solid ${isHovered ? `rgba(${parseInt(accent.slice(1,3), 16)}, ${parseInt(accent.slice(3,5), 16)}, ${parseInt(accent.slice(5,7), 16)}, 0.3)` : APP_SHELL.cardBorder}`, 
        borderRadius: APP_SHELL.itemRadius, 
        marginBottom: "12px", 
        overflow: "hidden",
        transform: isHovered ? "translateY(-1px)" : "translateY(0)",
        boxShadow: isHovered ? `0 6px 20px rgba(${parseInt(accent.slice(1,3), 16)}, ${parseInt(accent.slice(3,5), 16)}, ${parseInt(accent.slice(5,7), 16)}, 0.04)` : "none",
        transition: "all 0.2s ease-in-out"
      }}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
    >
      {/* Main card row */}
      <div style={{ padding: "18px 20px", display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
        
        {/* Left Side: Avatar/Emoji icon */}
        <div style={{ 
          width: "44px", 
          height: "44px", 
          borderRadius: "12px", 
          background: `rgba(${parseInt(accent.slice(1,3), 16)}, ${parseInt(accent.slice(3,5), 16)}, ${parseInt(accent.slice(5,7), 16)}, 0.15)`, 
          border: `1px solid rgba(${parseInt(accent.slice(1,3), 16)}, ${parseInt(accent.slice(3,5), 16)}, ${parseInt(accent.slice(5,7), 16)}, 0.25)`,
          flexShrink: 0, 
          display: "flex", 
          alignItems: "center", 
          justifyContent: "center", 
          fontSize: "20px" 
        }}>
          🎉
        </div>

        {/* Center: Event Details */}
        <div style={{ flex: 1, minWidth: "200px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px", flexWrap: "wrap" }}>
            <Link 
              href={`/e/${event.slug}`} 
              style={{ 
                color: APP_SHELL.textPrimary, 
                fontWeight: 800, 
                fontSize: "15px", 
                textDecoration: "none",
                transition: "color 0.2s"
              }}
              onMouseEnter={(e) => e.currentTarget.style.color = accent}
              onMouseLeave={(e) => e.currentTarget.style.color = APP_SHELL.textPrimary}
            >
              {event.title}
            </Link>
            
            <StatusBadge status={event.status} />

            {event.isCohost && (
              <span style={{ 
                fontSize: "9px", 
                fontWeight: 800, 
                background: "rgba(168,85,247,0.15)", 
                color: "#c084fc", 
                padding: "2px 7px", 
                borderRadius: "99px",
                border: "1px solid rgba(168,85,247,0.25)",
                flexShrink: 0 
              }}>
                CO-HOST
              </span>
            )}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
            <span style={{ color: APP_SHELL.textSecondary, fontSize: "13px" }}>
              {formatEventDate(event.startAt)}
            </span>
            {event.isCohost && event.host && (
              <>
                <span style={{ color: APP_SHELL.textTertiary, fontSize: "13px" }}>·</span>
                <span style={{ color: APP_SHELL.textMuted, fontSize: "12px" }}>
                  Host: {event.host.name || event.host.email?.split("@")[0]}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Right Side: Quick Stats */}
        <div style={{ display: "flex", gap: "16px", alignItems: "center", flexShrink: 0, marginLeft: "auto" }}>
          <MiniStat value={event.going} label="going" color={accent} />
          {event.maybe > 0 && <MiniStat value={event.maybe} label="maybe" color={APP_SHELL.textSecondary} />}
          {event.pending > 0 && <MiniStat value={event.pending} label="pending" color="#f59e0b" />}
          
          <ChevronRight size={18} style={{ color: APP_SHELL.textTertiary, marginLeft: "4px", opacity: isHovered ? 0.8 : 0.4, transition: "opacity 0.2s" }} />
        </div>

      </div>

      {/* Action Strip (Bottom) */}
      <div style={{ 
        borderTop: `1px solid ${APP_SHELL.cardBorder}`, 
        background: "rgba(0,0,0,0.1)",
        padding: "8px 20px", 
        display: "flex", 
        gap: "16px" 
      }}>
        <QuickLink href={`/e/${event.slug}`}>View Page</QuickLink>
        <QuickLink href={`/e/${event.slug}/guests`}>Guests List</QuickLink>
        <QuickLink href={`/e/${event.slug}/settings`}>Settings</QuickLink>
      </div>

    </div>
  );
}

// ──────────────────────────────────────────────
// Helper Child Component: Action Link
// ──────────────────────────────────────────────
function QuickLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link 
      href={href} 
      style={{ 
        fontSize: "12px", 
        fontWeight: 700, 
        color: APP_SHELL.textSecondary, 
        textDecoration: "none", 
        padding: "4px 0",
        transition: "color 0.15s"
      }}
      onMouseEnter={(e) => e.currentTarget.style.color = APP_SHELL.textPrimary}
      onMouseLeave={(e) => e.currentTarget.style.color = APP_SHELL.textSecondary}
    >
      {children}
    </Link>
  );
}
