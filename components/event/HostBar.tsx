"use client";

import { useTranslations } from "next-intl";

import React, { useEffect, useReducer, useState } from "react";
import { Mail, MessageSquare, Settings, Eye, Globe, Link2, Lock, Check } from "lucide-react";
import type { ResolvedTheme } from "@/lib/theme";
import { sendBlast, sendSmsBlast, saveEventSettings } from "@/app/actions/event";
import Image from "next/image";
import QRCode from "qrcode";
import { useCaptcha } from "@/components/ui/CaptchaProvider";

import { Dialog } from "@/components/ui/Dialog";
import { emptyInvitationDraft, invitationDraftReducer } from "@/lib/invitation-draft-rows";
import { InvitationComposer } from "./InvitationComposer";

type Visibility = "PUBLIC" | "UNLISTED" | "PRIVATE";

function visibilityIcon(v: Visibility) {
  if (v === "PUBLIC") return Globe;
  if (v === "PRIVATE") return Lock;
  return Link2;
}

export function HostBar({
  eventId,
  eventSlug,
  theme: t,
  visibility: initialVisibility,
  channelConfig = { email: true, sms: true },
}: {
  eventId: string;
  eventSlug: string;
  theme: ResolvedTheme;
  visibility: Visibility;
  channelConfig?: { email: boolean; sms: boolean };
}) {
  const translate = useTranslations("Ui.Event.HostBar");

  const VISIBILITY_OPTIONS: {
    value: Visibility;
    icon: React.ElementType;
    label: string;
    description: string;
  }[] = [
    {
      value: "PUBLIC",
      icon: Globe,
      label: translate("public"),
      description: translate("anyoneCanFindEvent"),
    },
    {
      value: "UNLISTED",
      icon: Link2,
      label: translate("unlisted"),
      description: translate("onlyPeopleLink"),
    },
    {
      value: "PRIVATE",
      icon: Lock,
      label: translate("private"),
      description: translate("inviteOnlyApprovalRequired"),
    },
  ];

  const [activePanel, setActivePanel] = useState<string | null>(null);
  // Owned here so closing the dialog keeps unsent recipients until the page reloads.
  const [inviteDraft, dispatchInvite] = useReducer(invitationDraftReducer, emptyInvitationDraft);
  const messagingOn = channelConfig.email || channelConfig.sms;
  const [inviteTab, setInviteTab] = useState<"invite" | "share">(messagingOn ? "invite" : "share");
  const inviteTabs = [
    { id: "invite", label: translate("tabInvite") },
    { id: "share", label: translate("tabShare") },
  ] as const;
  const [messageText, setMessageText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [blastResult, setBlastResult] = useState<string | null>(null);
  const [blastSucceeded, setBlastSucceeded] = useState(false);
  const [sendEmail, setSendEmail] = useState(true);
  const [sendSms, setSendSms] = useState(false);
  const [recipientFilters, setRecipientFilters] = useState<
    ("ALL" | "INVITED" | "GOING" | "MAYBE" | "NO")[]
  >(["ALL"]);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  const toggleRecipientFilter = (filter: "ALL" | "INVITED" | "GOING" | "MAYBE" | "NO") => {
    if (filter === "ALL") {
      setRecipientFilters(["ALL"]);
    } else {
      setRecipientFilters((prev) => {
        const active = prev.includes(filter);
        const next = prev.filter((f) => f !== "ALL");
        if (active) {
          return next.filter((f) => f !== filter);
        } else {
          return [...next, filter];
        }
      });
    }
  };
  const [visibility, setVisibility] = useState<Visibility>(initialVisibility);
  const [visibilityPending, setVisibilityPending] = useState(false);

  const [copiedLink, setCopiedLink] = useState(false);
  useEffect(() => {
    let cancelled = false;
    if (activePanel === "invite" && visibility !== "PRIVATE") {
      QRCode.toDataURL(window.location.href, {
        width: 220,
        margin: 1,
        color: { dark: "#000", light: "#fff" },
      })
        .then((url) => {
          if (!cancelled) setQrDataUrl(url);
        })
        .catch(() => {});
    }
    return () => {
      cancelled = true;
    };
  }, [activePanel, visibility]);
  const { runWithCaptcha } = useCaptcha();

  const VisIcon = visibilityIcon(visibility);

  const actions = [
    { id: "invite", icon: Mail, label: translate("invite"), href: null },
    { id: "message", icon: MessageSquare, label: translate("message"), href: null },
    {
      id: "visibility",
      icon: VisIcon,
      label:
        visibility === "PUBLIC"
          ? translate("public")
          : visibility === "UNLISTED"
            ? translate("unlisted")
            : translate("private"),
      href: null,
    },
    {
      id: "settings",
      icon: Settings,
      label: translate("settings"),
      href: `/e/${eventSlug}/settings`,
    },
    { id: "preview", icon: Eye, label: translate("preview"), href: null },
  ];

  const handleVisibilityChange = async (next: Visibility) => {
    if (next === visibility || visibilityPending) return;
    const prev = visibility;
    setVisibilityPending(true);
    setVisibility(next);
    try {
      await runWithCaptcha("event_settings", (token) =>
        saveEventSettings(eventId, { visibility: next }, token)
      );
    } catch {
      setVisibility(prev);
    } finally {
      setVisibilityPending(false);
      setActivePanel(null);
    }
  };

  const handleSendMessage = async () => {
    if (
      !messageText.trim() ||
      isSending ||
      (!sendEmail && !sendSms) ||
      recipientFilters.length === 0
    )
      return;
    setBlastSucceeded(false);
    setIsSending(true);
    setBlastResult(null);

    let emailStatus = "";
    let smsStatus = "";
    let successCount = 0;
    let hasRecipients = false;

    try {
      if (sendEmail) {
        const r = await runWithCaptcha("message_send", (token) =>
          sendBlast(eventId, messageText.trim(), recipientFilters, token)
        );
        if (r.success) {
          successCount++;
          hasRecipients ||= r.sent > 0;
          emailStatus =
            r.sent === 0
              ? translate("noGuestsEmailAddressesFound")
              : translate("emailSent", { count: r.sent });
        }
      }
      if (sendSms) {
        const r = await runWithCaptcha("message_send", (token) =>
          sendSmsBlast(eventId, messageText.trim(), recipientFilters, token)
        );
        if (r.success) {
          successCount++;
          hasRecipients ||= r.sent > 0;
          smsStatus =
            r.sent === 0
              ? translate("noGuestsPhoneNumbersFound")
              : translate("smsSent", { count: r.sent });
        }
      }

      if (successCount > 0) {
        const parts = [emailStatus, smsStatus].filter(Boolean);
        setBlastSucceeded(hasRecipients);
        setBlastResult(parts.join(" "));
        setMessageText("");
      } else {
        setBlastResult(translate("failedSendMessageTryAgain"));
      }
    } catch (err: unknown) {
      setBlastResult(err instanceof Error ? err.message : translate("failedSendMessageTryAgain"));
    } finally {
      setIsSending(false);
    }
  };

  return (
    <>
      {/* Floating bar — hidden while a panel is open */}
      {!activePanel && (
        <div
          style={{
            position: "fixed",
            bottom: "24px",
            left: "50%",
            transform: "translateX(-50%)",
            background: "rgba(15,15,20,0.85)",
            backdropFilter: "blur(20px)",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: "100px",
            padding: "8px 16px",
            display: "flex",
            gap: "4px",
            zIndex: 100,
            boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
          }}
        >
          {actions.map(({ id, icon: Icon, label, href }) =>
            href ? (
              <a
                key={id}
                href={href}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "3px",
                  padding: "8px 14px",
                  borderRadius: "80px",
                  textDecoration: "none",
                  color: "rgba(255,255,255,0.7)",
                  fontSize: "11px",
                  fontWeight: 600,
                  background: "transparent",
                  transition: "background 0.15s",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.08)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.background = "transparent";
                }}
              >
                <Icon size={18} />
                {label}
              </a>
            ) : (
              <button
                key={id}
                onClick={() => setActivePanel(activePanel === id ? null : id)}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "3px",
                  padding: "8px 14px",
                  borderRadius: "80px",
                  border: "none",
                  cursor: "pointer",
                  background: "transparent",
                  color: "rgba(255,255,255,0.7)",
                  fontSize: "11px",
                  fontWeight: 600,
                  fontFamily: "inherit",
                  transition: "all 0.15s",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.08)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.background = "transparent";
                }}
              >
                <Icon size={18} />
                {label}
              </button>
            )
          )}
        </div>
      )}

      {/* Panels */}
      {activePanel === "invite" && (
        <Dialog
          open
          onClose={() => setActivePanel(null)}
          titleId="invitation-dialog-title"
          panelStyle={{
            width: "min(760px,100%)",
            maxHeight: "90dvh",
            overflowY: "auto",
            background: "rgba(15,15,20,0.98)",
            color: "#ffffff",
            padding: "24px",
            borderRadius: "20px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2 id="invitation-dialog-title" style={{ fontSize: "20px", fontWeight: 700 }}>
              {translate("inviteGuests")}
            </h2>
            <button
              type="button"
              onClick={() => setActivePanel(null)}
              aria-label={translate("close")}
              style={{ padding: "6px 12px", fontSize: "24px", borderRadius: "8px" }}
            >
              ×
            </button>
          </div>
          <div
            role="tablist"
            aria-label={translate("inviteTabs")}
            style={{
              display: "flex",
              gap: "4px",
              margin: "12px 0 18px",
              borderBottom: "1px solid rgba(255,255,255,0.12)",
            }}
          >
            {inviteTabs.map((tab, index) => {
              const selected = inviteTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  id={`invite-tab-${tab.id}`}
                  aria-selected={selected}
                  aria-controls={`invite-panel-${tab.id}`}
                  tabIndex={selected ? 0 : -1}
                  onClick={() => setInviteTab(tab.id)}
                  onKeyDown={(event) => {
                    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
                    event.preventDefault();
                    const step = event.key === "ArrowRight" ? 1 : inviteTabs.length - 1;
                    const next = inviteTabs[(index + step) % inviteTabs.length];
                    setInviteTab(next.id);
                    document.getElementById(`invite-tab-${next.id}`)?.focus();
                  }}
                  style={{
                    padding: "10px 14px",
                    marginBottom: "-1px",
                    border: "none",
                    borderBottom: `2px solid ${selected ? t.accent : "transparent"}`,
                    background: "transparent",
                    color: selected ? "#ffffff" : "rgba(255,255,255,0.6)",
                    font: "inherit",
                    fontSize: "14px",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
          <div
            role="tabpanel"
            id={`invite-panel-${inviteTab}`}
            aria-labelledby={`invite-tab-${inviteTab}`}
          >
            {inviteTab === "invite" ? (
              !messagingOn ? (
                <p style={{ color: "rgba(255,255,255,0.7)", fontSize: "14px" }}>
                  {translate("messagingNotConfiguredServerShareEvent")}
                </p>
              ) : (
                <InvitationComposer
                  eventId={eventId}
                  channelConfig={channelConfig}
                  theme={{
                    ...t,
                    inputBg: "rgba(255,255,255,0.06)",
                    inputBorder: "rgba(255,255,255,0.16)",
                  }}
                  draft={inviteDraft}
                  dispatch={dispatchInvite}
                />
              )
            ) : visibility === "PRIVATE" ? (
              <div
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: "12px",
                  padding: "16px",
                  marginBottom: "16px",
                  textAlign: "center",
                }}
              >
                <p
                  style={{
                    color: "rgba(255,255,255,0.6)",
                    fontSize: "14px",
                    marginBottom: "10px",
                    lineHeight: 1.6,
                  }}
                >
                  {translate("privateEventGuestsMustInvitedDirectly")}
                </p>
                <a
                  href={`/e/${eventSlug}/settings?section=privacy`}
                  style={{
                    color: t.accent,
                    fontSize: "13px",
                    fontWeight: 600,
                    textDecoration: "none",
                  }}
                >
                  {translate("changeDisplayOptions")}
                </a>
              </div>
            ) : (
              <>
                <p
                  style={{ color: "rgba(255,255,255,0.6)", fontSize: "14px", marginBottom: "16px" }}
                >
                  {translate("shareEventLinkOrSendInvites")}
                </p>
                <div
                  style={{
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: "12px",
                    padding: "12px 16px",
                    fontSize: "14px",
                    marginBottom: "12px",
                    wordBreak: "break-all",
                    color: "rgba(255,255,255,0.9)",
                  }}
                >
                  {typeof window !== "undefined" ? window.location.href : ""}
                </div>
                <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
                  <button
                    onClick={() => {
                      if (typeof navigator !== "undefined") {
                        navigator.clipboard.writeText(window.location.href);
                        setCopiedLink(true);
                        setTimeout(() => setCopiedLink(false), 2000);
                      }
                    }}
                    style={{
                      flex: 1,
                      padding: "12px",
                      background: copiedLink ? "#22c55e" : t.accent,
                      color: "#ffffff",
                      border: "none",
                      borderRadius: "12px",
                      fontFamily: "inherit",
                      fontSize: "14px",
                      fontWeight: 700,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "6px",
                      transition: "all 0.15s ease-in-out",
                    }}
                  >
                    {copiedLink ? <Check size={16} /> : null}
                    {copiedLink ? translate("copied") : translate("copyLink")}
                  </button>
                  {qrDataUrl && (
                    <a
                      href={qrDataUrl}
                      download="event-qr.png"
                      style={{
                        padding: "12px 16px",
                        background: "rgba(255,255,255,0.06)",
                        border: "1px solid rgba(255,255,255,0.1)",
                        borderRadius: "12px",
                        color: "rgba(255,255,255,0.8)",
                        fontSize: "13px",
                        fontWeight: 600,
                        textDecoration: "none",
                        display: "flex",
                        alignItems: "center",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {translate("qr")}
                    </a>
                  )}
                </div>
                {qrDataUrl && (
                  <div style={{ display: "flex", justifyContent: "center", marginBottom: "16px" }}>
                    <Image
                      src={qrDataUrl}
                      alt={translate("eventQrCode")}
                      width={160}
                      height={160}
                      unoptimized
                      style={{ borderRadius: "12px" }}
                    />
                  </div>
                )}
              </>
            )}
          </div>
        </Dialog>
      )}

      {activePanel === "message" && (
        <SlideUp
          onClose={() => {
            setActivePanel(null);
            setBlastResult(null);
          }}
          title={translate("messageGuests")}
        >
          {!channelConfig.email && !channelConfig.sms ? (
            <div
              style={{
                padding: "24px 0",
                textAlign: "center",
                fontSize: "14px",
                color: "rgba(255,255,255,0.4)",
              }}
            >
              {translate("messagingNotConfiguredServerEnableEmail")}
            </div>
          ) : (
            <>
              <textarea
                rows={4}
                placeholder={translate("typeMessage")}
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                style={{
                  width: "100%",
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: "12px",
                  padding: "12px 16px",
                  color: "#fff",
                  fontFamily: "inherit",
                  fontSize: "14px",
                  outline: "none",
                  resize: "none",
                  marginBottom: "12px",
                  boxSizing: "border-box",
                }}
              />

              {blastResult && (
                <p
                  style={{
                    fontSize: "13px",
                    marginBottom: "12px",
                    padding: "8px 12px",
                    borderRadius: "8px",
                    background: blastSucceeded ? "rgba(74,222,128,0.1)" : "rgba(248,113,113,0.1)",
                    color: blastSucceeded ? "#4ade80" : "#f87171",
                  }}
                >
                  {blastResult}
                </p>
              )}

              {/* Channel selection */}
              {(channelConfig.email || channelConfig.sms) && (
                <div style={{ marginBottom: "16px" }}>
                  <div
                    style={{
                      color: "rgba(255,255,255,0.4)",
                      fontSize: "11px",
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      marginBottom: "8px",
                    }}
                  >
                    {translate("deliveryChannels")}
                  </div>
                  <div style={{ display: "flex", gap: "20px", alignItems: "center" }}>
                    {channelConfig.email && (
                      <label
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          fontSize: "14px",
                          cursor: "pointer",
                          color: "rgba(255,255,255,0.8)",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={sendEmail}
                          onChange={(e) => setSendEmail(e.target.checked)}
                          style={{ accentColor: t.accent }}
                        />
                        <span>{translate("email")}</span>
                      </label>
                    )}
                    {channelConfig.sms && (
                      <label
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          fontSize: "14px",
                          cursor: "pointer",
                          color: "rgba(255,255,255,0.8)",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={sendSms}
                          onChange={(e) => setSendSms(e.target.checked)}
                          style={{ accentColor: t.accent }}
                        />
                        <span>{translate("sms")}</span>
                      </label>
                    )}
                  </div>
                </div>
              )}

              {/* Recipient selection */}
              <div style={{ marginBottom: "20px" }}>
                <div
                  style={{
                    color: "rgba(255,255,255,0.4)",
                    fontSize: "11px",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    marginBottom: "8px",
                  }}
                >
                  {translate("recipients")}
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                  {(
                    [
                      { key: "ALL", label: translate("all") },
                      { key: "INVITED", label: translate("invited") },
                      { key: "GOING", label: translate("yes") },
                      { key: "MAYBE", label: translate("maybe") },
                      { key: "NO", label: translate("no") },
                    ] as const
                  ).map(({ key, label }) => {
                    const active = recipientFilters.includes(key);
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => toggleRecipientFilter(key)}
                        style={{
                          padding: "6px 12px",
                          borderRadius: "20px",
                          fontSize: "12px",
                          fontWeight: 600,
                          cursor: "pointer",
                          border: active
                            ? `1px solid ${t.accent}`
                            : "1px solid rgba(255,255,255,0.1)",
                          background: active
                            ? `rgba(${t.accentRgb}, 0.15)`
                            : "rgba(255,255,255,0.03)",
                          color: active ? t.accent : "rgba(255,255,255,0.7)",
                          fontFamily: "inherit",
                          transition: "all 0.15s",
                        }}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <button
                onClick={handleSendMessage}
                disabled={
                  !messageText.trim() ||
                  isSending ||
                  (!sendEmail && !sendSms) ||
                  recipientFilters.length === 0
                }
                style={{
                  width: "100%",
                  padding: "12px",
                  background: t.accent,
                  color: t.accentFg,
                  border: "none",
                  borderRadius: "10px",
                  fontFamily: "inherit",
                  fontSize: "14px",
                  fontWeight: 700,
                  cursor:
                    !messageText.trim() || isSending || (!sendEmail && !sendSms)
                      ? "not-allowed"
                      : "pointer",
                  opacity: !messageText.trim() || isSending || (!sendEmail && !sendSms) ? 0.5 : 1,
                  marginTop: "8px",
                }}
              >
                {isSending ? translate("sending") : translate("sendMessage")}
              </button>
            </>
          )}
        </SlideUp>
      )}

      {activePanel === "visibility" && (
        <SlideUp onClose={() => setActivePanel(null)} title={translate("eventVisibility")}>
          <p style={{ color: "rgba(255,255,255,0.6)", fontSize: "14px", marginBottom: "16px" }}>
            {translate("controlWhoCanFindViewEvent")}
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {VISIBILITY_OPTIONS.map(({ value, icon: Icon, label, description }) => {
              const isActive = visibility === value;
              return (
                <button
                  key={value}
                  onClick={() => handleVisibilityChange(value)}
                  disabled={visibilityPending}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "14px",
                    padding: "14px 16px",
                    borderRadius: "14px",
                    border: "none",
                    cursor: visibilityPending ? "not-allowed" : "pointer",
                    background: isActive ? t.accentBg : "rgba(255,255,255,0.05)",
                    outline: isActive ? `1.5px solid ${t.accentBorder}` : "1.5px solid transparent",
                    textAlign: "left",
                    fontFamily: "inherit",
                    transition: "all 0.15s",
                    opacity: visibilityPending && !isActive ? 0.5 : 1,
                  }}
                >
                  <Icon
                    size={20}
                    color={isActive ? t.accent : "rgba(255,255,255,0.5)"}
                    style={{ flexShrink: 0 }}
                  />
                  <div>
                    <div
                      style={{
                        fontSize: "14px",
                        fontWeight: 700,
                        color: isActive ? "#fff" : "rgba(255,255,255,0.75)",
                      }}
                    >
                      {label}
                    </div>
                    <div
                      style={{
                        fontSize: "12px",
                        color: "rgba(255,255,255,0.45)",
                        marginTop: "2px",
                      }}
                    >
                      {description}
                    </div>
                  </div>
                  {isActive && (
                    <div
                      style={{
                        marginLeft: "auto",
                        width: "18px",
                        height: "18px",
                        borderRadius: "50%",
                        background: t.accent,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                        <path
                          d="M1 4l3 3 5-6"
                          stroke={t.accentFg}
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
          <a
            href={`/e/${eventSlug}/settings?section=privacy`}
            style={{
              display: "block",
              textAlign: "center",
              marginTop: "16px",
              color: "rgba(255,255,255,0.35)",
              fontSize: "13px",
              textDecoration: "none",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLAnchorElement).style.color = "rgba(255,255,255,0.65)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLAnchorElement).style.color = "rgba(255,255,255,0.35)";
            }}
          >
            {translate("moreOptionsSettings")}
          </a>
        </SlideUp>
      )}

      {activePanel === "preview" && (
        <SlideUp onClose={() => setActivePanel(null)} title={translate("previewAsGuest")}>
          <p style={{ color: "rgba(255,255,255,0.6)", fontSize: "14px", marginBottom: "16px" }}>
            {translate("showsExactlyWhatGuestsSeeWhen")}
          </p>
          <button
            onClick={() => {
              window.open(window.location.href + "?preview=1", "_blank");
              setActivePanel(null);
            }}
            style={{
              width: "100%",
              padding: "12px",
              background: t.accent,
              color: t.accentFg,
              border: "none",
              borderRadius: "12px",
              fontFamily: "inherit",
              fontSize: "14px",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {translate("openGuestPreview")}
          </button>
        </SlideUp>
      )}
    </>
  );
}

function SlideUp({
  children,
  onClose,
  onOpen,
  title,
}: {
  children: React.ReactNode;
  onClose: () => void;
  onOpen?: () => void;
  title: string;
}) {
  // Call onOpen once when mounted
  const calledRef = React.useRef(false);
  React.useEffect(() => {
    if (!calledRef.current && onOpen) {
      calledRef.current = true;
      onOpen();
    }
  }, [onOpen]);

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 90 }}
      />
      {/* Panel */}
      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 95,
          background: "rgba(15,15,20,0.95)",
          backdropFilter: "blur(20px)",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: "24px 24px 0 0",
          padding: "24px 20px 40px",
          maxWidth: "480px",
          margin: "0 auto",
          color: "#fff",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "16px",
          }}
        >
          <h3 style={{ color: "#fff", fontWeight: 700, fontSize: "17px" }}>{title}</h3>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: "rgba(255,255,255,0.5)",
              cursor: "pointer",
              fontSize: "20px",
              padding: "4px",
            }}
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </>
  );
}
