"use client";

import { useState, useRef, useTransition, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import NextImage from "next/image";
import {
  updateProfileSettings,
  updateNotificationSettings,
  requestAccountDeletion,
  cancelMyAccountDeletion,
} from "@/app/actions/profile";
import { deleteEvent } from "@/app/actions/event";
import { APP_SHELL } from "@/lib/theme";
import { AppShell } from "@/components/ui/AppShell";
import {
  AppButton,
  AppInput,
  FeedbackToast,
  FormField,
  InlineAlert,
  appCardStyle,
  appInputStyle,
} from "@/components/ui/AppPrimitives";
import { Dialog } from "@/components/ui/Dialog";
import { compressImage } from "@/lib/client-image";

interface ProfileData {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  avatarUrl: string | null;
  role: "GUEST" | "HOST" | "ADMIN";
  emailNotifications: boolean;
  smsNotifications: boolean;
  notificationChannel: "EMAIL" | "SMS" | "BOTH";
  deletionRequestedAt: Date | null;
  deletionScheduledAt: Date | null;
}

export default function ProfileClient({
  initialProfile,
  channelConfig = { email: true, sms: true },
}: {
  initialProfile: ProfileData;
  channelConfig?: { email: boolean; sms: boolean };
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [name, setName] = useState(initialProfile.name || "");
  const [email, setEmail] = useState(initialProfile.email || "");
  const [phone, setPhone] = useState(initialProfile.phone || "");
  const [avatarUrl, setAvatarUrl] = useState(initialProfile.avatarUrl || "");
  const [emailNotifications, setEmailNotifications] = useState(initialProfile.emailNotifications);
  const [smsNotifications, setSmsNotifications] = useState(initialProfile.smsNotifications);
  const [notificationChannel, setNotificationChannel] = useState<"EMAIL" | "SMS" | "BOTH">(
    initialProfile.notificationChannel
  );

  const [isPending, startTransition] = useTransition();
  const [isUploading, setIsUploading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(
    null
  );
  const [infoMessages, setInfoMessages] = useState<string[]>([]);

  // Deletion flow state
  const [scheduledDeletionDate, setScheduledDeletionDate] = useState(
    initialProfile.deletionScheduledAt
  );
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [blockedEvents, setBlockedEvents] = useState<
    { id: string; title: string; slug: string }[] | null
  >(null);
  const [isDeletingEvent, setIsDeletingEvent] = useState<string | null>(null);

  useEffect(() => {
    if (feedback) {
      const timer = setTimeout(() => setFeedback(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [feedback]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle verification and error query params
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const verified = searchParams.get("verified");
    const error = searchParams.get("error");

    if (verified === "1") {
      setFeedback({
        type: "success",
        message: "Contact details successfully verified and updated!",
      });
      // Clean query params
      router.replace("/profile");
    } else if (error === "invalid-token") {
      setFeedback({
        type: "error",
        message: "The verification link was invalid, expired, or already used.",
      });
      router.replace("/profile");
    } else if (error === "email-taken") {
      setFeedback({
        type: "error",
        message: "That email address is already taken by another account.",
      });
      router.replace("/profile");
    } else if (error === "phone-taken") {
      setFeedback({
        type: "error",
        message: "That phone number is already taken by another account.",
      });
      router.replace("/profile");
    }
  }, [searchParams, router]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setFeedback(null);
    try {
      const compressed = await compressImage(file, { maxWidth: 400, maxHeight: 400 });
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
    } catch (err) {
      console.error(err);
      const message = err instanceof Error ? err.message : "Failed to upload avatar.";
      setFeedback({ type: "error", message });
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
          router.refresh();
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to update profile.";
        setFeedback({ type: "error", message });
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
        notificationChannel,
      });
    } catch (err) {
      console.error("Failed to update notification toggles", err);
    }
  };

  const handleChannelChange = async (channel: "EMAIL" | "SMS" | "BOTH") => {
    setNotificationChannel(channel);
    try {
      await updateNotificationSettings({
        emailNotifications,
        smsNotifications,
        notificationChannel: channel,
      });
    } catch (err) {
      console.error("Failed to update notification channel", err);
    }
  };

  const displayName = name || initialProfile.email?.split("@")[0] || "User";
  const initials = displayName.slice(0, 2).toUpperCase();

  return (
    <AppShell>
      <div
        style={{
          maxWidth: "600px",
          margin: "40px auto",
          padding: "0 20px",
          boxSizing: "border-box",
        }}
      >
        <h2
          style={{
            fontSize: "28px",
            fontWeight: 800,
            color: APP_SHELL.textPrimary,
            marginBottom: "8px",
          }}
        >
          Profile Settings
        </h2>
        <p style={{ color: APP_SHELL.textSecondary, marginBottom: "32px", fontSize: "14px" }}>
          Manage your account profile details, verification status, and notification preferences.
        </p>

        <FeedbackToast feedback={feedback} onDismiss={() => setFeedback(null)} />

        {infoMessages.map((msg, idx) => (
          <InlineAlert
            key={idx}
            tone="info"
            style={{ padding: "16px", fontSize: "14px", fontWeight: 600 }}
          >
            ℹ️ {msg}
          </InlineAlert>
        ))}

        <form
          onSubmit={handleProfileSubmit}
          style={{ display: "flex", flexDirection: "column", gap: "32px" }}
        >
          {/* Section: Personal Info Card */}
          <div
            style={{
              ...appCardStyle,
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
                  <div
                    style={{
                      width: "80px",
                      height: "80px",
                      borderRadius: "50%",
                      overflow: "hidden",
                      border: `2px solid ${APP_SHELL.cardBorder}`,
                      position: "relative",
                    }}
                  >
                    <NextImage
                      src={avatarUrl}
                      alt="Avatar"
                      unoptimized
                      fill
                      style={{
                        objectFit: "cover",
                      }}
                    />
                  </div>
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
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.1)")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.06)")
                  }
                >
                  Change Photo
                </button>
                <div style={{ color: APP_SHELL.textMuted, fontSize: "11px", marginTop: "6px" }}>
                  Max 8MB. Compressed automatically.
                </div>
              </div>
            </div>

            {/* Inputs */}
            <FormField label="Full Name" style={{ marginBottom: 0 }}>
              <AppInput
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                style={{ padding: "12px 16px" }}
              />
            </FormField>

            <FormField label="Email Address" style={{ marginBottom: 0 }}>
              <AppInput
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{ padding: "12px 16px" }}
              />
            </FormField>

            {channelConfig.sms && (
              <FormField label="Phone Number" style={{ marginBottom: 0 }}>
                <AppInput
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+15555555555"
                  style={{ padding: "12px 16px" }}
                />
              </FormField>
            )}

            <AppButton
              type="submit"
              disabled={isPending}
              style={{
                padding: "14px",
                transition: "opacity 0.2s, transform 0.1s",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                opacity: isPending ? 0.6 : 1,
              }}
              onMouseEnter={(e) => {
                if (!isPending) e.currentTarget.style.opacity = "0.9";
              }}
              onMouseLeave={(e) => {
                if (!isPending) e.currentTarget.style.opacity = "1";
              }}
            >
              {isPending ? "Saving..." : "Save Settings"}
            </AppButton>
          </div>

          {/* Section: Notification Preferences */}
          {(channelConfig.email || channelConfig.sms) && (
            <div
              style={{
                ...appCardStyle,
                padding: "24px",
                display: "flex",
                flexDirection: "column",
                gap: "20px",
              }}
            >
              <h3
                style={{
                  fontSize: "18px",
                  fontWeight: 700,
                  color: APP_SHELL.textPrimary,
                  margin: 0,
                }}
              >
                Notification Preferences
              </h3>
              <p style={{ color: APP_SHELL.textSecondary, fontSize: "13px", margin: "0 0 8px 0" }}>
                Control which notifications you wish to receive. Transactional messages (like login
                magic links and RSVP confirmations) are always sent.
              </p>

              {/* Preferred Channel (shown only when both email and SMS are enabled) */}
              {channelConfig.email && channelConfig.sms && (
                <div>
                  <div
                    style={{
                      fontWeight: 600,
                      fontSize: "14px",
                      color: APP_SHELL.textPrimary,
                      marginBottom: "10px",
                    }}
                  >
                    Preferred Channel for Event Updates
                  </div>
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                    {(
                      [
                        { value: "EMAIL", label: "Email" },
                        { value: "SMS", label: "SMS" },
                        { value: "BOTH", label: "Both" },
                      ] as const
                    ).map(({ value, label }) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => handleChannelChange(value)}
                        style={{
                          padding: "7px 18px",
                          borderRadius: "20px",
                          border:
                            notificationChannel === value
                              ? `1.5px solid ${APP_SHELL.accent}`
                              : "1.5px solid rgba(255,255,255,0.12)",
                          background:
                            notificationChannel === value
                              ? `${APP_SHELL.accent}22`
                              : "rgba(255,255,255,0.04)",
                          color:
                            notificationChannel === value
                              ? APP_SHELL.accent
                              : APP_SHELL.textSecondary,
                          fontSize: "13px",
                          fontWeight: 600,
                          cursor: "pointer",
                          fontFamily: "inherit",
                          transition: "all 0.15s",
                        }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <p
                    style={{
                      fontSize: "12px",
                      color: APP_SHELL.textSecondary,
                      margin: "8px 0 0 0",
                    }}
                  >
                    Hosts use this channel when sending event update notifications to guests.
                  </p>
                </div>
              )}

              {/* Email Notifications Toggle */}
              {channelConfig.email && (
                <div
                  style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}
                >
                  <div>
                    <div
                      style={{ fontWeight: 600, fontSize: "14px", color: APP_SHELL.textPrimary }}
                    >
                      Email Blasts & Reminders
                    </div>
                    <div
                      style={{ fontSize: "12px", color: APP_SHELL.textSecondary, marginTop: "2px" }}
                    >
                      Receive scheduled reminders and host blasts via email
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleToggleNotifications("email")}
                    style={{
                      width: "50px",
                      height: "26px",
                      borderRadius: "13px",
                      border: "none",
                      backgroundColor: emailNotifications
                        ? APP_SHELL.accent
                        : "rgba(255,255,255,0.1)",
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
              )}

              {/* SMS Notifications Toggle */}
              {channelConfig.sms && (
                <div
                  style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}
                >
                  <div>
                    <div
                      style={{ fontWeight: 600, fontSize: "14px", color: APP_SHELL.textPrimary }}
                    >
                      SMS Blasts & Reminders
                    </div>
                    <div
                      style={{ fontSize: "12px", color: APP_SHELL.textSecondary, marginTop: "2px" }}
                    >
                      Receive scheduled reminders and host blasts via SMS
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleToggleNotifications("sms")}
                    style={{
                      width: "50px",
                      height: "26px",
                      borderRadius: "13px",
                      border: "none",
                      backgroundColor: smsNotifications
                        ? APP_SHELL.accent
                        : "rgba(255,255,255,0.1)",
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
              )}
            </div>
          )}
        </form>

        {/* Danger Zone */}
        <div
          style={{
            backgroundColor: APP_SHELL.cardBg,
            border: "1px solid #ef444440",
            borderRadius: "16px",
            padding: "24px",
            marginTop: "8px",
          }}
        >
          <h2 style={{ fontSize: "16px", fontWeight: 700, color: "#ef4444", marginBottom: "16px" }}>
            Danger Zone
          </h2>

          {scheduledDeletionDate ? (
            <div
              style={{
                backgroundColor: "rgba(239,68,68,0.1)",
                border: "1px solid #ef444460",
                borderRadius: "10px",
                padding: "16px",
                display: "flex",
                flexDirection: "column",
                gap: "12px",
              }}
            >
              <div>
                <p style={{ color: "#ef4444", fontWeight: 700, margin: 0 }}>
                  Your account is scheduled for deletion
                </p>
                <p
                  style={{
                    color: "rgba(255,255,255,0.6)",
                    fontSize: "14px",
                    marginTop: "6px",
                    marginBottom: 0,
                  }}
                >
                  Anonymization will occur on or after{" "}
                  {new Date(scheduledDeletionDate).toLocaleString()}. You can cancel this request at
                  any time before then.
                </p>
              </div>
              <button
                type="button"
                disabled={isPending}
                onClick={() => {
                  startTransition(async () => {
                    try {
                      const res = await cancelMyAccountDeletion();
                      if (res.success) {
                        setScheduledDeletionDate(null);
                        setFeedback({
                          type: "success",
                          message: "Account deletion request successfully canceled!",
                        });
                        router.refresh();
                      }
                    } catch (err) {
                      setFeedback({
                        type: "error",
                        message:
                          err instanceof Error ? err.message : "Failed to cancel deletion request.",
                      });
                    }
                  });
                }}
                style={{
                  alignSelf: "flex-start",
                  backgroundColor: APP_SHELL.accent,
                  border: "none",
                  color: "#fff",
                  borderRadius: "10px",
                  padding: "8px 16px",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: isPending ? "not-allowed" : "pointer",
                  opacity: isPending ? 0.6 : 1,
                  transition: "opacity 0.2s",
                }}
              >
                Cancel Deletion Request
              </button>
            </div>
          ) : (
            <>
              <p style={{ color: "rgba(255,255,255,0.6)", fontSize: "14px", marginBottom: "16px" }}>
                Permanently delete your account and all associated data. This cannot be undone.
              </p>
              <button
                onClick={() => setShowDeleteModal(true)}
                style={{
                  backgroundColor: "transparent",
                  border: "1px solid #ef4444",
                  color: "#ef4444",
                  borderRadius: "10px",
                  padding: "10px 20px",
                  fontSize: "14px",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Delete My Account
              </button>
            </>
          )}
        </div>
      </div>

      {/* Delete Account Modal */}
      <Dialog
        open={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setDeleteConfirmText("");
          setBlockedEvents(null);
        }}
        titleId="delete-account-dialog-title"
        closeOnBackdrop={!isDeletingAccount}
        panelStyle={{
          backgroundColor: "#1a1228",
          border: `1px solid ${APP_SHELL.navBorder}`,
          borderRadius: "16px",
          padding: "28px",
          maxWidth: "480px",
        }}
      >
        <h2
          id="delete-account-dialog-title"
          style={{
            fontSize: "20px",
            fontWeight: 800,
            color: APP_SHELL.textPrimary,
            marginBottom: "12px",
          }}
        >
          Delete your account?
        </h2>

        {blockedEvents && blockedEvents.length > 0 ? (
          <>
            <p style={{ color: "rgba(255,255,255,0.7)", fontSize: "14px", marginBottom: "16px" }}>
              You have upcoming published events. Delete them first before deleting your account.
            </p>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "8px",
                marginBottom: "20px",
              }}
            >
              {blockedEvents.map((ev) => (
                <div
                  key={ev.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    backgroundColor: "rgba(255,255,255,0.05)",
                    borderRadius: "8px",
                    padding: "10px 14px",
                  }}
                >
                  <span style={{ color: APP_SHELL.textPrimary, fontSize: "14px", fontWeight: 600 }}>
                    {ev.title}
                  </span>
                  <button
                    disabled={isDeletingEvent === ev.id}
                    onClick={async () => {
                      setIsDeletingEvent(ev.id);
                      try {
                        await deleteEvent(ev.id);
                        setBlockedEvents((prev) =>
                          prev ? prev.filter((e) => e.id !== ev.id) : null
                        );
                      } catch {
                        setFeedback({
                          type: "error",
                          message: `Failed to delete "${ev.title}".`,
                        });
                      } finally {
                        setIsDeletingEvent(null);
                      }
                    }}
                    style={{
                      backgroundColor: "transparent",
                      border: "1px solid #ef4444",
                      color: "#ef4444",
                      borderRadius: "6px",
                      padding: "4px 12px",
                      fontSize: "12px",
                      fontWeight: 600,
                      cursor: isDeletingEvent === ev.id ? "not-allowed" : "pointer",
                      opacity: isDeletingEvent === ev.id ? 0.5 : 1,
                    }}
                  >
                    {isDeletingEvent === ev.id ? "Deleting…" : "Delete event"}
                  </button>
                </div>
              ))}
            </div>
            {blockedEvents.length === 0 && (
              <p style={{ color: "#22c55e", fontSize: "14px", marginBottom: "16px" }}>
                All events deleted. You can now confirm account deletion below.
              </p>
            )}
          </>
        ) : (
          <>
            <p style={{ color: "rgba(255,255,255,0.7)", fontSize: "14px", marginBottom: "8px" }}>
              Your profile info will be anonymized within 30 days. Past event history is preserved
              for guests. You will be signed out immediately.
            </p>
            <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "13px", marginBottom: "16px" }}>
              An admin can reverse this within 30 days if you change your mind.
            </p>
            <p
              style={{
                color: APP_SHELL.textSecondary,
                fontSize: "13px",
                marginBottom: "8px",
                fontWeight: 600,
              }}
            >
              Type DELETE to confirm:
            </p>
            <AppInput
              type="text"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder="DELETE"
              style={{ ...appInputStyle, marginBottom: "16px" }}
            />
          </>
        )}

        <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
          <button
            onClick={() => {
              setShowDeleteModal(false);
              setDeleteConfirmText("");
              setBlockedEvents(null);
            }}
            style={{
              backgroundColor: "transparent",
              border: `1px solid ${APP_SHELL.navBorder}`,
              color: APP_SHELL.textSecondary,
              borderRadius: "10px",
              padding: "10px 20px",
              fontSize: "14px",
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          {(!blockedEvents || blockedEvents.length === 0) && (
            <button
              disabled={deleteConfirmText !== "DELETE" || isDeletingAccount}
              onClick={async () => {
                if (deleteConfirmText !== "DELETE") return;
                setIsDeletingAccount(true);
                try {
                  const result = await requestAccountDeletion();
                  if ("blocked" in result && result.blocked) {
                    setBlockedEvents(result.events ?? []);
                    setDeleteConfirmText("");
                  } else {
                    router.push("/auth/sign-in");
                  }
                } catch {
                  setFeedback({
                    type: "error",
                    message: "Failed to delete account. Please try again.",
                  });
                  setIsDeletingAccount(false);
                }
              }}
              style={{
                backgroundColor:
                  deleteConfirmText === "DELETE" && !isDeletingAccount
                    ? "#ef4444"
                    : "rgba(239,68,68,0.3)",
                border: "none",
                color: "#fff",
                borderRadius: "10px",
                padding: "10px 20px",
                fontSize: "14px",
                fontWeight: 700,
                cursor:
                  deleteConfirmText === "DELETE" && !isDeletingAccount ? "pointer" : "not-allowed",
              }}
            >
              {isDeletingAccount ? "Processing…" : "Confirm Delete"}
            </button>
          )}
        </div>
      </Dialog>
    </AppShell>
  );
}
