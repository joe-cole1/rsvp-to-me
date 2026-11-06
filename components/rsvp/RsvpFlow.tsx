"use client";

import { useTranslations, useLocale } from "next-intl";
import { Button, buttonProps } from "@/components/ui/Button";
import { Check as CheckBox, Field, Input, Label, Select, Textarea } from "@/components/ui/Field";
import { InlineAlert } from "@/components/ui/Feedback";

import { useState, useTransition } from "react";
import { addRSVP, updateRSVP, updateRsvpAsHost } from "@/app/actions/event";
import type { ResolvedTheme } from "@/lib/theme";
import { Check } from "lucide-react";
import { EventAtmosphere } from "@/components/event/EventAtmosphere";
import type { EffectConfig } from "@/lib/effects";
import {
  RSVP_RESPONSE_STATUSES,
  RSVP_STATUS_EMOJIS,
  RsvpStatusChoice,
  type RsvpResponseStatus,
} from "./status";
import { useCaptcha } from "@/components/ui/CaptchaProvider";

type SessionUser = {
  email: string;
  name: string | null;
  avatarUrl: string | null;
  role: "GUEST" | "HOST" | "ADMIN";
};

type RsvpField = {
  id: string;
  label: string;
  fieldType: string;
  required: boolean;
  options: string | null;
};

const parseOptions = (optionsStr: string | null): string[] => {
  if (!optionsStr) return [];
  try {
    const parsed = JSON.parse(optionsStr);
    if (Array.isArray(parsed)) {
      return parsed.map(String);
    }
  } catch {
    // Fall back to newline splitting
  }
  return optionsStr
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
};

type EventData = {
  id: string;
  slug: string;
  title: string;
  startAt: Date;
  endAt: Date | null;
  timezone: string;
  locationName: string | null;
  plusOneAllowed: boolean;
  plusOneMax: number;
  plusOneNamesRequired: boolean;
  maybeEnabled: boolean;
  questionnaireEnabled: boolean;
  rsvpFields: RsvpField[];
  polls?: { id: string; question: string }[];
  potluckItems?: { id: string; label: string }[];
};

type ExistingRsvp = {
  id: string;
  editToken: string;
  guestName: string;
  status: "GOING" | "MAYBE" | "NO";
  plusOneCount: number;
  note: string | null;
  plusOneGuests: { name: string; order: number }[];
  answers: { rsvpFieldId: string; value: string }[];
  /** Whether the RSVP row has an email or phone; the contact itself stays server-side. */
  hasContact: boolean;
  responded: boolean;
};

export function RsvpFlow({
  event,
  theme,
  effect = null,
  initialStatus,
  existingRsvp,
  returnPath,
  channelConfig = { email: true, sms: true },
  organizerOverride = false,
  readOnlyReason,
}: {
  event: EventData;
  theme: ResolvedTheme;
  effect?: EffectConfig | null;
  initialStatus?: "GOING" | "MAYBE" | "NO";
  existingRsvp?: ExistingRsvp;
  returnPath?: string;
  sessionUser?: SessionUser | null;
  channelConfig?: { email: boolean; sms: boolean };
  organizerOverride?: boolean;
  readOnlyReason?: string;
}) {
  const notificationText = useTranslations("Ui.Notifications");
  const translate = useTranslations("Ui.Rsvp.RsvpFlow");
  const statusLabel = useTranslations("Ui.Rsvp.status");
  const locale = useLocale();

  const t = theme;
  const isEdit = !!existingRsvp;
  // An invited guest answers for the first time through their edit link. Pin
  // that at mount: the post-submit refresh marks the RSVP responded, which must
  // not flip the done screen to "updated".
  const [firstResponse] = useState(isEdit && !organizerOverride && !existingRsvp?.responded);
  const showUpdateCopy = isEdit && !firstResponse;

  const [step, setStep] = useState(1);
  const [status, setStatus] = useState<RsvpResponseStatus>(
    initialStatus ?? existingRsvp?.status ?? "GOING"
  );
  const [name, setName] = useState(existingRsvp?.guestName ?? "");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState(existingRsvp?.note ?? "");
  const [plusOneNames, setPlusOneNames] = useState<string[]>(
    existingRsvp?.plusOneGuests
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((g) => g.name) ?? []
  );
  const [answers, setAnswers] = useState<Record<string, string>>(
    existingRsvp
      ? Object.fromEntries(existingRsvp.answers.map((a) => [a.rsvpFieldId, a.value]))
      : {}
  );
  const [done, setDone] = useState(false);
  // After a create, the Server Action's automatic page refresh re-requests the
  // RSC payload with the new ?token= URL, so `existingRsvp` arrives on the next
  // render and flips `isEdit` while the success screen is showing. This flag
  // pins the "You're in!" heading for the RSVP created in this mount.
  const [justCreated, setJustCreated] = useState(false);
  const [savedEditToken, setSavedEditToken] = useState(existingRsvp?.editToken ?? "");
  const [linkCopied, setLinkCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const { runWithCaptcha } = useCaptcha();

  // Edit links reach guests through the contact on file (invitation or
  // confirmation), so only a contactless RSVP needs the copy-link fallback.
  const contactOnFile = existingRsvp ? existingRsvp.hasContact : !!(email.trim() || phone.trim());

  const hasQuestionnaire = status !== "NO" && event.rsvpFields.length > 0;
  const maxStep = hasQuestionnaire ? 2 : 1;

  const plusOneCount = status === "GOING" ? plusOneNames.length : 0;
  const plusOneGuestNames =
    status === "GOING"
      ? plusOneNames.map(
          (n, i) => n.trim() || translate("unnamedGuest", { number: i + 1, name: name.trim() })
        )
      : [];

  const setAnswerValue = (fieldId: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [fieldId]: value }));
  };

  const checkboxToggle = (fieldId: string, opt: string) => {
    const current = (answers[fieldId] ?? "").split(",").filter(Boolean);
    const checked = current.includes(opt);
    const next = checked ? current.filter((x) => x !== opt) : [...current, opt];
    setAnswerValue(fieldId, next.join(","));
  };

  const requiredUnanswered = event.rsvpFields.filter((f) => f.required && !answers[f.id]?.trim());

  const canProceedStep1 =
    name.trim().length > 0 &&
    (status !== "GOING" ||
      !event.plusOneNamesRequired ||
      plusOneNames.every((n) => n.trim().length > 0));

  const handleContinue = () => {
    if (step < maxStep) {
      setStep(2);
      return;
    }
    submit();
  };

  const submit = () => {
    startTransition(async () => {
      setError(null);
      try {
        if (isEdit && existingRsvp) {
          const input = {
            guestName: name.trim(),
            status,
            plusOneCount,
            plusOneGuestNames,
            note: note.trim() || undefined,
            answers,
          };
          const result = await runWithCaptcha("rsvp_edit", (token) =>
            organizerOverride
              ? updateRsvpAsHost(existingRsvp.id, input, token)
              : updateRSVP(existingRsvp.editToken, input, token)
          );
          if (!result.success) {
            setError(result.error ?? translate("somethingWentWrong"));
            return;
          }
        } else {
          const result = await runWithCaptcha("rsvp_create", (token) =>
            addRSVP(
              {
                eventId: event.id,
                guestName: name.trim(),
                guestEmail: email.trim() || undefined,
                guestPhone: phone.trim() || undefined,
                status,
                plusOneCount,
                plusOneGuestNames,
                note: note.trim() || undefined,
                answers,
              },
              token
            )
          );
          if (!result.success) {
            setError(result.error ?? translate("somethingWentWrong"));
            return;
          }
          setJustCreated(true);
          if (result.editToken) {
            setSavedEditToken(result.editToken);
            if (typeof window !== "undefined") {
              const url = new URL(window.location.href);
              url.searchParams.set("token", result.editToken);
              url.searchParams.delete("status");
              window.history.replaceState({}, "", url.toString());
            }
          }
        }
        setDone(true);
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : translate("somethingWentWrong"));
      }
    });
  };

  const dateStr = new Date(event.startAt).toLocaleDateString(locale, {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: event.timezone,
  });

  if (readOnlyReason && existingRsvp) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: t.pageBg,
          color: t.textPrimary,
          fontFamily: "inherit",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "77px 24px 24px",
          position: "relative",
          overflowX: "hidden",
        }}
      >
        <EventAtmosphere theme={t} effect={effect} />
        <div
          style={{
            width: "100%",
            maxWidth: "440px",
            background: t.cardBg,
            border: `1px solid ${t.cardBorder}`,
            borderRadius: t.cardRadius,
            padding: "28px 24px",
            position: "relative",
            zIndex: 1,
          }}
        >
          <div style={{ fontSize: "36px", marginBottom: "12px" }}>🔒</div>
          <h1 style={{ fontSize: "22px", fontWeight: 800, marginBottom: "8px" }}>
            {translate("rsvpEditingClosed")}
          </h1>
          <p style={{ color: t.textSecondary, fontSize: "14px", lineHeight: 1.6 }}>
            {readOnlyReason}
          </p>
          <div
            style={{
              marginTop: "20px",
              padding: "16px",
              background: t.inputBg,
              border: `1px solid ${t.inputBorder}`,
              borderRadius: "12px",
            }}
          >
            <div style={{ fontWeight: 700 }}>{existingRsvp.guestName}</div>
            <div style={{ color: t.textSecondary, marginTop: "4px", fontSize: "14px" }}>
              {translate("partySummary", {
                status: statusLabel(existingRsvp.status),
                count: 1 + existingRsvp.plusOneCount,
              })}
            </div>
            {existingRsvp.note && (
              <p style={{ color: t.textMuted, fontSize: "13px", margin: "10px 0 0" }}>
                {existingRsvp.note}
              </p>
            )}
          </div>
          <p>
            <a
              href={`/e/${event.slug}/notifications?token=${existingRsvp.editToken}`}
              {...buttonProps(t, { variant: "link", onGround: true })}
            >
              {notificationText("manageEvent")}
            </a>
          </p>
          <a
            href={`/e/${event.slug}?token=${existingRsvp.editToken}`}
            {...buttonProps(t, { variant: "primary", fullWidth: true })}
            style={{
              ...buttonProps(t, { variant: "primary", fullWidth: true }).style,
              marginTop: "20px",
            }}
          >
            {translate("returnEvent")}
          </a>
        </div>
      </div>
    );
  }

  // ── Done screen ────────────────────────────────────────────────────────
  if (done) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: t.pageBg,
          color: t.textPrimary,
          fontFamily: "inherit",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "77px 24px 24px",
          position: "relative",
          overflowX: "hidden",
        }}
      >
        <EventAtmosphere theme={t} effect={effect} />
        <div
          style={{
            width: "100%",
            maxWidth: "400px",
            textAlign: "center",
            position: "relative",
            zIndex: 1,
          }}
        >
          <div style={{ fontSize: "52px", marginBottom: "16px" }}>{RSVP_STATUS_EMOJIS[status]}</div>
          <h2 style={{ fontSize: "22px", fontWeight: 800, marginBottom: "8px" }}>
            {showUpdateCopy && !justCreated
              ? translate("rsvpUpdated")
              : status === "GOING"
                ? translate("re")
                : status === "MAYBE"
                  ? translate("noted")
                  : translate("got")}
          </h2>
          <p style={{ color: t.textSecondary, fontSize: "15px", marginBottom: "28px" }}>
            {status === "GOING"
              ? translate("seeThere")
              : status === "MAYBE"
                ? translate("hopeCanMake")
                : translate("sorryCanTMake")}
          </p>
          {savedEditToken && !organizerOverride && (
            <p style={{ fontSize: 14, marginBottom: 24 }}>
              <a
                href={`/e/${event.slug}/notifications?token=${savedEditToken}`}
                {...buttonProps(t, { variant: "link", onGround: true })}
              >
                {notificationText("manageEvent")}
              </a>
              <br />
              <a
                href={`/e/${event.slug}/rsvp?token=${savedEditToken}`}
                {...buttonProps(t, { variant: "link", onGround: true })}
              >
                {notificationText("saveEditLink")}
              </a>
            </p>
          )}
          {/* An answer added to an invitation: its private link goes only to the invited contact. */}
          {!savedEditToken && contactOnFile && !organizerOverride && (
            <p
              style={{
                fontSize: "13px",
                color: t.textSecondary,
                margin: "0 0 24px",
                lineHeight: 1.5,
              }}
            >
              {translate("editLinkOnFile")}
            </p>
          )}
          {!contactOnFile && savedEditToken && (
            <div
              style={{
                background: t.inputBg,
                border: `1px solid ${t.cardBorder}`,
                borderRadius: "12px",
                padding: "16px",
                marginBottom: "24px",
                textAlign: "left",
              }}
            >
              <div
                style={{
                  fontSize: "12px",
                  fontWeight: 700,
                  textTransform: "none",
                  color: t.accentText,
                  marginBottom: "8px",
                }}
              >
                {translate(organizerOverride ? "guestEditLink" : "saveEditLink")}
              </div>
              <p
                style={{
                  fontSize: "13px",
                  color: t.textSecondary,
                  margin: "0 0 12px",
                  lineHeight: 1.5,
                }}
              >
                {translate(organizerOverride ? "guestHasNoContact" : "sinceDidnTAddEmailOr")}
              </p>
              <div style={{ display: "flex", gap: "8px" }}>
                <Input
                  theme={t}
                  aria-label={translate(organizerOverride ? "guestEditLink" : "saveEditLink")}
                  style={{ flex: 1, width: "auto", fontSize: "13px" }}
                  readOnly
                  value={`${typeof window !== "undefined" ? window.location.origin : ""}/e/${event.slug}?token=${savedEditToken}`}
                />
                <Button
                  theme={t}
                  variant="secondary"
                  onClick={() => {
                    if (typeof navigator !== "undefined") {
                      navigator.clipboard.writeText(
                        `${window.location.origin}/e/${event.slug}?token=${savedEditToken}`
                      );
                      setLinkCopied(true);
                      setTimeout(() => setLinkCopied(false), 2000);
                    }
                  }}
                  style={{ whiteSpace: "nowrap" }}
                >
                  {linkCopied ? <Check size={14} aria-hidden="true" /> : null}
                  {linkCopied ? translate("copied") : translate("copy")}
                </Button>
              </div>
            </div>
          )}
          {(status === "GOING" || status === "MAYBE") &&
            ((event.polls && event.polls.length > 0) ||
              (event.potluckItems && event.potluckItems.length > 0)) && (
              <div
                style={{
                  background: t.inputBg,
                  border: `1px solid ${t.cardBorder}`,
                  borderRadius: "12px",
                  padding: "16px",
                  marginBottom: "24px",
                  textAlign: "left",
                }}
              >
                <div
                  style={{
                    fontSize: "12px",
                    fontWeight: 700,
                    textTransform: "none",
                    color: t.accentText,
                    marginBottom: "12px",
                  }}
                >
                  {translate("nextSteps")}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {event.polls && event.polls.length > 0 && (
                    <a
                      href={`/e/${event.slug}${savedEditToken ? `?token=${savedEditToken}` : ""}#polls`}
                      {...buttonProps(t, { variant: "secondary", fullWidth: true })}
                      style={{
                        ...buttonProps(t, { variant: "secondary", fullWidth: true }).style,
                        justifyContent: "space-between",
                      }}
                    >
                      <span>{translate("votePolls")}</span>
                      <span aria-hidden="true">→</span>
                    </a>
                  )}
                  {event.potluckItems && event.potluckItems.length > 0 && (
                    <a
                      href={`/e/${event.slug}${savedEditToken ? `?token=${savedEditToken}` : ""}#potluck`}
                      {...buttonProps(t, { variant: "secondary", fullWidth: true })}
                      style={{
                        ...buttonProps(t, { variant: "secondary", fullWidth: true }).style,
                        justifyContent: "space-between",
                      }}
                    >
                      <span>{translate("bringSomethingPotluck")}</span>
                      <span aria-hidden="true">→</span>
                    </a>
                  )}
                </div>
              </div>
            )}
          <a
            href={
              returnPath ?? `/e/${event.slug}${savedEditToken ? `?token=${savedEditToken}` : ""}`
            }
            {...buttonProps(t, { variant: "primary", fullWidth: true })}
          >
            {returnPath ? translate("backGuestList") : translate("backEvent")}
          </a>
        </div>
      </div>
    );
  }

  // ── Shared layout wrapper ─────────────────────────────────────────────────────
  const S = {
    page: {
      minHeight: "100vh",
      background: t.pageBg,
      color: t.textPrimary,
      fontFamily: "inherit",
      paddingBottom: "80px",
      position: "relative",
      overflowX: "hidden",
    } as React.CSSProperties,
    header: {
      padding: "70px 20px 0",
      maxWidth: "600px",
      margin: "0 auto",
      position: "relative",
      zIndex: 1,
    } as React.CSSProperties,
    body: {
      maxWidth: "600px",
      margin: "0 auto",
      padding: "24px 20px 0",
      position: "relative",
      zIndex: 1,
    } as React.CSSProperties,
    footer: {
      position: "fixed",
      bottom: 0,
      left: 0,
      right: 0,
      background: t.pageBg,
      borderTop: `1px solid ${t.cardBorder}`,
      padding: "14px 20px",
      display: "flex",
      gap: "10px",
      justifyContent: "flex-end",
      zIndex: 50,
    } as React.CSSProperties,
    group: { marginBottom: "20px" } as React.CSSProperties,
  };

  // ── Step 1: Details ─────────────────────────────────────────────────────────
  if (step === 1) {
    return (
      <div style={S.page}>
        <EventAtmosphere theme={t} effect={effect} />
        <div style={S.header}>
          <p style={{ margin: 0, padding: "12px 0", fontSize: "14px" }}>
            <a
              href={`/e/${event.slug}${savedEditToken ? `?token=${savedEditToken}` : ""}`}
              {...buttonProps(t, { variant: "link", onGround: true })}
            >
              {translate("back")}
            </a>
          </p>
          {existingRsvp && !organizerOverride && (
            <p>
              <a
                href={`/e/${event.slug}/notifications?token=${existingRsvp.editToken}`}
                {...buttonProps(t, { variant: "link", onGround: true })}
              >
                {notificationText("manageEvent")}
              </a>
            </p>
          )}
          <div style={{ marginBottom: "20px" }}>
            <div
              style={{
                fontSize: "12px",
                fontWeight: 700,
                textTransform: "none",
                letterSpacing: "0.02em",
                color: t.accentText,
                marginBottom: "4px",
              }}
            >
              {showUpdateCopy ? translate("updateRsvp") : translate("rsvp")}
            </div>
            <h1 style={{ fontSize: "22px", fontWeight: 800, margin: "0 0 4px", lineHeight: 1.2 }}>
              {event.title}
            </h1>
            <p style={{ color: t.textSecondary, fontSize: "14px", margin: 0 }}>
              {dateStr}
              {event.locationName ? ` · ${event.locationName}` : ""}
            </p>
          </div>
        </div>

        <div style={S.body}>
          {/* Status buttons */}
          <div style={{ ...S.group }}>
            <div style={{ display: "flex", gap: "10px" }}>
              {RSVP_RESPONSE_STATUSES.filter(
                (responseStatus) => responseStatus !== "MAYBE" || event.maybeEnabled
              ).map((responseStatus) => (
                <RsvpStatusChoice
                  key={responseStatus}
                  status={responseStatus}
                  active={status === responseStatus}
                  theme={t}
                  onClick={() => setStatus(responseStatus)}
                />
              ))}
            </div>
          </div>

          {/* RSVP as */}
          <div style={S.group}>
            <Label theme={t}>{translate("rsvpAs")}</Label>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <Input
                theme={t}
                placeholder={translate("nameRequired")}
                aria-label={translate("nameRequired")}
                maxLength={100}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              {!isEdit && (
                <>
                  {channelConfig.email && (
                    <Input
                      theme={t}
                      type="email"
                      aria-label={translate("emailOptionalUpdates")}
                      placeholder={translate("emailOptionalUpdates")}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  )}
                  {channelConfig.sms && (
                    <Input
                      theme={t}
                      type="tel"
                      aria-label={translate("phoneOptionalSmsUpdates")}
                      placeholder={translate("phoneOptionalSmsUpdates")}
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                    />
                  )}
                </>
              )}
            </div>
          </div>

          {/* Attendee Count dropdown — only for GOING */}
          {event.plusOneAllowed && event.plusOneMax > 0 && status === "GOING" && (
            <Field theme={t} label={translate("attendeeCount")} style={S.group}>
              <Select
                theme={t}
                value={plusOneNames.length + 1}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  const count = val - 1;
                  setPlusOneNames((prev) => {
                    if (prev.length === count) return prev;
                    if (prev.length < count) {
                      return [...prev, ...Array(count - prev.length).fill("")];
                    } else {
                      return prev.slice(0, count);
                    }
                  });
                }}
              >
                {Array.from({ length: event.plusOneMax + 1 }, (_, i) => (
                  <option key={i + 1} value={i + 1}>
                    {i + 1}{" "}
                    {i + 1 === 1
                      ? translate("justMe")
                      : translate("partyOption", { total: i + 1, count: i })}
                  </option>
                ))}
              </Select>
            </Field>
          )}

          {/* Plus One Names Inputs */}
          {event.plusOneAllowed &&
            event.plusOneMax > 0 &&
            status === "GOING" &&
            plusOneNames.length > 0 && (
              <div style={S.group}>
                <Label theme={t}>
                  {translate("plusOneNames")}{" "}
                  <span style={{ fontWeight: 400 }}>
                    {event.plusOneNamesRequired ? translate("required") : translate("optional")}
                  </span>
                </Label>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {plusOneNames.map((n, i) => (
                    <Input
                      key={i}
                      theme={t}
                      aria-label={translate("plusOnePlaceholder", {
                        number: i + 1,
                        required: event.plusOneNamesRequired ? "yes" : "no",
                      })}
                      placeholder={translate("plusOnePlaceholder", {
                        number: i + 1,
                        required: event.plusOneNamesRequired ? "yes" : "no",
                      })}
                      value={n}
                      onChange={(e) => {
                        const next = [...plusOneNames];
                        next[i] = e.target.value;
                        setPlusOneNames(next);
                      }}
                    />
                  ))}
                </div>
                <p style={{ fontSize: "13px", color: t.textSecondary, margin: "8px 0 0" }}>
                  {translate("notePlusOneNamesPublic")}
                </p>
              </div>
            )}

          {/* Note */}
          <Field theme={t} label={translate("messageOptionalPublic")} style={S.group}>
            <Textarea
              theme={t}
              style={{ resize: "none" }}
              rows={3}
              placeholder={translate("leaveNote")}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </Field>

          {error && <InlineAlert theme={t}>{error}</InlineAlert>}
        </div>

        <div style={S.footer}>
          <a
            href={`/e/${event.slug}${savedEditToken ? `?token=${savedEditToken}` : ""}`}
            {...buttonProps(t, { variant: "secondary" })}
          >
            {translate("cancel")}
          </a>
          <Button
            theme={t}
            variant="primary"
            onClick={handleContinue}
            disabled={!canProceedStep1 || isPending}
          >
            {isPending
              ? translate("saving")
              : step < maxStep
                ? translate("continue")
                : showUpdateCopy
                  ? translate("updateRsvp")
                  : translate("confirmRsvp")}
          </Button>
        </div>
      </div>
    );
  }

  // ── Step 2: Questionnaire ──────────────────────────────────────────────────────────
  return (
    <div style={S.page}>
      <EventAtmosphere theme={t} effect={effect} />
      <div style={S.header}>
        <p style={{ margin: 0, padding: "12px 0", fontSize: "14px" }}>
          <Button theme={t} variant="link" onGround onClick={() => setStep(1)}>
            {translate("back")}
          </Button>
        </p>
        <div style={{ marginBottom: "8px" }}>
          <h1 style={{ fontSize: "20px", fontWeight: 800, margin: "0 0 4px" }}>
            {translate("questionsHost")}
          </h1>
          <p style={{ color: t.textMuted, fontSize: "13px", margin: 0 }}>
            {translate("onlyHostCanSeeAnswers")}
          </p>
        </div>
      </div>

      <div style={S.body}>
        {event.rsvpFields.map((f) => (
          <div key={f.id} style={{ marginBottom: "20px" }}>
            {f.fieldType === "CHECKBOX" ? (
              <>
                <Label theme={t}>
                  {f.label}
                  {f.required && (
                    <span style={{ fontWeight: 400, marginLeft: "4px" }}>
                      {translate("required3")}
                    </span>
                  )}
                </Label>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {parseOptions(f.options).map((opt) => (
                    <label
                      key={opt}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        cursor: "pointer",
                        fontSize: "14px",
                      }}
                    >
                      <CheckBox
                        theme={t}
                        checked={(answers[f.id] ?? "").split(",").includes(opt)}
                        onChange={() => checkboxToggle(f.id, opt)}
                      />
                      {opt}
                    </label>
                  ))}
                </div>
              </>
            ) : (
              <Field
                theme={t}
                label={
                  <>
                    {f.label}
                    {f.required && (
                      <span style={{ fontWeight: 400, marginLeft: "4px" }}>
                        {translate("required3")}
                      </span>
                    )}
                  </>
                }
                style={{ marginBottom: 0 }}
              >
                {f.fieldType === "TEXTAREA" ? (
                  <Textarea
                    theme={t}
                    style={{ resize: "none" }}
                    rows={3}
                    value={answers[f.id] ?? ""}
                    onChange={(e) => setAnswerValue(f.id, e.target.value)}
                  />
                ) : f.fieldType === "SELECT" ? (
                  <Select
                    theme={t}
                    value={answers[f.id] ?? ""}
                    onChange={(e) => setAnswerValue(f.id, e.target.value)}
                  >
                    <option value="">{translate("select")}</option>
                    {parseOptions(f.options).map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </Select>
                ) : (
                  <Input
                    theme={t}
                    value={answers[f.id] ?? ""}
                    onChange={(e) => setAnswerValue(f.id, e.target.value)}
                  />
                )}
              </Field>
            )}
          </div>
        ))}

        {error && <InlineAlert theme={t}>{error}</InlineAlert>}
      </div>

      <div style={S.footer}>
        <Button theme={t} variant="secondary" onClick={() => setStep(1)}>
          {translate("back")}
        </Button>
        <Button
          theme={t}
          variant="primary"
          onClick={submit}
          disabled={requiredUnanswered.length > 0 || isPending}
        >
          {isPending
            ? translate("saving")
            : showUpdateCopy
              ? translate("updateRsvp")
              : translate("submit")}
        </Button>
      </div>
    </div>
  );
}
