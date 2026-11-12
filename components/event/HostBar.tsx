"use client";

import { useTranslations } from "next-intl";

import React, { useEffect, useReducer, useState } from "react";
import { Mail, MessageSquare, Settings, Eye, Globe, Link2, Lock, Check, X } from "lucide-react";
import { APP_SHELL, chromeTheme, type ResolvedTheme } from "@/lib/theme";
import { sendBlast, sendSmsBlast, saveEventSettings } from "@/app/actions/event";
import Image from "next/image";
import QRCode from "qrcode";
import { useCaptcha } from "@/components/ui/CaptchaProvider";

import { Dialog } from "@/components/ui/Dialog";
import { Button, buttonProps } from "@/components/ui/Button";
import { Chip, choiceTileStyle } from "@/components/ui/Choice";
import { Check as CheckBox, Label, Textarea } from "@/components/ui/Field";
import { InlineAlert } from "@/components/ui/Feedback";
import { emptyInvitationDraft, invitationDraftReducer } from "@/lib/invitation-draft-rows";
import { guestPreviewUrl } from "@/lib/admin-moderation";
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
  // The bar, its dialog and sheets are app chrome: the dark shell with the event's accent.
  const ct = chromeTheme(t);

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
            background: APP_SHELL.chromeSurface,
            backdropFilter: "blur(20px)",
            border: `1px solid ${ct.cardBorder}`,
            borderRadius: "999px",
            padding: "6px 8px",
            display: "flex",
            gap: "2px",
            zIndex: 100,
            boxShadow: APP_SHELL.chromeShadow,
            // Never wider than the screen: longer languages scroll inside the bar.
            boxSizing: "border-box",
            maxWidth: "calc(100vw - 16px)",
            overflowX: "auto",
            scrollbarWidth: "none",
          }}
        >
          {actions.map(({ id, icon: Icon, label, href }) =>
            href ? (
              <a key={id} href={href} {...buttonProps(ct, { variant: "toolbar" })}>
                <Icon size={18} aria-hidden="true" />
                {label}
              </a>
            ) : (
              <Button
                key={id}
                theme={ct}
                variant="toolbar"
                type="button"
                onClick={() => setActivePanel(activePanel === id ? null : id)}
              >
                <Icon size={18} aria-hidden="true" />
                {label}
              </Button>
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
            background: APP_SHELL.chromeSurface,
            color: ct.textPrimary,
            padding: "24px",
            borderRadius: "20px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2 id="invitation-dialog-title" style={{ fontSize: "20px", fontWeight: 700 }}>
              {translate("inviteGuests")}
            </h2>
            <Button
              theme={ct}
              variant="icon"
              type="button"
              onClick={() => setActivePanel(null)}
              aria-label={translate("close")}
            >
              <X size={20} aria-hidden="true" />
            </Button>
          </div>
          <div
            role="tablist"
            aria-label={translate("inviteTabs")}
            style={{
              display: "flex",
              gap: "4px",
              margin: "12px 0 18px",
              borderBottom: `1px solid ${ct.inputBorder}`,
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
                  className="rsvp-control"
                  style={
                    {
                      "--rsvp-focus": ct.accent,
                      minHeight: "44px",
                      padding: "10px 14px",
                      marginBottom: "-1px",
                      border: "none",
                      borderBottom: `2px solid ${selected ? ct.accent : "transparent"}`,
                      background: "transparent",
                      color: selected ? ct.textPrimary : ct.textSecondary,
                      font: "inherit",
                      fontSize: "14px",
                      fontWeight: 700,
                      cursor: "pointer",
                    } as React.CSSProperties
                  }
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
                <p style={{ color: ct.textSecondary, fontSize: "14px" }}>
                  {translate("messagingNotConfiguredServerShareEvent")}
                </p>
              ) : (
                <InvitationComposer
                  eventId={eventId}
                  channelConfig={channelConfig}
                  theme={ct}
                  draft={inviteDraft}
                  dispatch={dispatchInvite}
                />
              )
            ) : visibility === "PRIVATE" ? (
              <div
                style={{
                  border: `1px solid ${ct.inputBorder}`,
                  borderRadius: "12px",
                  padding: "16px",
                  marginBottom: "16px",
                  textAlign: "center",
                }}
              >
                <p
                  style={{
                    color: ct.textSecondary,
                    fontSize: "14px",
                    marginBottom: "10px",
                    lineHeight: 1.6,
                  }}
                >
                  {translate("privateEventGuestsMustInvitedDirectly")}
                </p>
                <a
                  href={`/e/${eventSlug}/settings?section=privacy`}
                  {...buttonProps(ct, { variant: "link" })}
                >
                  {translate("changeDisplayOptions")}
                </a>
              </div>
            ) : (
              <>
                <p style={{ color: ct.textSecondary, fontSize: "14px", marginBottom: "16px" }}>
                  {translate("shareEventLinkOrSendInvites")}
                </p>
                <div
                  style={{
                    background: ct.inputBg,
                    border: `1px solid ${ct.inputBorder}`,
                    borderRadius: "10px",
                    padding: "10px 14px",
                    fontSize: "14px",
                    marginBottom: "12px",
                    wordBreak: "break-all",
                    color: ct.textPrimary,
                  }}
                >
                  {typeof window !== "undefined" ? window.location.href : ""}
                </div>
                <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
                  <Button
                    theme={ct}
                    variant="primary"
                    onClick={() => {
                      if (typeof navigator !== "undefined") {
                        navigator.clipboard.writeText(window.location.href);
                        setCopiedLink(true);
                        setTimeout(() => setCopiedLink(false), 2000);
                      }
                    }}
                    style={{ flex: 1 }}
                  >
                    {copiedLink ? <Check size={16} aria-hidden="true" /> : null}
                    {copiedLink ? translate("copied") : translate("copyLink")}
                  </Button>
                  {qrDataUrl && (
                    <a
                      href={qrDataUrl}
                      download="event-qr.png"
                      {...buttonProps(ct, { variant: "secondary" })}
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
          theme={ct}
          closeLabel={translate("close")}
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
                color: ct.textSecondary,
              }}
            >
              {translate("messagingNotConfiguredServerEnableEmail")}
            </div>
          ) : (
            <>
              <Textarea
                theme={ct}
                rows={4}
                aria-label={translate("messageGuests")}
                placeholder={translate("typeMessage")}
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                style={{ resize: "none", marginBottom: "12px" }}
              />

              {blastResult && (
                <InlineAlert theme={ct} tone={blastSucceeded ? "success" : "error"}>
                  {blastResult}
                </InlineAlert>
              )}

              {/* Channel selection */}
              {(channelConfig.email || channelConfig.sms) && (
                <div style={{ marginBottom: "16px" }}>
                  <Label theme={ct}>{translate("deliveryChannels")}</Label>
                  <div style={{ display: "flex", gap: "20px", alignItems: "center" }}>
                    {channelConfig.email && (
                      <label
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          fontSize: "14px",
                          cursor: "pointer",
                          color: ct.textPrimary,
                        }}
                      >
                        <CheckBox
                          theme={ct}
                          checked={sendEmail}
                          onChange={(e) => setSendEmail(e.target.checked)}
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
                          color: ct.textPrimary,
                        }}
                      >
                        <CheckBox
                          theme={ct}
                          checked={sendSms}
                          onChange={(e) => setSendSms(e.target.checked)}
                        />
                        <span>{translate("sms")}</span>
                      </label>
                    )}
                  </div>
                </div>
              )}

              {/* Recipient selection */}
              <div style={{ marginBottom: "20px" }}>
                <Label theme={ct}>{translate("recipients")}</Label>
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
                      <Chip
                        key={key}
                        theme={ct}
                        selected={active}
                        onClick={() => toggleRecipientFilter(key)}
                      >
                        {label}
                      </Chip>
                    );
                  })}
                </div>
              </div>

              <Button
                theme={ct}
                variant="primary"
                fullWidth
                onClick={handleSendMessage}
                disabled={
                  !messageText.trim() ||
                  isSending ||
                  (!sendEmail && !sendSms) ||
                  recipientFilters.length === 0
                }
                style={{ marginTop: "8px" }}
              >
                {isSending ? translate("sending") : translate("sendMessage")}
              </Button>
            </>
          )}
        </SlideUp>
      )}

      {activePanel === "visibility" && (
        <SlideUp
          theme={ct}
          closeLabel={translate("close")}
          onClose={() => setActivePanel(null)}
          title={translate("eventVisibility")}
        >
          <p style={{ color: ct.textSecondary, fontSize: "14px", marginBottom: "16px" }}>
            {translate("controlWhoCanFindViewEvent")}
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {VISIBILITY_OPTIONS.map(({ value, icon: Icon, label, description }) => {
              const isActive = visibility === value;
              return (
                <button
                  key={value}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => handleVisibilityChange(value)}
                  disabled={visibilityPending}
                  className="rsvp-control rsvp-press"
                  style={{
                    ...choiceTileStyle(ct, isActive, visibilityPending && !isActive),
                    flexDirection: "row",
                    justifyContent: "flex-start",
                    gap: "14px",
                    padding: "14px 16px",
                    borderRadius: "14px",
                    textAlign: "left",
                  }}
                >
                  <Icon
                    size={20}
                    color={isActive ? ct.accent : ct.textSecondary}
                    style={{ flexShrink: 0 }}
                    aria-hidden="true"
                  />
                  <div>
                    <div style={{ fontSize: "14px", fontWeight: 700, color: ct.textPrimary }}>
                      {label}
                    </div>
                    <div style={{ fontSize: "13px", color: ct.textSecondary, marginTop: "2px" }}>
                      {description}
                    </div>
                  </div>
                  {isActive && (
                    <div
                      aria-hidden="true"
                      style={{
                        marginLeft: "auto",
                        width: "18px",
                        height: "18px",
                        borderRadius: "50%",
                        background: ct.accent,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                        <path
                          d="M1 4l3 3 5-6"
                          stroke={ct.accentFg}
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
          <p style={{ textAlign: "center", margin: "16px 0 0", fontSize: "13px" }}>
            <a
              href={`/e/${eventSlug}/settings?section=privacy`}
              {...buttonProps(ct, { variant: "link" })}
            >
              {translate("moreOptionsSettings")}
            </a>
          </p>
        </SlideUp>
      )}

      {activePanel === "preview" && (
        <SlideUp
          theme={ct}
          closeLabel={translate("close")}
          onClose={() => setActivePanel(null)}
          title={translate("previewAsGuest")}
        >
          <p style={{ color: ct.textSecondary, fontSize: "14px", marginBottom: "16px" }}>
            {translate("showsExactlyWhatGuestsSeeWhen")}
          </p>
          <Button
            theme={ct}
            variant="primary"
            fullWidth
            onClick={() => {
              window.open(guestPreviewUrl(window.location.href), "_blank");
              setActivePanel(null);
            }}
          >
            {translate("openGuestPreview")}
          </Button>
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
  theme,
  closeLabel,
}: {
  children: React.ReactNode;
  onClose: () => void;
  onOpen?: () => void;
  title: string;
  theme: ResolvedTheme;
  closeLabel: string;
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
        style={{ position: "fixed", inset: 0, background: APP_SHELL.chromeBackdrop, zIndex: 90 }}
      />
      {/* Panel */}
      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 95,
          background: APP_SHELL.chromeSurface,
          backdropFilter: "blur(20px)",
          border: `1px solid ${theme.cardBorder}`,
          borderRadius: "24px 24px 0 0",
          padding: "24px 20px 40px",
          maxWidth: "480px",
          margin: "0 auto",
          color: theme.textPrimary,
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
          <h3 style={{ color: theme.textPrimary, fontWeight: 700, fontSize: "17px" }}>{title}</h3>
          <Button theme={theme} variant="icon" onClick={onClose} aria-label={closeLabel}>
            <X size={20} aria-hidden="true" />
          </Button>
        </div>
        {children}
      </div>
    </>
  );
}
