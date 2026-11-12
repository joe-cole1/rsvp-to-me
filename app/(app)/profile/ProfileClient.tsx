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
import { APP_SHELL, APP_SHELL_THEME as T, PHOTO_OVERLAY } from "@/lib/theme";
import { AppShell } from "@/components/ui/AppShell";
import { appCardStyle } from "@/components/ui/AppPrimitives";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { InlineAlert, Toast, type ToastMessage } from "@/components/ui/Feedback";
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
  const [feedback, setFeedback] = useState<ToastMessage | null>(null);
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
        tone: "success",
        message: t("verified"),
      });
      // Clean query params
      router.replace("/profile");
    } else if (error === "invalid-token") {
      setFeedback({
        tone: "error",
        message: t("invalidLink"),
      });
      router.replace("/profile");
    } else if (error === "email-taken") {
      setFeedback({
        tone: "error",
        message: t("emailTaken"),
      });
      router.replace("/profile");
    } else if (error === "phone-taken") {
      setFeedback({
        tone: "error",
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

      setFeedback({ tone: "success", message: t("avatarSaved") });
    } catch (err) {
      console.error(err);
      const message = err instanceof Error ? err.message : t("avatarFailed");
      setFeedback({ tone: "error", message });
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
            setFeedback({ tone: "success", message: t("saved") });
          }
          router.refresh();
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : t("saveFailed");
        setFeedback({ tone: "error", message });
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
        <h1
          style={{
            fontSize: "28px",
            fontWeight: 800,
            color: T.textPrimary,
            marginBottom: "8px",
          }}
        >
          {t("title")}
        </h1>
        <p style={{ color: T.textSecondary, marginBottom: "32px", fontSize: "14px" }}>
          {t("description")}
        </p>

        <Toast theme={T} toast={feedback} onDismiss={() => setFeedback(null)} />

        {infoMessages.map((msg, idx) => (
          <InlineAlert key={idx} theme={T} tone="info">
            {msg}
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
                      background: T.avatarGradient,
                      color: T.accentFg,
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
                      backgroundColor: PHOTO_OVERLAY.background,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: PHOTO_OVERLAY.text,
                      fontSize: "12px",
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
                <Button
                  theme={T}
                  variant="secondary"
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                >
                  {t("changePhoto")}
                </Button>
                <div style={{ color: T.textSecondary, fontSize: "13px", marginTop: "6px" }}>
                  {t("photoHint")}
                </div>
              </div>
            </div>

            {/* Inputs */}
            <Field theme={T} label={t("fullName")} style={{ marginBottom: 0 }}>
              <Input
                theme={T}
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </Field>

            <Field theme={T} label={t("email")} style={{ marginBottom: 0 }}>
              <Input
                theme={T}
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </Field>

            {channelConfig.sms && (
              <Field theme={T} label={t("phone")} style={{ marginBottom: 0 }}>
                <Input
                  theme={T}
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+15555555555"
                />
              </Field>
            )}

            <Button theme={T} variant="primary" type="submit" disabled={isPending} fullWidth>
              {isPending ? t("saving") : t("save")}
            </Button>
          </div>
        </form>

        <NotificationPreferences scope={{ kind: "profile" }} />

        {/* Danger Zone */}
        <div
          style={{
            backgroundColor: APP_SHELL.cardBg,
            border: `1px solid ${T.status.error.border}`,
            borderRadius: "16px",
            padding: "24px",
            marginTop: "8px",
          }}
        >
          <h2
            style={{
              fontSize: "16px",
              fontWeight: 700,
              color: T.status.error.text,
              marginBottom: "16px",
            }}
          >
            {t("danger")}
          </h2>

          {scheduledDeletionDate ? (
            <div
              style={{
                backgroundColor: T.status.error.bg,
                border: `1px solid ${T.status.error.border}`,
                borderRadius: "10px",
                padding: "16px",
                display: "flex",
                flexDirection: "column",
                gap: "12px",
              }}
            >
              <div>
                <p style={{ color: T.status.error.text, fontWeight: 700, margin: 0 }}>
                  {t("scheduled")}
                </p>
                <p
                  style={{
                    color: T.textSecondary,
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
              <Button
                theme={T}
                variant="primary"
                type="button"
                disabled={isPending}
                style={{ alignSelf: "flex-start" }}
                onClick={() => {
                  startTransition(async () => {
                    try {
                      const res = await cancelMyAccountDeletion();
                      if (res.success) {
                        setScheduledDeletionDate(null);
                        setFeedback({
                          tone: "success",
                          message: t("cancelled"),
                        });
                        router.refresh();
                      }
                    } catch (err) {
                      setFeedback({
                        tone: "error",
                        message: err instanceof Error ? err.message : t("cancelFailed"),
                      });
                    }
                  });
                }}
              >
                {t("cancelDeletion")}
              </Button>
            </div>
          ) : (
            <>
              <p style={{ color: T.textSecondary, fontSize: "14px", marginBottom: "16px" }}>
                {t("deleteWarning")}
              </p>
              <Button theme={T} variant="destructive" onClick={() => setShowDeleteModal(true)}>
                {t("deleteAccount")}
              </Button>
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
          backgroundColor: APP_SHELL.chromeSurface,
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
            color: T.textPrimary,
            marginBottom: "12px",
          }}
        >
          {t("deleteTitle")}
        </h2>

        {blockedEvents && blockedEvents.length > 0 ? (
          <>
            <p style={{ color: T.textSecondary, fontSize: "14px", marginBottom: "16px" }}>
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
                    backgroundColor: T.inputBg,
                    borderRadius: "8px",
                    padding: "10px 14px",
                  }}
                >
                  <span style={{ color: T.textPrimary, fontSize: "14px", fontWeight: 600 }}>
                    {ev.title}
                  </span>
                  <Button
                    theme={T}
                    variant="destructive"
                    size="sm"
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
                          tone: "error",
                          message: t("eventDeleteFailed", { title: ev.title }),
                        });
                      } finally {
                        setIsDeletingEvent(null);
                      }
                    }}
                  >
                    {isDeletingEvent === ev.id ? t("deleting") : t("deleteEvent")}
                  </Button>
                </div>
              ))}
            </div>
            {blockedEvents.length === 0 && (
              <p style={{ color: T.status.success.text, fontSize: "14px", marginBottom: "16px" }}>
                {t("allDeleted")}
              </p>
            )}
          </>
        ) : (
          <>
            <p style={{ color: T.textSecondary, fontSize: "14px", marginBottom: "8px" }}>
              {t("anonymize")}
            </p>
            <p style={{ color: T.textSecondary, fontSize: "13px", marginBottom: "16px" }}>
              {t("reverse")}
            </p>
            <p
              style={{
                color: T.textSecondary,
                fontSize: "13px",
                marginBottom: "8px",
                fontWeight: 600,
              }}
            >
              {t("confirmHint")}
            </p>
            <Input
              theme={T}
              type="text"
              aria-label={t("confirmHint")}
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder="DELETE"
              style={{ marginBottom: "16px" }}
            />
          </>
        )}

        <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
          <Button
            theme={T}
            variant="secondary"
            onClick={() => {
              setShowDeleteModal(false);
              setDeleteConfirmText("");
              setBlockedEvents(null);
            }}
          >
            {t("cancel")}
          </Button>
          {(!blockedEvents || blockedEvents.length === 0) && (
            <Button
              theme={T}
              variant="destructive"
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
                    tone: "error",
                    message: t("deleteFailed"),
                  });
                  setIsDeletingAccount(false);
                }
              }}
            >
              {isDeletingAccount ? t("processing") : t("confirmDelete")}
            </Button>
          )}
        </div>
      </Dialog>
    </AppShell>
  );
}
