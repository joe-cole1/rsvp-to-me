export default function SoftPreview() {
  return (
    <div
      className="min-h-screen relative overflow-hidden"
      style={{ background: "#faf7f5", color: "#1c1917" }}
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
            background: "radial-gradient(circle, rgba(251,207,232,0.6) 0%, transparent 70%)",
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
            background: "radial-gradient(circle, rgba(196,181,253,0.4) 0%, transparent 70%)",
            filter: "blur(60px)",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: "40%",
            right: "20%",
            width: "300px",
            height: "300px",
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(254,215,170,0.4) 0%, transparent 70%)",
            filter: "blur(50px)",
          }}
        />
      </div>

      <div className="relative z-10 max-w-lg mx-auto px-4 py-12">
        {/* Cover */}
        <div
          className="w-full rounded-3xl mb-8 flex items-center justify-center overflow-hidden"
          style={{
            height: "260px",
            background: "linear-gradient(135deg, #fbcfe8 0%, #e9d5ff 50%, #fde68a 100%)",
            boxShadow: "0 20px 60px rgba(0,0,0,0.08)",
          }}
        >
          <span style={{ fontSize: "80px", filter: "drop-shadow(0 4px 12px rgba(0,0,0,0.15))" }}>🍷</span>
        </div>

        {/* Date */}
        <div className="flex items-center gap-2 mb-3">
          <span
            className="text-xs font-semibold uppercase tracking-widest px-3 py-1 rounded-full"
            style={{ background: "rgba(0,0,0,0.06)", color: "#78716c" }}
          >
            Friday, June 27
          </span>
          <span
            className="text-xs font-semibold uppercase tracking-widest px-3 py-1 rounded-full"
            style={{ background: "rgba(0,0,0,0.06)", color: "#78716c" }}
          >
            8:00 PM
          </span>
        </div>

        {/* Title */}
        <h1
          className="text-4xl font-bold mb-2"
          style={{
            letterSpacing: "-0.02em",
            fontFamily: "Georgia, serif",
          }}
        >
          Wine Night ✨
        </h1>

        {/* Host */}
        <div className="flex items-center gap-2 mb-6">
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white"
            style={{ background: "linear-gradient(135deg, #f9a8d4, #c4b5fd)" }}
          >
            J
          </div>
          <span style={{ color: "#78716c" }}>Hosted by Joe</span>
        </div>

        {/* Location */}
        <div
          className="flex items-start gap-3 mb-8 p-4 rounded-2xl"
          style={{
            background: "rgba(255,255,255,0.7)",
            border: "1px solid rgba(0,0,0,0.06)",
            backdropFilter: "blur(12px)",
            boxShadow: "0 2px 16px rgba(0,0,0,0.04)",
          }}
        >
          <span style={{ fontSize: "18px" }}>📍</span>
          <div>
            <div className="font-medium">Joe&apos;s Place</div>
            <div style={{ color: "#a8a29e", fontSize: "14px" }}>123 Main St, Brooklyn, NY</div>
          </div>
        </div>

        {/* Description */}
        <p className="mb-8 leading-relaxed" style={{ color: "#57534e" }}>
          Monthly wine night at my place! Bring a bottle you love and be ready to share what you
          enjoy about it. I&apos;ll have snacks and plenty of glasses. This month&apos;s theme is anything
          from Burgundy. 🍇
        </p>

        {/* RSVP Card */}
        <div
          className="rounded-3xl p-6 mb-6"
          style={{
            background: "rgba(255,255,255,0.8)",
            border: "1px solid rgba(0,0,0,0.06)",
            backdropFilter: "blur(16px)",
            boxShadow: "0 4px 32px rgba(0,0,0,0.06)",
          }}
        >
          <h2 className="text-lg font-semibold mb-4" style={{ fontFamily: "Georgia, serif" }}>
            Are you coming?
          </h2>
          <div className="flex gap-3 mb-5">
            {[
              { label: "Going", emoji: "🎉", active: true },
              { label: "Maybe", emoji: "🤔", active: false },
              { label: "Can't go", emoji: "😔", active: false },
            ].map((opt) => (
              <button
                key={opt.label}
                className="flex-1 py-3 rounded-2xl text-sm font-semibold transition-all"
                style={
                  opt.active
                    ? {
                        background: "linear-gradient(135deg, #f9a8d4, #c4b5fd)",
                        color: "#1c1917",
                        boxShadow: "0 4px 20px rgba(249,168,212,0.4)",
                      }
                    : {
                        background: "rgba(0,0,0,0.04)",
                        color: "#78716c",
                        border: "1px solid rgba(0,0,0,0.06)",
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
              className="w-full px-4 py-3 rounded-2xl text-sm outline-none"
              placeholder="Your name"
              style={{
                background: "rgba(0,0,0,0.04)",
                border: "1px solid rgba(0,0,0,0.08)",
                color: "#1c1917",
              }}
            />
            <input
              className="w-full px-4 py-3 rounded-2xl text-sm outline-none"
              placeholder="Email (optional)"
              style={{
                background: "rgba(0,0,0,0.04)",
                border: "1px solid rgba(0,0,0,0.08)",
                color: "#1c1917",
              }}
            />
            <button
              className="w-full py-3 rounded-2xl font-semibold text-sm"
              style={{
                background: "linear-gradient(135deg, #f9a8d4, #c4b5fd)",
                color: "#1c1917",
                boxShadow: "0 4px 20px rgba(249,168,212,0.35)",
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
            background: "rgba(255,255,255,0.7)",
            border: "1px solid rgba(0,0,0,0.06)",
            backdropFilter: "blur(12px)",
          }}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Going (8)</h3>
            <span style={{ color: "#a8a29e", fontSize: "13px" }}>3 maybe</span>
          </div>
          <div className="flex gap-2 flex-wrap">
            {["Sarah", "Mike", "Emma", "James", "Priya", "Tom", "Leila", "Raj"].map((name, i) => {
              const colors = [
                "rgba(249,168,212,0.4)",
                "rgba(196,181,253,0.4)",
                "rgba(253,186,116,0.4)",
                "rgba(134,239,172,0.4)",
              ];
              return (
                <div
                  key={name}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-full text-sm"
                  style={{
                    background: colors[i % colors.length],
                    border: "1px solid rgba(0,0,0,0.06)",
                  }}
                >
                  <div
                    className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold"
                    style={{ background: "rgba(0,0,0,0.1)" }}
                  >
                    {name[0]}
                  </div>
                  {name}
                </div>
              );
            })}
          </div>
        </div>

        {/* Comments */}
        <div
          className="rounded-3xl p-5"
          style={{
            background: "rgba(255,255,255,0.7)",
            border: "1px solid rgba(0,0,0,0.06)",
            backdropFilter: "blur(12px)",
          }}
        >
          <h3 className="font-semibold mb-4">Notes 💬</h3>
          <div className="space-y-3 mb-4">
            {[
              { name: "Sarah", msg: "Cannot wait!! Bringing a Pinot I've been saving 🍷", time: "2h ago" },
              { name: "Mike", msg: "YES. Bringing something from Burgundy!", time: "1h ago" },
            ].map((c, i) => (
              <div key={c.name} className="flex gap-3">
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                  style={{
                    background: i === 0 ? "rgba(249,168,212,0.5)" : "rgba(196,181,253,0.5)",
                  }}
                >
                  {c.name[0]}
                </div>
                <div
                  className="flex-1 px-3 py-2 rounded-2xl text-sm"
                  style={{ background: "rgba(0,0,0,0.03)", border: "1px solid rgba(0,0,0,0.05)" }}
                >
                  <span className="font-medium">{c.name}</span>
                  <span style={{ color: "#a8a29e", fontSize: "11px", marginLeft: "8px" }}>{c.time}</span>
                  <p style={{ color: "#57534e", marginTop: "2px" }}>{c.msg}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              className="flex-1 px-3 py-2 rounded-2xl text-sm outline-none"
              placeholder="Say something..."
              style={{
                background: "rgba(0,0,0,0.04)",
                border: "1px solid rgba(0,0,0,0.08)",
                color: "#1c1917",
              }}
            />
            <button
              className="px-4 py-2 rounded-2xl text-sm font-semibold"
              style={{
                background: "rgba(249,168,212,0.3)",
                color: "#be185d",
                border: "1px solid rgba(249,168,212,0.4)",
              }}
            >
              Post
            </button>
          </div>
        </div>

        <p className="text-center mt-8 text-xs" style={{ color: "#d6d3d1" }}>
          rsvp to me
        </p>
      </div>
    </div>
  );
}
