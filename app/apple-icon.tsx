import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    <div
      style={{
        width: 180,
        height: 180,
        background: "#09090b",
        borderRadius: 40,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 110,
        fontWeight: 800,
        color: "#a855f7",
        fontFamily: "system-ui",
      }}
    >
      R
    </div>,
    { ...size }
  );
}
