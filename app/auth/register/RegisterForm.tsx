"use client";

import { useState } from "react";
import { registerHostAction } from "@/app/actions/auth";
import { AppShell } from "@/components/ui/AppShell";
import { APP_SHELL } from "@/lib/theme";
import {
  AppButton,
  AppCard,
  AppInput,
  FormField,
  InlineAlert,
} from "@/components/ui/AppPrimitives";

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
          <p style={{ color: APP_SHELL.textSecondary, fontSize: "15px" }}>Create an account</p>
        </div>

        <AppCard style={{ borderRadius: APP_SHELL.authCardRadius, padding: "32px" }}>
          {submitted ? (
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: "48px", marginBottom: "16px" }}>🎊</div>
              <h2
                style={{
                  color: APP_SHELL.textPrimary,
                  fontSize: "20px",
                  fontWeight: 700,
                  marginBottom: "8px",
                }}
              >
                Account created!
              </h2>
              <p
                style={{
                  color: APP_SHELL.textSecondary,
                  fontSize: "14px",
                  lineHeight: 1.6,
                  marginBottom: "24px",
                }}
              >
                Check your email for a magic link to sign in.
              </p>
              <a
                href="/auth/sign-in"
                style={{
                  display: "inline-block",
                  padding: "10px 24px",
                  background: APP_SHELL.accent,
                  color: APP_SHELL.textPrimary,
                  borderRadius: APP_SHELL.btnRadius,
                  textDecoration: "none",
                  fontSize: "14px",
                  fontWeight: 700,
                }}
              >
                Go to sign in
              </a>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <FormField label="Your name">
                <AppInput
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Jane Smith"
                  style={{ padding: "12px 14px", fontSize: "15px" }}
                />
              </FormField>
              <FormField label="Email address">
                <AppInput
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  style={{ padding: "12px 14px", fontSize: "15px" }}
                />
              </FormField>
              {!openRegistration && (
                <FormField label="Invite code">
                  <AppInput
                    type="text"
                    required
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="Enter your invite code"
                    style={{ padding: "12px 14px", fontSize: "15px" }}
                  />
                </FormField>
              )}

              {error && <InlineAlert>{error}</InlineAlert>}

              <AppButton
                type="submit"
                disabled={loading}
                style={{
                  width: "100%",
                  padding: "13px",
                  fontSize: "15px",
                }}
              >
                {loading ? "Creating account…" : "Create account"}
              </AppButton>

              <div style={{ textAlign: "center", marginTop: "20px" }}>
                <a
                  href="/auth/sign-in"
                  style={{ color: APP_SHELL.textMuted, fontSize: "13px", textDecoration: "none" }}
                >
                  Already have an account?{" "}
                  <span style={{ color: APP_SHELL.accent }}>Sign in →</span>
                </a>
              </div>
            </form>
          )}
        </AppCard>
      </div>
    </AppShell>
  );
}
