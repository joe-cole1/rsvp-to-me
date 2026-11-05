"use client";

import { useTranslations, useLocale } from "next-intl";
import { useState, useRef, useTransition, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import NextImage from "next/image";
import {
  updateProfileSettings,
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
import { NotificationPreferences } from "@/components/notifications/NotificationPreferences";
import { Dialog } from "@/components/ui/Dialog";
import { compressImage } from "@/lib/client-image";
import { useCaptcha } from "@/components/ui/CaptchaProvider";
import { CAPTCHA_RESPONSE_FIELD } from "@/lib/captcha-types";

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
  const t = useTranslations("Ui.Profile");
  const locale = useLocale();
  const { runWithCaptcha } = useCaptcha();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [name, setName] = useState(initialProfile.name || "");
  const [email, setEmail] = useState(initialProfile.email || "");
  const [phone, setPhone] = useState(initialProfile.phone || "");
  const [avatarUrl, setAvatarUrl] = useState(initialProfile.avatarUrl || "");

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
        message: t("verified"),
      });
      // Clean query params
      router.replace("/profile");
    } else if (error === "invalid-token") {
      setFeedback({
        type: "error",
        message: t("invalidLink"),
      });
      router.replace("/profile");
    } else if (error === "email-taken") {
      setFeedback({
        type: "error",
        message: t("emailTaken"),
      });
      router.replace("/profile");
    } else if (error === "phone-taken") {
      setFeedback({
        type: "error",
        message: t("phoneTaken"),
      });
      router.replace("/profile");
    }
  }, [searchParams, router, t]);
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

      const res = await runWithCaptcha("image_upload", (token) => {
        if (token) form.set(CAPTCHA_RESPONSE_FIELD, token);
        return fetch("/api/upload", { method: "POST", body: form });
      });
      if (!res.ok) throw new Error(await res.text());

      const { url } = (await res.json()) as { url: string };
      setAvatarUrl(url);

      // Save avatarUrl immediately to profile
      await runWithCaptcha("profile_edit", (token) =>
        updateProfileSettings(
          {
            name,
            avatarUrl: url,
            email: initialProfile.email || undefined,
            phone: initialProfile.phone || undefined,
          },
          token
        )
      );

      setFeedback({ type: "success", message: t("avatarSaved") });
    } catch (err) {
      console.error(err);
      const message = err instanceof Error ? err.message : t("avatarFailed");
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
        const result = await runWithCaptcha("profile_edit", (token) =>
          updateProfileSettings(
            {
              name,
              avatarUrl,
              email: email.trim() || undefined,
              phone: phone.trim() || undefined,
            },
            token
          )
        );

        if (result.success) {
          if (result.messages && result.messages.length > 0) {
            setInfoMessages(result.messages);
          } else {
            setFeedback({ type: "success", message: t("saved") });
          }
          router.refresh();
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : t("saveFailed");
        setFeedback({ type: "error", message });
      }
    });
  };

  const displayName = name || initialProfile.email?.split("@")[0] || t("user");
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
          {t("title")}
        </h2>
        <p style={{ color: APP_SHELL.textSecondary, marginBottom: "32px", fontSize: "14px" }}>
          {t("description")}
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
                      alt={t("avatar")}
                      fill
                      sizes="80px"
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
                  {t("changePhoto")}
                </button>
                <div style={{ color: APP_SHELL.textMuted, fontSize: "11px", marginTop: "6px" }}>
                  {t("photoHint")}
                </div>
              </div>
            </div>

            {/* Inputs */}
            <FormField label={t("fullName")} style={{ marginBottom: 0 }}>
              <AppInput
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                style={{ padding: "12px 16px" }}
              />
            </FormField>

            <FormField label={t("email")} style={{ marginBottom: 0 }}>
              <AppInput
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{ padding: "12px 16px" }}
              />
            </FormField>

            {channelConfig.sms && (
              <FormField label={t("phone")} style={{ marginBottom: 0 }}>
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
              {isPending ? t("saving") : t("save")}
            </AppButton>
          </div>
        </form>

        <NotificationPreferences scope={{ kind: "profile" }} />

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
            {t("danger")}
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
                <p style={{ color: "#ef4444", fontWeight: 700, margin: 0 }}>{t("scheduled")}</p>
                <p
                  style={{
                    color: "rgba(255,255,255,0.6)",
                    fontSize: "14px",
                    marginTop: "6px",
                    marginBottom: 0,
                  }}
                >
                  {t("scheduledDate", {
                    date: new Date(scheduledDeletionDate).toLocaleString(locale),
                  })}
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
                          message: t("cancelled"),
                        });
                        router.refresh();
                      }
                    } catch (err) {
                      setFeedback({
                        type: "error",
                        message: err instanceof Error ? err.message : t("cancelFailed"),
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
                {t("cancelDeletion")}
              </button>
            </div>
          ) : (
            <>
              <p style={{ color: "rgba(255,255,255,0.6)", fontSize: "14px", marginBottom: "16px" }}>
                {t("deleteWarning")}
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
                {t("deleteAccount")}
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
          {t("deleteTitle")}
        </h2>

        {blockedEvents && blockedEvents.length > 0 ? (
          <>
            <p style={{ color: "rgba(255,255,255,0.7)", fontSize: "14px", marginBottom: "16px" }}>
              {t("blocked")}
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
                          message: t("eventDeleteFailed", { title: ev.title }),
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
                    {isDeletingEvent === ev.id ? t("deleting") : t("deleteEvent")}
                  </button>
                </div>
              ))}
            </div>
            {blockedEvents.length === 0 && (
              <p style={{ color: "#22c55e", fontSize: "14px", marginBottom: "16px" }}>
                {t("allDeleted")}
              </p>
            )}
          </>
        ) : (
          <>
            <p style={{ color: "rgba(255,255,255,0.7)", fontSize: "14px", marginBottom: "8px" }}>
              {t("anonymize")}
            </p>
            <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "13px", marginBottom: "16px" }}>
              {t("reverse")}
            </p>
            <p
              style={{
                color: APP_SHELL.textSecondary,
                fontSize: "13px",
                marginBottom: "8px",
                fontWeight: 600,
              }}
            >
              {t("confirmHint")}
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
            {t("cancel")}
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
                    message: t("deleteFailed"),
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
              {isDeletingAccount ? t("processing") : t("confirmDelete")}
            </button>
          )}
        </div>
      </Dialog>
    </AppShell>
  );
}
