export default function DarkPreview() {
  return (
    <div
      className="min-h-screen text-white relative overflow-hidden"
      style={{
        background: "linear-gradient(135deg, #0a0a0f 0%, #13091f 40%, #0d1117 100%)",
      }}
    >
      {/* Animated glow orbs */}
      <div
        className="absolute inset-0 pointer-events-none"
        aria-hidden
      >
        <div
          style={{
            position: "absolute",
            top: "-20%",
            left: "30%",
            width: "600px",
            height: "600px",
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(168,85,247,0.18) 0%, transparent 70%)",
            filter: "blur(40px)",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: "10%",
            right: "-10%",
            width: "400px",
            height: "400px",
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 70%)",
            filter: "blur(40px)",
          }}
        />
      </div>

      {/* Content */}
      <div className="relative z-10 max-w-lg mx-auto px-4 py-12">
        {/* Cover image placeholder */}
        <div
          className="w-full rounded-2xl mb-8 flex items-center justify-center"
          style={{
            height: "260px",
            background:
              "linear-gradient(135deg, #7c3aed 0%, #a855f7 50%, #ec4899 100%)",
            boxShadow: "0 0 60px rgba(168,85,247,0.4)",
          }}
        >
          <span style={{ fontSize: "72px" }}>🍷</span>
        </div>

        {/* Date badge */}
        <div className="flex items-center gap-2 mb-3">
          <span
            className="text-xs font-semibold uppercase tracking-widest px-3 py-1 rounded-full"
            style={{
              background: "rgba(168,85,247,0.2)",
              color: "#c084fc",
              border: "1px solid rgba(168,85,247,0.3)",
            }}
          >
            Friday, June 27
          </span>
          <span
            className="text-xs font-semibold uppercase tracking-widest px-3 py-1 rounded-full"
            style={{
              background: "rgba(168,85,247,0.2)",
              color: "#c084fc",
              border: "1px solid rgba(168,85,247,0.3)",
            }}
          >
            8:00 PM
          </span>
        </div>

        {/* Title */}
        <h1 className="text-4xl font-bold mb-2" style={{ letterSpacing: "-0.02em" }}>
          Wine Night ✨
        </h1>

        {/* Host */}
        <div className="flex items-center gap-2 mb-6">
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
            style={{ background: "linear-gradient(135deg, #a855f7, #ec4899)" }}
          >
            J
          </div>
          <span style={{ color: "#a1a1aa" }}>Hosted by Joe</span>
        </div>

        {/* Location */}
        <div
          className="flex items-start gap-3 mb-8 p-4 rounded-xl"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
        >
          <span style={{ color: "#a855f7", fontSize: "18px" }}>📍</span>
          <div>
            <div className="font-medium">Joe's Place</div>
            <div style={{ color: "#71717a", fontSize: "14px" }}>123 Main St, Brooklyn, NY</div>
          </div>
        </div>

        {/* Description */}
        <p className="mb-8 leading-relaxed" style={{ color: "#a1a1aa" }}>
          Monthly wine night at my place! Bring a bottle you love and be ready to share what
          you enjoy about it. I'll have snacks and plenty of glasses. This month's theme is
          anything from Burgundy. 🍇
        </p>

        {/* RSVP Card */}
        <div
          className="rounded-2xl p-6 mb-6"
          style={{
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(168,85,247,0.2)",
            backdropFilter: "blur(12px)",
          }}
        >
          <h2 className="text-lg font-semibold mb-4">Are you coming?</h2>
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
                        background: "linear-gradient(135deg, #7c3aed, #a855f7)",
                        color: "#fff",
                        boxShadow: "0 0 20px rgba(168,85,247,0.4)",
                      }
                    : {
                        background: "rgba(255,255,255,0.06)",
                        color: "#a1a1aa",
                        border: "1px solid rgba(255,255,255,0.08)",
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
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "#fff",
              }}
            />
            <input
              className="w-full px-4 py-3 rounded-xl text-sm outline-none"
              placeholder="Email (optional — for updates)"
              style={{
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "#fff",
              }}
            />
            <button
              className="w-full py-3 rounded-xl font-semibold text-sm"
              style={{
                background: "linear-gradient(135deg, #7c3aed, #a855f7)",
                color: "#fff",
                boxShadow: "0 0 24px rgba(168,85,247,0.35)",
              }}
            >
              Send RSVP
            </button>
          </div>
        </div>

        {/* Guest list */}
        <div
          className="rounded-2xl p-5 mb-6"
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Going (8)</h3>
            <span style={{ color: "#71717a", fontSize: "13px" }}>3 maybe</span>
          </div>
          <div className="flex gap-2 flex-wrap">
            {["Sarah", "Mike", "Emma", "James", "Priya", "Tom", "Leila", "Raj"].map((name) => (
              <div
                key={name}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full text-sm"
                style={{
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
              >
                <div
                  className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold"
                  style={{ background: "linear-gradient(135deg, #a855f7, #ec4899)" }}
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
          className="rounded-2xl p-5"
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
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
                  style={{ background: "linear-gradient(135deg, #6366f1, #a855f7)" }}
                >
                  {c.name[0]}
                </div>
                <div
                  className="flex-1 px-3 py-2 rounded-xl text-sm"
                  style={{ background: "rgba(255,255,255,0.05)" }}
                >
                  <span className="font-medium">{c.name}</span>
                  <span style={{ color: "#71717a", fontSize: "11px", marginLeft: "8px" }}>{c.time}</span>
                  <p style={{ color: "#d4d4d8", marginTop: "2px" }}>{c.msg}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              className="flex-1 px-3 py-2 rounded-xl text-sm outline-none"
              placeholder="Say something..."
              style={{
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "#fff",
              }}
            />
            <button
              className="px-4 py-2 rounded-xl text-sm font-semibold"
              style={{ background: "rgba(168,85,247,0.3)", color: "#c084fc" }}
            >
              Post
            </button>
          </div>
        </div>

        <p className="text-center mt-8 text-xs" style={{ color: "#3f3f46" }}>
          rsvp to me
        </p>
      </div>
    </div>
  );
}
