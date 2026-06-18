"use client";

import { useState, useRef, useTransition, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { updateProfileSettings, updateNotificationSettings } from "@/app/actions/profile";
import { APP_SHELL } from "@/lib/theme";
import { AppShell } from "@/components/ui/AppShell";
import { AppNavLogo } from "@/components/ui/AppNav";
import ProfileDropdown from "@/components/ui/ProfileDropdown";

interface ProfileData {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  avatarUrl: string | null;
  role: "GUEST" | "HOST" | "ADMIN";
  emailNotifications: boolean;
  smsNotifications: boolean;
}

function compressAvatar(file: File, maxW = 400, maxH = 400, quality = 0.85): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(maxW / img.width, maxH / img.height, 1);
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("Compression failed"));
            return;
          }
          resolve(new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg" }));
        },
        "image/jpeg",
        quality
      );
    };
    img.onerror = reject;
    img.src = url;
  });
}

export default function ProfileClient({ initialProfile }: { initialProfile: ProfileData }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [name, setName] = useState(initialProfile.name || "");
  const [email, setEmail] = useState(initialProfile.email || "");
  const [phone, setPhone] = useState(initialProfile.phone || "");
  const [avatarUrl, setAvatarUrl] = useState(initialProfile.avatarUrl || "");
  const [emailNotifications, setEmailNotifications] = useState(initialProfile.emailNotifications);
  const [smsNotifications, setSmsNotifications] = useState(initialProfile.smsNotifications);

  const [isPending, startTransition] = useTransition();
  const [isUploading, setIsUploading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [infoMessages, setInfoMessages] = useState<string[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle verification and error query params
  useEffect(() => {
    const verified = searchParams.get("verified");
    const error = searchParams.get("error");

    if (verified === "1") {
      setFeedback({ type: "success", message: "Contact details successfully verified and updated!" });
      // Clean query params
      router.replace("/profile");
    } else if (error === "invalid-token") {
      setFeedback({ type: "error", message: "The verification link was invalid, expired, or already used." });
      router.replace("/profile");
    } else if (error === "email-taken") {
      setFeedback({ type: "error", message: "That email address is already taken by another account." });
      router.replace("/profile");
    } else if (error === "phone-taken") {
      setFeedback({ type: "error", message: "That phone number is already taken by another account." });
      router.replace("/profile");
    }
  }, [searchParams, router]);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setFeedback(null);
    try {
      const compressed = await compressAvatar(file);
      const form = new FormData();
      form.append("file", compressed);

      const res = await fetch("/api/upload", { method: "POST", body: form });
      if (!res.ok) throw new Error(await res.text());

      const { url } = (await res.json()) as { url: string };
      setAvatarUrl(url);

      // Save avatarUrl immediately to profile
      await updateProfileSettings({
        name,
        avatarUrl: url,
        email: initialProfile.email || undefined,
        phone: initialProfile.phone || undefined,
      });

      setFeedback({ type: "success", message: "Avatar updated successfully!" });
    } catch (err: any) {
      console.error(err);
      setFeedback({ type: "error", message: err.message || "Failed to upload avatar." });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleProfileSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    setInfoMessages([]);

    startTransition(async () => {
      try {
        const result = await updateProfileSettings({
          name,
          avatarUrl,
          email: email.trim() || undefined,
          phone: phone.trim() || undefined,
        });

        if (result.success) {
          if (result.messages && result.messages.length > 0) {
            setInfoMessages(result.messages);
          } else {
            setFeedback({ type: "success", message: "Profile settings saved!" });
          }
        }
      } catch (err: any) {
        setFeedback({ type: "error", message: err.message || "Failed to update profile." });
      }
    });
  };

  const handleToggleNotifications = async (type: "email" | "sms") => {
    const nextEmail = type === "email" ? !emailNotifications : emailNotifications;
    const nextSms = type === "sms" ? !smsNotifications : smsNotifications;

    if (type === "email") setEmailNotifications(nextEmail);
    if (type === "sms") setSmsNotifications(nextSms);

    try {
      await updateNotificationSettings({
        emailNotifications: nextEmail,
        smsNotifications: nextSms,
      });
    } catch (err) {
      console.error("Failed to update notification toggles", err);
    }
  };

  const displayName = name || initialProfile.email?.split("@")[0] || "User";
  const initials = displayName.slice(0, 2).toUpperCase();

  return (
    <AppShell>
      <AppNavLogo
        href="/dashboard"
        trailing={
          <ProfileDropdown
            user={{
              name,
              email: initialProfile.email,
              role: initialProfile.role,
              avatarUrl,
            }}
          />
        }
      />

      <div
        style={{
          maxWidth: "600px",
          margin: "40px auto",
          padding: "0 20px",
          boxSizing: "border-box",
        }}
      >
        <h2 style={{ fontSize: "28px", fontWeight: 800, color: APP_SHELL.textPrimary, marginBottom: "8px" }}>
          Profile Settings
        </h2>
        <p style={{ color: APP_SHELL.textSecondary, marginBottom: "32px", fontSize: "14px" }}>
          Manage your account profile details, verification status, and notification preferences.
        </p>

        {/* Feedback Alert Banners */}
        {feedback && (
          <div
            style={{
              padding: "16px",
              borderRadius: APP_SHELL.inputRadius,
              backgroundColor: feedback.type === "success" ? "rgba(34, 197, 94, 0.1)" : "rgba(239, 68, 68, 0.1)",
              border: `1px solid ${feedback.type === "success" ? "rgba(34, 197, 94, 0.3)" : "rgba(239, 68, 68, 0.3)"}`,
              color: feedback.type === "success" ? "#4ade80" : "#f87171",
              fontSize: "14px",
              fontWeight: 600,
              marginBottom: "24px",
            }}
          >
            {feedback.message}
          </div>
        )}

        {infoMessages.map((msg, idx) => (
          <div
            key={idx}
            style={{
              padding: "16px",
              borderRadius: APP_SHELL.inputRadius,
              backgroundColor: "rgba(168, 85, 247, 0.1)",
              border: `1px solid rgba(168, 85, 247, 0.3)`,
              color: "#c084fc",
              fontSize: "14px",
              fontWeight: 600,
              marginBottom: "16px",
            }}
          >
            ℹ️ {msg}
          </div>
        ))}

        <form onSubmit={handleProfileSubmit} style={{ display: "flex", flexDirection: "column", gap: "32px" }}>
          {/* Section: Personal Info Card */}
          <div
            style={{
              backgroundColor: APP_SHELL.cardBg,
              border: `1px solid ${APP_SHELL.cardBorder}`,
              borderRadius: APP_SHELL.cardRadius,
              padding: "24px",
              display: "flex",
              flexDirection: "column",
              gap: "24px",
            }}
          >
            {/* Avatar Section */}
            <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
              <div style={{ position: "relative" }}>
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt="Avatar"
                    style={{
                      width: "80px",
                      height: "80px",
                      borderRadius: "50%",
                      objectFit: "cover",
                      border: `2px solid ${APP_SHELL.cardBorder}`,
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: "80px",
                      height: "80px",
                      borderRadius: "50%",
                      background: `linear-gradient(135deg, ${APP_SHELL.accent}, ${APP_SHELL.accentSecondary})`,
                      color: "#fff",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: 800,
                      fontSize: "28px",
                      border: `2px solid ${APP_SHELL.cardBorder}`,
                    }}
                  >
                    {initials}
                  </div>
                )}
                {isUploading && (
                  <div
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "80px",
                      height: "80px",
                      borderRadius: "50%",
                      backgroundColor: "rgba(0, 0, 0, 0.6)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#fff",
                      fontSize: "11px",
                      fontWeight: 700,
                    }}
                  >
                    ...
                  </div>
                )}
              </div>

              <div>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleAvatarUpload}
                  accept="image/*"
                  style={{ display: "none" }}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    backgroundColor: "rgba(255,255,255,0.06)",
                    border: `1px solid ${APP_SHELL.cardBorder}`,
                    color: APP_SHELL.textPrimary,
                    borderRadius: "10px",
                    padding: "8px 16px",
                    fontSize: "13px",
                    fontWeight: 600,
                    cursor: "pointer",
                    transition: "background 0.2s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.1)")}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.06)")}
                >
                  Change Photo
                </button>
                <div style={{ color: APP_SHELL.textMuted, fontSize: "11px", marginTop: "6px" }}>
                  Max 8MB. Compressed automatically.
                </div>
              </div>
            </div>

            {/* Inputs */}
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 700, color: APP_SHELL.textPrimary, marginBottom: "8px" }}>
                Full Name
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                style={{
                  width: "100%",
                  backgroundColor: APP_SHELL.inputBg,
                  border: `1px solid ${APP_SHELL.inputBorder}`,
                  borderRadius: APP_SHELL.inputRadius,
                  padding: "12px 16px",
                  color: APP_SHELL.textPrimary,
                  fontSize: "14px",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 700, color: APP_SHELL.textPrimary, marginBottom: "8px" }}>
                Email Address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{
                  width: "100%",
                  backgroundColor: APP_SHELL.inputBg,
                  border: `1px solid ${APP_SHELL.inputBorder}`,
                  borderRadius: APP_SHELL.inputRadius,
                  padding: "12px 16px",
                  color: APP_SHELL.textPrimary,
                  fontSize: "14px",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 700, color: APP_SHELL.textPrimary, marginBottom: "8px" }}>
                Phone Number
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+15555555555"
                style={{
                  width: "100%",
                  backgroundColor: APP_SHELL.inputBg,
                  border: `1px solid ${APP_SHELL.inputBorder}`,
                  borderRadius: APP_SHELL.inputRadius,
                  padding: "12px 16px",
                  color: APP_SHELL.textPrimary,
                  fontSize: "14px",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>
            
            <button
              type="submit"
              disabled={isPending}
              style={{
                backgroundColor: APP_SHELL.accent,
                border: "none",
                color: "#fff",
                borderRadius: APP_SHELL.btnRadius,
                padding: "14px",
                fontSize: "14px",
                fontWeight: 700,
                cursor: "pointer",
                transition: "opacity 0.2s, transform 0.1s",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                opacity: isPending ? 0.6 : 1,
              }}
              onMouseEnter={(e) => { if (!isPending) e.currentTarget.style.opacity = "0.9"; }}
              onMouseLeave={(e) => { if (!isPending) e.currentTarget.style.opacity = "1"; }}
            >
              {isPending ? "Saving..." : "Save Settings"}
            </button>
          </div>

          {/* Section: Notification Preferences */}
          <div
            style={{
              backgroundColor: APP_SHELL.cardBg,
              border: `1px solid ${APP_SHELL.cardBorder}`,
              borderRadius: APP_SHELL.cardRadius,
              padding: "24px",
              display: "flex",
              flexDirection: "column",
              gap: "20px",
            }}
          >
            <h3 style={{ fontSize: "18px", fontWeight: 700, color: APP_SHELL.textPrimary, margin: 0 }}>
              Notification Opt-Outs
            </h3>
            <p style={{ color: APP_SHELL.textSecondary, fontSize: "13px", margin: "0 0 8px 0" }}>
              Control which notifications you wish to receive. Transactional messages (like login magic links and RSVP confirmations) are always sent.
            </p>

            {/* Email Notifications Toggle */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: "14px", color: APP_SHELL.textPrimary }}>Email Blasts & Reminders</div>
                <div style={{ fontSize: "12px", color: APP_SHELL.textSecondary, marginTop: "2px" }}>Receive scheduled reminders and host blasts via email</div>
              </div>
              <button
                type="button"
                onClick={() => handleToggleNotifications("email")}
                style={{
                  width: "50px",
                  height: "26px",
                  borderRadius: "13px",
                  border: "none",
                  backgroundColor: emailNotifications ? APP_SHELL.accent : "rgba(255,255,255,0.1)",
                  cursor: "pointer",
                  position: "relative",
                  transition: "background-color 0.2s",
                  padding: 0,
                }}
              >
                <div
                  style={{
                    width: "20px",
                    height: "20px",
                    borderRadius: "50%",
                    backgroundColor: "#fff",
                    position: "absolute",
                    top: "3px",
                    left: emailNotifications ? "27px" : "3px",
                    transition: "left 0.2s",
                  }}
                />
              </button>
            </div>

            {/* SMS Notifications Toggle */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: "14px", color: APP_SHELL.textPrimary }}>SMS Blasts & Reminders</div>
                <div style={{ fontSize: "12px", color: APP_SHELL.textSecondary, marginTop: "2px" }}>Receive scheduled reminders and host blasts via SMS</div>
              </div>
              <button
                type="button"
                onClick={() => handleToggleNotifications("sms")}
                style={{
                  width: "50px",
                  height: "26px",
                  borderRadius: "13px",
                  border: "none",
                  backgroundColor: smsNotifications ? APP_SHELL.accent : "rgba(255,255,255,0.1)",
                  cursor: "pointer",
                  position: "relative",
                  transition: "background-color 0.2s",
                  padding: 0,
                }}
              >
                <div
                  style={{
                    width: "20px",
                    height: "20px",
                    borderRadius: "50%",
                    backgroundColor: "#fff",
                    position: "absolute",
                    top: "3px",
                    left: smsNotifications ? "27px" : "3px",
                    transition: "left 0.2s",
                  }}
                />
              </button>
            </div>
          </div>
        </form>
      </div>
    </AppShell>
  );
}
