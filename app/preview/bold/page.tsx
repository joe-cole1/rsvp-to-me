"use client";

import { resolveTheme } from "@/lib/theme";

export default function BoldPreview() {
  const accent = "#f97316"; // orange
  const secondary = "#0ea5e9"; // sky
  const t = resolveTheme("BOLD", accent, secondary, accent);

  return (
    <div
      className="min-h-screen relative overflow-hidden"
      style={{ background: t.pageBg, color: t.textPrimary }}
    >
      {/* Bold top color strip */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: "340px",
          background: `linear-gradient(135deg, ${t.gradientFrom} 0%, ${t.gradientTo} 100%)`,
          zIndex: 0,
        }}
      />

      <div className="relative z-10 max-w-lg mx-auto px-4 pt-10 pb-12">
        {/* Cover card */}
        <div
          className="w-full rounded-3xl mb-0 flex items-center justify-center overflow-hidden"
          style={{
            height: "240px",
            background: "rgba(0,0,0,0.15)",
            backdropFilter: "blur(4px)",
            border: "1px solid rgba(255,255,255,0.2)",
          }}
        >
          <span style={{ fontSize: "90px" }}>🍷</span>
        </div>

        {/* Overlapping card */}
        <div
          className="rounded-3xl p-6 -mt-6 relative z-10"
          style={{
            background: "rgba(255, 255, 255, 0.95)",
            backdropFilter: "blur(8px)",
            borderTop: "none",
            borderTopLeftRadius: t.cardRadius,
            borderTopRightRadius: t.cardRadius,
            boxShadow: t.cardShadow,
          }}
        >
          {/* Date badges */}
          <div className="flex items-center gap-2 mb-3">
            <span
              className="text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full"
              style={{ background: t.badgeBg, color: t.badgeText, border: `1px solid ${t.accentBorder}` }}
            >
              Friday, June 27
            </span>
            <span
              className="text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full"
              style={{ background: t.badgeBg, color: t.badgeText, border: `1px solid ${t.accentBorder}` }}
            >
              8:00 PM
            </span>
          </div>

          {/* Title */}
          <h1 className="text-4xl font-black mb-2" style={{ letterSpacing: "-0.03em", fontFamily: t.headingFont }}>
            Wine Night ✨
          </h1>

          {/* Host */}
          <div className="flex items-center gap-2 mb-5">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-black"
              style={{ background: t.avatarGradient, color: t.accentFg }}
            >
              J
            </div>
            <span style={{ color: t.textSecondary }}>Hosted by Joe</span>
          </div>

          {/* Location row */}
          <div
            className="flex items-center gap-3 p-4 rounded-2xl mb-5"
            style={{ background: t.inputBg, border: `1px solid ${t.inputBorder}` }}
          >
            <span style={{ fontSize: "20px" }}>📍</span>
            <div>
              <div className="font-bold text-sm">Joe&apos;s Place</div>
              <div style={{ color: t.textMuted, fontSize: "13px" }}>123 Main St, Brooklyn, NY</div>
            </div>
          </div>

          {/* Description */}
          <p className="mb-5 leading-relaxed text-sm" style={{ color: t.textSecondary }}>
            Monthly wine night at my place! Bring a bottle you love and be ready to share what
            you enjoy about it. I&apos;ll have snacks and plenty of glasses. This month&apos;s theme is
            anything from Burgundy. 🍇
          </p>

          {/* RSVP section */}
          <div
            className="rounded-2xl p-5 mb-5"
            style={{ background: t.inputBg, border: `1px solid ${t.inputBorder}` }}
          >
            <h2 className="text-base font-black mb-4 uppercase tracking-wide">
              Are you coming?
            </h2>
            <div className="flex gap-2 mb-4">
              {[
                { label: "Going", emoji: "🎉", active: true },
                { label: "Maybe", emoji: "🤔", active: false },
                { label: "Can&apos;t", emoji: "😔", active: false },
              ].map((opt) => (
                <button
                  key={opt.label}
                  className="flex-1 py-3 rounded-xl text-xs font-black uppercase transition-all"
                  style={
                    opt.active
                      ? { background: t.accent, color: t.accentFg }
                      : { background: t.cardBorder, color: t.textSecondary }
                  }
                >
                  <div style={{ fontSize: "18px", marginBottom: "2px" }}>{opt.emoji}</div>
                  {opt.label}
                </button>
              ))}
            </div>
            <div className="space-y-2">
              <input
                className="w-full px-4 py-3 rounded-xl text-sm outline-none font-medium"
                placeholder="Your name"
                style={{
                  background: t.cardBg,
                  border: `2px solid ${t.inputBorder}`,
                  color: t.inputText,
                }}
              />
              <input
                className="w-full px-4 py-3 rounded-xl text-sm outline-none font-medium"
                placeholder="Email (optional)"
                style={{
                  background: t.cardBg,
                  border: `2px solid ${t.inputBorder}`,
                  color: t.inputText,
                }}
              />
              <button
                className="w-full py-3.5 rounded-xl font-black text-sm uppercase tracking-wide"
                style={{ background: t.accent, color: t.accentFg, textTransform: t.btnTransform as "none" | "capitalize" | "uppercase" | "lowercase" }}
              >
                Send RSVP →
              </button>
            </div>
          </div>

          {/* Guest list */}
          <div className="mb-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-black text-sm uppercase tracking-wide">Going (8)</h3>
              <span style={{ color: t.textMuted, fontSize: "12px", fontWeight: 600 }}>3 maybe</span>
            </div>
            <div className="flex gap-2 flex-wrap">
              {["Sarah", "Mike", "Emma", "James", "Priya", "Tom", "Leila", "Raj"].map((name) => (
                <div
                  key={name}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-bold"
                  style={{ background: t.pillBg, color: t.accent, border: `1px solid ${t.pillBorder}` }}
                >
                  {name}
                </div>
              ))}
            </div>
          </div>

          {/* Comments */}
          <div>
            <h3 className="font-black text-sm uppercase tracking-wide mb-3">Hype 💬</h3>
            <div className="space-y-2 mb-3">
              {[
                { name: "Sarah", msg: "Cannot wait!! Bringing a Pinot 🍷", time: "2h ago" },
                { name: "Mike", msg: "YES. Bringing something from Burgundy!", time: "1h ago" },
              ].map((c) => (
                <div
                  key={c.name}
                  className="flex gap-2.5 p-3 rounded-xl"
                  style={{ background: t.inputBg, border: `1px solid ${t.inputBorder}` }}
                >
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-black"
                    style={{ background: t.avatarGradient, color: t.accentFg }}
                  >
                    {c.name[0]}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-black text-sm">{c.name}</span>
                      <span style={{ color: t.textMuted, fontSize: "11px" }}>{c.time}</span>
                    </div>
                    <p style={{ color: t.textSecondary, fontSize: "13px" }}>{c.msg}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                className="flex-1 px-3 py-2 rounded-xl text-sm outline-none font-medium"
                placeholder="Say something..."
                style={{ background: t.inputBg, border: `2px solid ${t.inputBorder}`, color: t.inputText }}
              />
              <button
                className="px-4 py-2 rounded-xl text-sm font-black"
                style={{ background: t.accent, color: t.accentFg }}
              >
                Post
              </button>
            </div>
          </div>
        </div>

        <p className="text-center mt-8 text-xs" style={{ color: t.textMuted }}>
          rsvp to me
        </p>
      </div>
    </div>
  );
}
