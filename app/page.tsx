import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";

export default async function Home() {
  const session = await getSession();
  if (session) redirect("/dashboard");

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg, #0a0a0f 0%, #13091f 40%, #0d1117 100%)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "20px", fontFamily: "inherit", color: "#fff" }}>
      <div style={{ textAlign: "center", maxWidth: "480px" }}>
        <div style={{ fontSize: "64px", marginBottom: "24px" }}>🎉</div>
        <h1 style={{ fontSize: "48px", fontWeight: 900, marginBottom: "12px", background: "linear-gradient(135deg, #a855f7, #ec4899)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
          rsvp.to
        </h1>
        <p style={{ fontSize: "18px", color: "rgba(255,255,255,0.6)", marginBottom: "40px", lineHeight: 1.6 }}>
          Beautiful, personal event pages for wine nights, dinner parties, and everything in between.
        </p>
        <div style={{ display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap" }}>
          <a href="/auth/sign-in" style={{ padding: "14px 32px", background: "#a855f7", color: "#fff", borderRadius: "14px", textDecoration: "none", fontSize: "16px", fontWeight: 700 }}>
            Sign in
          </a>
          <a href="/auth/register" style={{ padding: "14px 32px", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", color: "#fff", borderRadius: "14px", textDecoration: "none", fontSize: "16px", fontWeight: 700 }}>
            Create account
          </a>
        </div>
      </div>
    </div>
  );
}
