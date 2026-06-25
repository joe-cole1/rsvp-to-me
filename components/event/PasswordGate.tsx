"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { verifyEventPassword } from "@/app/actions/event";

export function PasswordGate({ slug }: { slug: string }) {
  const [pw, setPw] = useState("");
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pw.trim() || loading) return;
    setError(false);
    setLoading(true);
    try {
      const res = await verifyEventPassword(slug, pw.trim());
      if (res.success) {
        router.refresh();
      } else {
        setError(true);
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0a0a0f",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        fontFamily: "inherit",
      }}
    >
      <div
        style={{
          background: "rgba(255,255,255,0.05)",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: "20px",
          padding: "32px 28px",
          width: "100%",
          maxWidth: "360px",
          color: "#fff",
        }}
      >
        <div style={{ fontSize: "32px", textAlign: "center", marginBottom: "16px" }}>🔒</div>
        <h1 style={{ fontSize: "20px", fontWeight: 700, textAlign: "center", marginBottom: "8px" }}>
          Private Event
        </h1>
        <p
          style={{
            color: "rgba(255,255,255,0.5)",
            fontSize: "14px",
            textAlign: "center",
            marginBottom: "24px",
          }}
        >
          Enter the password to view this event.
        </p>
        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <input
            type="text"
            placeholder="Event password"
            value={pw}
            onChange={(e) => {
              setPw(e.target.value);
              setError(false);
            }}
            autoFocus
            disabled={loading}
            style={{
              padding: "12px 16px",
              borderRadius: "12px",
              background: "rgba(255,255,255,0.07)",
              border: `1px solid ${error ? "#f87171" : "rgba(255,255,255,0.12)"}`,
              color: "#fff",
              fontFamily: "inherit",
              fontSize: "15px",
              outline: "none",
            }}
          />
          {error && <div style={{ color: "#f87171", fontSize: "13px" }}>Incorrect password</div>}
          <button
            type="submit"
            disabled={!pw.trim() || loading}
            style={{
              padding: "13px",
              background: "#a855f7",
              color: "#fff",
              border: "none",
              borderRadius: "12px",
              cursor: "pointer",
              fontFamily: "inherit",
              fontSize: "15px",
              fontWeight: 700,
            }}
          >
            {loading ? "Verifying..." : "Enter Event"}
          </button>
        </form>
      </div>
    </div>
  );
}
