"use client";

import { resolveTheme } from "@/lib/theme";

export default function SoftPreview() {
  const accent = "#22c55e"; // green
  const secondary = "#f9a8d4"; // pink
  const t = resolveTheme("SOFT", accent, secondary, accent);

  return (
    <div
      className="min-h-screen relative overflow-hidden"
      style={{ background: t.pageBg, color: t.textPrimary }}
    >
      {/* Soft background blobs */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden>
        <div
          style={{
            position: "absolute",
            top: "-10%",
            right: "-10%",
            width: "500px",
            height: "500px",
            borderRadius: "50%",
            background: t.pageDecorationBg1,
            filter: "blur(60px)",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: "20%",
            left: "-5%",
            width: "400px",
            height: "400px",
            borderRadius: "50%",
            background: t.pageDecorationBg2,
            filter: "blur(60px)",
          }}
        />
      </div>

      <div className="relative z-10 max-w-lg mx-auto px-4 py-12">
        {/* Cover */}
        <div
          className="w-full rounded-3xl mb-8 flex items-center justify-center overflow-hidden"
          style={{
            height: "260px",
            background: t.avatarGradient,
            boxShadow: t.cardShadow,
          }}
        >
          <span style={{ fontSize: "80px", filter: "drop-shadow(0 4px 12px rgba(0,0,0,0.15))" }}>🍷</span>
        </div>

        {/* Date */}
        <div className="flex items-center gap-2 mb-3">
          <span
            className="text-xs font-semibold uppercase tracking-widest px-3 py-1 rounded-full"
            style={{ background: t.badgeBg, color: t.badgeText }}
          >
            Friday, June 27
          </span>
          <span
            className="text-xs font-semibold uppercase tracking-widest px-3 py-1 rounded-full"
            style={{ background: t.badgeBg, color: t.badgeText }}
          >
            8:00 PM
          </span>
        </div>

        {/* Title */}
        <h1
          className="text-4xl font-bold mb-2"
          style={{
            letterSpacing: "-0.02em",
            fontFamily: t.headingFont,
          }}
        >
          Wine Night ✨
        </h1>

        {/* Host */}
        <div className="flex items-center gap-2 mb-6">
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
            style={{ background: t.avatarGradient, color: t.accentFg }}
          >
            J
          </div>
          <span style={{ color: t.textSecondary }}>Hosted by Joe</span>
        </div>

        {/* Location */}
        <div
          className="flex items-start gap-3 mb-8 p-4 rounded-2xl"
          style={{ background: t.cardBg, border: `1px solid ${t.cardBorder}` }}
        >
          <span style={{ color: t.accent, fontSize: "18px" }}>📍</span>
          <div>
            <div className="font-medium">Joe&apos;s Place</div>
            <div style={{ color: t.textMuted, fontSize: "14px" }}>123 Main St, Brooklyn, NY</div>
          </div>
        </div>

        {/* Description */}
        <p className="mb-8 leading-relaxed" style={{ color: t.textSecondary }}>
          Monthly wine night at my place! Bring a bottle you love and be ready to share what
          you enjoy about it. I&apos;ll have snacks and plenty of glasses. This month&apos;s theme is
          anything from Burgundy. 🍇
        </p>

        {/* RSVP Card */}
        <div
          className="rounded-3xl p-6 mb-6"
          style={{
            background: t.cardBg,
            border: `1px solid ${t.accentBorder}`,
            boxShadow: t.cardShadow,
          }}
        >
          <h2 className="text-lg font-semibold mb-4" style={{ fontFamily: t.headingFont }}>Are you coming?</h2>
          <div className="flex gap-3 mb-5">
            {[
              { label: "Going", emoji: "🎉", active: true },
              { label: "Maybe", emoji: "🤔", active: false },
              { label: "Can't go", emoji: "😔", active: false },
            ].map((opt) => (
              <button
                key={opt.label}
                className="flex-1 py-3 rounded-xl text-sm font-semibold transition-all"
                style={
                  opt.active
                    ? {
                        background: t.accent,
                        color: t.accentFg,
                        boxShadow: t.accentShadow,
                        border: "none",
                      }
                    : {
                        background: t.inputBg,
                        color: t.textSecondary,
                        border: `1px solid ${t.inputBorder}`,
                      }
                }
              >
                <div>{opt.emoji}</div>
                <div style={{ fontSize: "11px", marginTop: "2px" }}>{opt.label}</div>
              </button>
            ))}
          </div>
          <div className="space-y-3">
            <input
              className="w-full px-4 py-3 rounded-xl text-sm outline-none"
              placeholder="Your name"
              style={{
                background: t.inputBg,
                border: `1px solid ${t.inputBorder}`,
                color: t.inputText,
              }}
            />
            <input
              className="w-full px-4 py-3 rounded-xl text-sm outline-none"
              placeholder="Email (optional — for updates)"
              style={{
                background: t.inputBg,
                border: `1px solid ${t.inputBorder}`,
                color: t.inputText,
              }}
            />
            <button
              className="w-full py-3.5 rounded-xl font-semibold text-sm"
              style={{
                background: t.accent,
                color: t.accentFg,
                boxShadow: t.accentShadow,
                border: "none",
              }}
            >
              Send RSVP
            </button>
          </div>
        </div>

        {/* Guest list */}
        <div
          className="rounded-3xl p-5 mb-6"
          style={{
            background: t.cardBg,
            border: `1px solid ${t.cardBorder}`,
          }}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Going (8)</h3>
            <span style={{ color: t.textMuted, fontSize: "13px" }}>3 maybe</span>
          </div>
          <div className="flex gap-2 flex-wrap">
            {["Sarah", "Mike", "Emma", "James", "Priya", "Tom", "Leila", "Raj"].map((name) => (
              <div
                key={name}
                className="flex items-center gap-2 px-3 py-1.5 rounded-2xl text-sm font-semibold"
                style={{
                  background: t.pillBg,
                  border: `1px solid ${t.pillBorder}`,
                }}
              >
                <div
                  className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold"
                  style={{ background: t.avatarGradient, color: t.accentFg }}
                >
                  {name[0]}
                </div>
                {name}
              </div>
            ))}
          </div>
        </div>

        {/* Comments */}
        <div
          className="rounded-3xl p-5"
          style={{
            background: t.cardBg,
            border: `1px solid ${t.cardBorder}`,
          }}
        >
          <h3 className="font-semibold mb-4">Vibes 💬</h3>
          <div className="space-y-3 mb-4">
            {[
              { name: "Sarah", msg: "Cannot wait!! Bringing a Pinot I've been saving 🍷", time: "2h ago" },
              { name: "Mike", msg: "YES. Bringing something from Burgundy!", time: "1h ago" },
            ].map((c) => (
              <div key={c.name} className="flex gap-3">
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                  style={{ background: t.avatarGradient, color: t.accentFg }}
                >
                  {c.name[0]}
                </div>
                <div
                  className="flex-1 px-3 py-2 rounded-2xl text-sm"
                  style={{ background: t.inputBg, border: `1px solid ${t.inputBorder}` }}
                >
                  <span className="font-medium">{c.name}</span>
                  <span style={{ color: t.textMuted, fontSize: "11px", marginLeft: "8px" }}>{c.time}</span>
                  <p style={{ color: t.textSecondary, marginTop: "2px" }}>{c.msg}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              className="flex-1 px-3 py-2 rounded-xl text-sm outline-none"
              placeholder="Say something..."
              style={{
                background: t.inputBg,
                border: `1px solid ${t.inputBorder}`,
                color: t.inputText,
              }}
            />
            <button
              className="px-4 py-2 rounded-xl text-sm font-semibold"
              style={{ background: t.accentBg, color: t.accent, border: `1px solid ${t.accentBorder}` }}
            >
              Post
            </button>
          </div>
        </div>

        <p className="text-center mt-8 text-xs" style={{ color: t.textMuted }}>
          rsvp to me
        </p>
      </div>
    </div>
  );
}
