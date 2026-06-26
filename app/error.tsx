"use client";

import Link from "next/link";

export default function RootError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "32px",
      }}
    >
      <div
        style={{
          textAlign: "center",
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: "24px",
          padding: "40px 32px",
          maxWidth: "400px",
          width: "100%",
        }}
      >
        <div style={{ fontSize: "48px", marginBottom: "16px" }}>⚠️</div>
        <h2
          style={{
            color: "#ffffff",
            fontSize: "20px",
            fontWeight: 800,
            marginBottom: "8px",
            margin: "0 0 8px",
          }}
        >
          Something went wrong
        </h2>
        <p
          style={{
            color: "rgba(255,255,255,0.5)",
            fontSize: "14px",
            lineHeight: 1.6,
            marginBottom: "24px",
          }}
        >
          An unexpected error occurred on this page.
        </p>
        <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
          <button
            onClick={() => reset()}
            style={{
              background: "#a855f7",
              color: "#ffffff",
              border: "none",
              borderRadius: "14px",
              padding: "11px 22px",
              fontSize: "14px",
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            Try again
          </button>
          <Link
            href="/"
            style={{
              background: "transparent",
              color: "rgba(255,255,255,0.5)",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: "14px",
              padding: "11px 22px",
              fontSize: "14px",
              fontWeight: 600,
              textDecoration: "none",
              display: "inline-block",
            }}
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}
