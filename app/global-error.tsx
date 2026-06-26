"use client";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          background: "#0a0a0f",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ textAlign: "center", padding: "32px", maxWidth: "400px" }}>
          <div style={{ fontSize: "48px", marginBottom: "16px" }}>⚠️</div>
          <h1 style={{ color: "#ffffff", fontSize: "22px", fontWeight: 800, marginBottom: "8px" }}>
            Something went wrong
          </h1>
          <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "14px", marginBottom: "24px" }}>
            An unexpected error occurred. Try reloading the page.
          </p>
          <button
            onClick={() => reset()}
            style={{
              background: "#a855f7",
              color: "#ffffff",
              border: "none",
              borderRadius: "14px",
              padding: "12px 24px",
              fontSize: "15px",
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            Reload
          </button>
        </div>
      </body>
    </html>
  );
}
