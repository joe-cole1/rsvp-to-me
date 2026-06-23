import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { AppShell } from "@/components/ui/AppShell";
import { APP_SHELL } from "@/lib/theme";
import { db } from "@/lib/db";
import Link from "next/link";
import Image from "next/image";
import { resolveTheme } from "@/lib/theme";
import { MessageSquare } from "lucide-react";

// Helper to format date Partiful-style
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

function AvatarBubble({ name, avatarUrl, accentColor }: { name: string; avatarUrl: string | null | undefined; accentColor: string }) {
  const initial = name ? name.charAt(0).toUpperCase() : "?";
  let rgb = "168,85,247"; // fallback purple
  try {
    if (accentColor.startsWith("#") && accentColor.length === 7) {
      rgb = `${parseInt(accentColor.slice(1,3), 16)},${parseInt(accentColor.slice(3,5), 16)},${parseInt(accentColor.slice(5,7), 16)}`;
    }
  } catch (e) {}

  return (
    <div 
      title={name}
      style={{
        width: "18px",
        height: "18px",
        borderRadius: "50%",
        background: avatarUrl ? "transparent" : `rgba(${rgb}, 0.3)`,
        border: "1.5px solid #09090b",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: "8px",
        fontWeight: 800,
        color: "#fff",
        overflow: "hidden",
        position: "relative",
        flexShrink: 0
      }}
    >
      {avatarUrl ? (
        <Image 
          src={avatarUrl} 
          alt={name} 
          unoptimized
          fill
          style={{ objectFit: "cover" }} 
        />
      ) : (
        initial
      )}
    </div>
  );
}

export default async function Home() {
  const session = await getSession();
  if (session) redirect("/dashboard");

  const events = await db.event.findMany({
    where: {
      visibility: "PUBLIC",
      status: { notIn: ["CANCELLED", "DELETED"] }
    },
    orderBy: {
      startAt: "asc"
    },
    take: 20,
    include: {
      host: {
        select: {
          name: true,
          email: true,
          avatarUrl: true,
        }
      },
      theme: true,
      rsvps: {
        select: {
          status: true,
        }
      },
      comments: {
        select: {
          id: true,
        }
      }
    }
  });

  return (
    <AppShell>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%", padding: "60px 24px 100px" }}>
        {/* Marketing Hero CTA */}
        <div style={{ textAlign: "center", maxWidth: "480px", marginBottom: "64px" }}>
          <div style={{ fontSize: "64px", marginBottom: "24px" }}>🎉</div>
          <h1
            style={{
              fontSize: "48px",
              fontWeight: 900,
              marginBottom: "12px",
              background: `linear-gradient(135deg, ${APP_SHELL.accent}, ${APP_SHELL.accentSecondary})`,
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            RSVP to Me
          </h1>
          <p style={{ fontSize: "18px", color: APP_SHELL.textSecondary, marginBottom: "40px", lineHeight: 1.6 }}>
            Beautiful, personal event pages for wine nights, dinner parties, and everything in between.
          </p>
          <div style={{ display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap" }}>
            <a
              href="/auth/sign-in"
              style={{
                padding: "14px 32px",
                background: APP_SHELL.accent,
                color: APP_SHELL.textPrimary,
                borderRadius: APP_SHELL.btnRadius,
                textDecoration: "none",
                fontSize: "16px",
                fontWeight: 700,
              }}
            >
              Sign in
            </a>
            <a
              href="/auth/register"
              style={{
                padding: "14px 32px",
                background: APP_SHELL.cardBg2,
                border: `1px solid ${APP_SHELL.cardBorder}`,
                color: APP_SHELL.textPrimary,
                borderRadius: APP_SHELL.btnRadius,
                textDecoration: "none",
                fontSize: "16px",
                fontWeight: 700,
              }}
            >
              Create account
            </a>
          </div>
        </div>

        {/* Public Feed Section */}
        {events.length > 0 && (
          <div style={{ width: "100%", maxWidth: "1000px" }}>
            <h2 style={{ fontSize: "20px", fontWeight: 800, marginBottom: "24px", color: "#fff", borderBottom: `1px solid ${APP_SHELL.cardBorder}`, paddingBottom: "12px" }}>
              Upcoming Public Events
            </h2>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
                gap: "24px",
                width: "100%"
              }}
            >
              {events.map((event) => {
                const resolved = resolveTheme(
                  event.theme?.baseTheme ?? "DARK",
                  event.theme?.gradientFrom ?? "#7c3aed",
                  event.theme?.gradientTo ?? "#1e40af",
                  event.theme?.accentColor ?? "#a855f7"
                );
                const accent = resolved.accent;
                const coverUrl = event.theme?.coverImageUrl;
                const hostName = event.host?.name || event.host?.email?.split("@")[0] || "Host";
                const goingCount = event.rsvps.filter((r) => r.status === "GOING").length;
                const commentCount = event.comments.length;

                return (
                  <div key={event.id} style={{ display: "flex", flexDirection: "column", width: "100%" }}>
                    {/* Cover Image Container */}
                    <div 
                      style={{
                        position: "relative",
                        width: "100%",
                        paddingBottom: "75%", // 4:3 Aspect ratio
                        borderRadius: "16px",
                        overflow: "hidden",
                        background: coverUrl ? "transparent" : `linear-gradient(135deg, #18181b 0%, ${accent}aa 100%)`,
                        boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
                      }}
                    >
                      <Link 
                        href={`/e/${event.slug}`}
                        style={{
                          position: "absolute",
                          top: 0,
                          left: 0,
                          width: "100%",
                          height: "100%",
                          zIndex: 1,
                          display: "block"
                        }}
                      >
                        {coverUrl && (
                          <Image 
                            src={coverUrl} 
                            alt={event.title} 
                            unoptimized
                            fill
                            style={{ objectFit: "cover" }}
                          />
                        )}
                        {!coverUrl && (
                          <div style={{
                            width: "100%",
                            height: "100%",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "48px",
                            opacity: 0.85
                          }}>
                            🎉
                          </div>
                        )}
                      </Link>

                      {/* Date Overlay (Top-Left) */}
                      <div style={{
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
                        pointerEvents: "none"
                      }}>
                        {formatPartifulDate(event.startAt)}
                      </div>
                    </div>

                    {/* Text Details */}
                    <div style={{ marginTop: "12px", padding: "0 2px" }}>
                      <Link 
                        href={`/e/${event.slug}`}
                        style={{
                          fontSize: "15px",
                          fontWeight: 800,
                          color: "#fff",
                          textDecoration: "none",
                          display: "-webkit-box",
                          WebkitLineClamp: 1,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                        }}
                      >
                        {event.title}
                      </Link>

                      {/* Host */}
                      <div style={{ display: "flex", alignItems: "center", marginTop: "4px", gap: "6px" }}>
                        <span style={{ color: APP_SHELL.textSecondary, fontSize: "11px" }}>
                          Hosted by
                        </span>
                        <div style={{ display: "flex", alignItems: "center" }}>
                          <AvatarBubble name={hostName} avatarUrl={event.host?.avatarUrl} accentColor={accent} />
                        </div>
                      </div>

                      {/* Stats */}
                      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "6px", color: APP_SHELL.textTertiary, fontSize: "11px" }}>
                        <span>{goingCount} going</span>
                        {commentCount > 0 && (
                          <div style={{ display: "flex", alignItems: "center", gap: "3px" }}>
                            <span>·</span>
                            <MessageSquare size={10} />
                            <span>{commentCount}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
