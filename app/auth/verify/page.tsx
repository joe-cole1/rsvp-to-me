import { redirect } from "next/navigation";
import { verifyMagicToken } from "@/lib/auth";

export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  if (!token) {
    redirect("/auth/sign-in");
  }

  const ok = await verifyMagicToken(token);

  if (!ok) {
    return (
      <div style={{ minHeight: "100vh", background: "linear-gradient(135deg, #0a0a0f 0%, #13091f 40%, #0d1117 100%)", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
        <div style={{ textAlign: "center", maxWidth: "360px" }}>
          <div style={{ fontSize: "48px", marginBottom: "16px" }}>🔗</div>
          <h1 style={{ color: "#fff", fontSize: "22px", fontWeight: 700, marginBottom: "10px" }}>Link expired or invalid</h1>
          <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "14px", lineHeight: 1.6, marginBottom: "24px" }}>
            Magic links expire after 15 minutes and can only be used once. Request a new one.
          </p>
          <a
            href="/auth/sign-in"
            style={{ display: "inline-block", padding: "12px 28px", background: "#a855f7", color: "#fff", borderRadius: "12px", textDecoration: "none", fontSize: "15px", fontWeight: 700 }}
          >
            Back to sign in
          </a>
        </div>
      </div>
    );
  }

  redirect("/dashboard");
}
