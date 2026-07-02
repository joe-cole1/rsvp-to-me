"use client";

import NextImage from "next/image";
import type { ResolvedTheme } from "@/lib/theme";

export function ShareQrModal({
  t,
  showShareQr,
  setShowShareQr,
  qrDataUrl,
  setQrDataUrl,
}: {
  t: ResolvedTheme;
  showShareQr: boolean;
  setShowShareQr: React.Dispatch<React.SetStateAction<boolean>>;
  qrDataUrl: string | null;
  setQrDataUrl: React.Dispatch<React.SetStateAction<string | null>>;
}) {
  return (
    <>
      {/* ── Share QR Modal ── */}
      {showShareQr && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            background: "rgba(0, 0, 0, 0.6)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
          }}
        >
          <div
            style={{
              background: t.cardBg,
              border: `1px solid ${t.cardBorder}`,
              borderRadius: t.cardRadius,
              padding: "24px",
              width: "100%",
              maxWidth: "320px",
              backdropFilter: "blur(20px)",
              textAlign: "center",
              boxShadow: t.cardShadow || "0 10px 40px rgba(0,0,0,0.3)",
              color: t.textPrimary,
            }}
          >
            <h3
              style={{
                fontSize: "18px",
                fontWeight: 800,
                color: t.textPrimary,
                margin: "0 0 16px",
              }}
            >
              Event QR Code
            </h3>
            <div
              style={{
                background: "#fff",
                padding: "16px",
                borderRadius: "16px",
                display: "inline-block",
                marginBottom: "16px",
              }}
            >
              {qrDataUrl ? (
                <NextImage
                  src={qrDataUrl}
                  alt="Event QR Code"
                  width={200}
                  height={200}
                  unoptimized
                  style={{ display: "block" }}
                />
              ) : (
                <div
                  style={{
                    width: 200,
                    height: 200,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#1c1917",
                    fontSize: "13px",
                    fontWeight: 600,
                  }}
                >
                  Generating QR…
                </div>
              )}
            </div>
            <button
              onClick={() => {
                setShowShareQr(false);
                setQrDataUrl(null);
              }}
              style={{
                width: "100%",
                padding: "12px",
                background: t.accent,
                color: t.accentFg,
                border: "none",
                borderRadius: t.btnRadius,
                cursor: "pointer",
                fontFamily: "inherit",
                fontWeight: 700,
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}
