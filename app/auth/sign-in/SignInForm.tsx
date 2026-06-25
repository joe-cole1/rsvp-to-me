"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { sendMagicLinkAction } from "@/app/actions/auth";
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

function looksLikePhone(s: string): boolean {
  return /^\+?[\d\s\-().]{7,}$/.test(s.trim()) && s.replace(/\D/g, "").length >= 7;
}

function TokenError() {
  const searchParams = useSearchParams();
  if (searchParams.get("error") !== "invalid-token") return null;
  return (
    <div
      style={{
        background: "rgba(239,68,68,0.15)",
        border: "1px solid rgba(239,68,68,0.3)",
        borderRadius: "10px",
        padding: "10px 14px",
        marginBottom: "20px",
        color: "#fca5a5",
        fontSize: "13px",
      }}
    >
      That link has expired or already been used. Request a new one below.
    </div>
  );
}

export default function SignInForm({
  openRegistration,
  redirect,
}: {
  openRegistration: boolean;
  redirect?: string;
}) {
  const [identifier, setIdentifier] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isPhone = looksLikePhone(identifier);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotFound(false);
    setLoading(true);
    const result = await sendMagicLinkAction(identifier, redirect);
    setLoading(false);
    if (result.error === "email_not_found") {
      setNotFound(true);
    } else if (result.success) {
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
          <h1
            style={{
              color: APP_SHELL.textPrimary,
              fontSize: "28px",
              fontWeight: 800,
              marginBottom: "8px",
            }}
          >
            RSVP
          </h1>
          <p style={{ color: APP_SHELL.textSecondary, fontSize: "15px" }}>
            Sign in with a magic link
          </p>
        </div>

        <div
          style={{
            background: APP_SHELL.cardBg,
            border: `1px solid ${APP_SHELL.cardBorder}`,
            borderRadius: APP_SHELL.authCardRadius,
            padding: "32px",
          }}
        >
          <Suspense>
            <TokenError />
          </Suspense>
          {submitted ? (
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: "48px", marginBottom: "16px" }}>{isPhone ? "📱" : "📬"}</div>
              <h2
                style={{
                  color: APP_SHELL.textPrimary,
                  fontSize: "20px",
                  fontWeight: 700,
                  marginBottom: "8px",
                }}
              >
                {isPhone ? "Check your texts" : "Check your email"}
              </h2>
              <p style={{ color: APP_SHELL.textSecondary, fontSize: "14px", lineHeight: 1.6 }}>
                We sent a magic link to{" "}
                <strong style={{ color: "rgba(255,255,255,0.8)" }}>{identifier}</strong>. Click it
                to sign in — it expires in 15 minutes.
              </p>
            </div>
          ) : notFound ? (
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: "48px", marginBottom: "16px" }}>📭</div>
              <h2
                style={{
                  color: APP_SHELL.textPrimary,
                  fontSize: "20px",
                  fontWeight: 700,
                  marginBottom: "8px",
                }}
              >
                Email not found
              </h2>
              <p
                style={{
                  color: APP_SHELL.textSecondary,
                  fontSize: "14px",
                  lineHeight: 1.6,
                  marginBottom: "20px",
                }}
              >
                <strong style={{ color: "rgba(255,255,255,0.8)" }}>{identifier}</strong> isn&apos;t
                linked to an account. If you expect to have access, contact the host to request an
                invitation.
              </p>
              <button
                onClick={() => {
                  setNotFound(false);
                  setIdentifier("");
                }}
                style={{
                  background: "transparent",
                  border: `1px solid ${APP_SHELL.inputBorder}`,
                  borderRadius: APP_SHELL.btnRadius,
                  color: APP_SHELL.textSecondary,
                  cursor: "pointer",
                  fontSize: "14px",
                  fontWeight: 600,
                  padding: "10px 20px",
                  fontFamily: "inherit",
                }}
              >
                Try a different email
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: "20px" }}>
                <label
                  style={{
                    display: "block",
                    fontSize: "12px",
                    fontWeight: 700,
                    textTransform: "none",
                    letterSpacing: "0.02em",
                    color: APP_SHELL.textMuted,
                    marginBottom: "8px",
                  }}
                >
                  Email or phone number
                </label>
                <input
                  type="text"
                  required
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="you@example.com or +1 555 000 0000"
                  style={inputStyle}
                />
              </div>

              {error && (
                <div
                  style={{
                    background: "rgba(239,68,68,0.15)",
                    border: "1px solid rgba(239,68,68,0.3)",
                    borderRadius: "10px",
                    padding: "10px 14px",
                    marginBottom: "16px",
                    color: "#fca5a5",
                    fontSize: "13px",
                  }}
                >
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                style={{
                  width: "100%",
                  padding: "13px",
                  background: APP_SHELL.accent,
                  color: APP_SHELL.textPrimary,
                  border: "none",
                  borderRadius: APP_SHELL.btnRadius,
                  fontSize: "15px",
                  fontWeight: 700,
                  cursor: loading ? "not-allowed" : "pointer",
                  opacity: loading ? 0.7 : 1,
                  fontFamily: "inherit",
                }}
              >
                {loading ? "Sending…" : "Send magic link"}
              </button>

              <div style={{ textAlign: "center", marginTop: "20px" }}>
                <a
                  href="/auth/register"
                  style={{ color: APP_SHELL.textMuted, fontSize: "13px", textDecoration: "none" }}
                >
                  {openRegistration ? "No account? " : "New host? "}
                  <span style={{ color: APP_SHELL.accent }}>Create one →</span>
                </a>
              </div>
            </form>
          )}
        </div>
      </div>
    </AppShell>
  );
}
