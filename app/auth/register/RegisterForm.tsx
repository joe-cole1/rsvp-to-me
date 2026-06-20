"use client";

import { useState } from "react";
import { registerHostAction } from "@/app/actions/auth";
import { AppShell } from "@/components/ui/AppShell";
import { APP_SHELL } from "@/lib/theme";

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px 14px",
  background: APP_SHELL.inputBg,
  border: `1px solid ${APP_SHELL.inputBorder}`,
  borderRadius: APP_SHELL.inputRadius,
  color: APP_SHELL.textPrimary,
  fontSize: "15px",
  outline: "none",
  boxSizing: "border-box",
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: "16px" }}>
      <label style={{ display: "block", fontSize: "12px", fontWeight: 700, textTransform: "none", letterSpacing: "0.02em", color: APP_SHELL.textMuted, marginBottom: "8px" }}>
        {label}
      </label>
      {children}
    </div>
  );
}

export default function RegisterForm({ openRegistration }: { openRegistration: boolean }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const result = await registerHostAction(email, name, openRegistration ? "" : code);
    setLoading(false);
    if (result.success) {
      setSubmitted(true);
    } else {
      setError(result.error ?? "Something went wrong.");
    }
  };

  return (
    <AppShell center>
      <div style={{ width: "100%", maxWidth: "400px" }}>
        <div style={{ textAlign: "center", marginBottom: "40px" }}>
          <div style={{ fontSize: "36px", marginBottom: "12px" }}>🎉</div>
          <h1 style={{ color: APP_SHELL.textPrimary, fontSize: "28px", fontWeight: 800, marginBottom: "8px" }}>RSVP</h1>
          <p style={{ color: APP_SHELL.textSecondary, fontSize: "15px" }}>Create an account</p>
        </div>

        <div style={{ background: APP_SHELL.cardBg, border: `1px solid ${APP_SHELL.cardBorder}`, borderRadius: APP_SHELL.authCardRadius, padding: "32px" }}>
          {submitted ? (
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: "48px", marginBottom: "16px" }}>🎊</div>
              <h2 style={{ color: APP_SHELL.textPrimary, fontSize: "20px", fontWeight: 700, marginBottom: "8px" }}>Account created!</h2>
              <p style={{ color: APP_SHELL.textSecondary, fontSize: "14px", lineHeight: 1.6, marginBottom: "24px" }}>
                Check your email for a magic link to sign in.
              </p>
              <a
                href="/auth/sign-in"
                style={{ display: "inline-block", padding: "10px 24px", background: APP_SHELL.accent, color: APP_SHELL.textPrimary, borderRadius: APP_SHELL.btnRadius, textDecoration: "none", fontSize: "14px", fontWeight: 700 }}
              >
                Go to sign in
              </a>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <Field label="Your name">
                <input type="text" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Smith" style={inputStyle} />
              </Field>
              <Field label="Email address">
                <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" style={inputStyle} />
              </Field>
              {!openRegistration && (
                <Field label="Invite code">
                  <input type="text" required value={code} onChange={(e) => setCode(e.target.value)} placeholder="Enter your invite code" style={inputStyle} />
                </Field>
              )}

              {error && (
                <div style={{ background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: "10px", padding: "10px 14px", marginBottom: "16px", color: "#fca5a5", fontSize: "13px" }}>
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                style={{ width: "100%", padding: "13px", background: APP_SHELL.accent, color: APP_SHELL.textPrimary, border: "none", borderRadius: APP_SHELL.btnRadius, fontSize: "15px", fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1, fontFamily: "inherit" }}
              >
                {loading ? "Creating account…" : "Create account"}
              </button>

              <div style={{ textAlign: "center", marginTop: "20px" }}>
                <a href="/auth/sign-in" style={{ color: APP_SHELL.textMuted, fontSize: "13px", textDecoration: "none" }}>
                  Already have an account? <span style={{ color: APP_SHELL.accent }}>Sign in →</span>
                </a>
              </div>
            </form>
          )}
        </div>
      </div>
    </AppShell>
  );
}
