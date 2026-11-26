"use client";

import { useTranslations, useLocale } from "next-intl";
import { Button, buttonProps } from "@/components/ui/Button";
import { Field, Input, Label, Select, Textarea } from "@/components/ui/Field";
import { InlineAlert } from "@/components/ui/Feedback";

import { useEffect, useRef, useState, useTransition } from "react";
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
import { RsvpContactVerification } from "./RsvpContactVerification";
import { EventTitleBlock } from "@/components/event/event-page/EventTitleBlock";
import {
  isFieldVisibleForRsvpStatus,
  validateQuestionnaireFieldsClient,
  type StructuredAddress,
} from "@/lib/rsvp-fields";
import { QuestionnaireFieldInput } from "./QuestionnaireFieldInput";
import { normalizePhone } from "@/lib/phone";
import type { RsvpContactReceipt } from "@/lib/rsvp-contact-proof";

type SessionUser = {
  email: string;
  name: string | null;
  avatarUrl: string | null;
  role: "GUEST" | "HOST" | "ADMIN";
};

type RsvpField = {
  id: string;
  label: string;
  description?: string | null;
  fieldType: string;
  required: boolean;
  goingOnly?: boolean;
  options: string | null;
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
  returnSection,
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
  returnSection?: "potluck" | "polls";
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
  const [verifying, setVerifying] = useState(false);
  const [contactProofs, setContactProofs] = useState<{
    key: string;
    proofs: RsvpContactReceipt[];
  } | null>(null);
  const contacts = [
    ...(email.trim()
      ? [{ channel: "email" as const, destination: email.trim().toLowerCase() }]
      : []),
    ...(phone.trim() ? [{ channel: "sms" as const, destination: normalizePhone(phone) }] : []),
  ];
  const contactKey = JSON.stringify([event.id, contacts]);
  const verified = contactProofs?.key === contactKey;

  // After a create, the Server Action's automatic page refresh re-requests the
  // RSC payload with the new ?token= URL, so `existingRsvp` arrives on the next
  // render and flips `isEdit` while the success screen is showing. This flag
  // pins the "You're in!" heading for the RSVP created in this mount.
  const [justCreated, setJustCreated] = useState(false);
  const [savedEditToken, setSavedEditToken] = useState(existingRsvp?.editToken ?? "");
  const [linkCopied, setLinkCopied] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [subFieldErrors, setSubFieldErrors] = useState<Record<string, string>>({});
  const focusInvalid = useRef(false);
  useEffect(() => {
    if (focusInvalid.current) {
      formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
      focusInvalid.current = false;
    }
  }, [fieldErrors, subFieldErrors]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const { runWithCaptcha } = useCaptcha();
  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  const clearFieldError = (key: string) => {
    setFieldErrors((previous) => {
      if (!previous[key]) return previous;
      const next = { ...previous };
      delete next[key];
      return next;
    });
  };

  // Edit links reach guests through the contact on file (invitation or
  // confirmation), so only a contactless RSVP needs the copy-link fallback.
  const contactOnFile = existingRsvp ? existingRsvp.hasContact : !!(email.trim() || phone.trim());

  const visibleFields = event.rsvpFields.filter((f) => isFieldVisibleForRsvpStatus(f, status));
  const hasQuestionnaire = visibleFields.length > 0;
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
    clearFieldError(fieldId);
  };

  const clearAddressSubFieldError = (fieldId: string, part: keyof StructuredAddress) => {
    const key = `${fieldId}:${part}`;
    setSubFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      const prefix = `${fieldId}:`;
      if (!Object.keys(next).some((k) => k.startsWith(prefix))) {
        clearFieldError(fieldId);
      }
      return next;
    });
  };

  const validateDetails = () => {
    const errors: Record<string, string> = {};
    if (!name.trim()) errors.name = translate("nameRequiredError");
    const emailInput = formRef.current?.elements.namedItem("email") as HTMLInputElement | null;
    if (email.trim() && emailInput && !emailInput.validity.valid)
      errors.email = translate("emailInvalidError");
    if (status === "GOING" && event.plusOneNamesRequired) {
      plusOneNames.forEach((value, i) => {
        if (!value.trim()) errors[`guest-${i}`] = translate("requiredFieldError");
      });
    }
    setFieldErrors(errors);
    setSubFieldErrors({});
    focusInvalid.current = Object.keys(errors).length > 0;
    return Object.keys(errors).length === 0;
  };

  const handleContinue = () => {
    setError(null);
    if (!validateDetails()) return;
    if (step < maxStep) {
      setStep(2);
      return;
    }
    submit();
  };

  const submit = () => {
    if (step === 2) {
      const validation = validateQuestionnaireFieldsClient(visibleFields, answers, {
        questionnaireFieldRequired: translate("requiredFieldError"),
        questionnaireInvalidOption: translate("invalidOptionError"),
        invalidPhone: translate("invalidPhoneError"),
        addressIncomplete: translate("addressIncompleteError"),
        termsRequired: translate("termsRequiredError"),
      });
      setFieldErrors(validation.fieldErrors);
      setSubFieldErrors(validation.subFieldErrors);
      const hasErrors =
        Object.keys(validation.fieldErrors).length > 0 ||
        Object.keys(validation.subFieldErrors).length > 0;
      focusInvalid.current = hasErrors;
      if (hasErrors) return;
    }
    if (!isEdit && contacts.length && !verified) {
      setVerifying(true);
      return;
    }
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
              token,
              ...(contacts.length ? [contactProofs?.proofs] : [])
            )
          );
          if (!result.success) {
            if ("verificationRequired" in result && result.verificationRequired)
              setContactProofs(null);
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
          {(() => {
            const showPollsNextStep =
              Boolean(event.polls && event.polls.length > 0) && returnSection !== "polls";
            const showPotluckNextStep =
              status === "GOING" &&
              Boolean(event.potluckItems && event.potluckItems.length > 0) &&
              returnSection !== "potluck";
            if (
              (status !== "GOING" && status !== "MAYBE") ||
              (!showPollsNextStep && !showPotluckNextStep)
            ) {
              return null;
            }
            return (
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
                  {showPollsNextStep && (
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
                  {showPotluckNextStep && (
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
            );
          })()}
          {(() => {
            const defaultEventHref = `/e/${event.slug}${savedEditToken ? `?token=${savedEditToken}` : ""}${returnSection ? `#${returnSection}` : ""}`;
            const primaryHref = returnPath ?? defaultEventHref;
            const primaryLabel = returnPath
              ? translate("backGuestList")
              : returnSection === "potluck"
                ? translate("backPotluck")
                : returnSection === "polls"
                  ? translate("backPolls")
                  : translate("backEvent");
            return (
              <a href={primaryHref} {...buttonProps(t, { variant: "primary", fullWidth: true })}>
                {primaryLabel}
              </a>
            );
          })()}
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

  if (verifying && !isEdit) {
    return (
      <div style={S.page}>
        <EventAtmosphere theme={t} effect={effect} />
        <div style={S.header}>
          <EventTitleBlock theme={t} title={event.title} />
        </div>
        <div style={S.body}>
          <RsvpContactVerification
            eventId={event.id}
            contacts={contacts}
            theme={t}
            onBack={() => setVerifying(false)}
            onVerified={(proofs) => {
              setContactProofs({ key: contactKey, proofs });
              setStep(1);
              setVerifying(false);
            }}
          />
        </div>
      </div>
    );
  }

  // ── Step 1: Details ─────────────────────────────────────────────────────────
  if (step === 1) {
    return (
      <form
        ref={formRef}
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          handleContinue();
        }}
        style={S.page}
      >
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
          {returnSection === "potluck" && (
            <div style={{ marginBottom: "16px" }}>
              <InlineAlert theme={t} tone="info" style={{ marginBottom: 0 }}>
                {translate("potluckGoingBanner")}
              </InlineAlert>
            </div>
          )}
          {!isEdit && verified && (
            <InlineAlert theme={t} tone="success">
              {translate("verifiedReview")}
            </InlineAlert>
          )}
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
              <Field
                theme={t}
                label={translate("nameRequired")}
                error={fieldErrors.name}
                style={{ marginBottom: 0 }}
              >
                <Input
                  theme={t}
                  name="name"
                  autoComplete="name"
                  required
                  placeholder={translate("nameRequired")}
                  maxLength={100}
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    clearFieldError("name");
                  }}
                />
              </Field>
              {!isEdit && (
                <>
                  {channelConfig.email && (
                    <Field
                      theme={t}
                      label={translate("emailOptionalUpdates")}
                      error={fieldErrors.email}
                      style={{ marginBottom: 0 }}
                    >
                      <Input
                        theme={t}
                        type="email"
                        name="email"
                        autoComplete="email"
                        placeholder={translate("emailOptionalUpdates")}
                        value={email}
                        onChange={(e) => {
                          setEmail(e.target.value);
                          clearFieldError("email");
                        }}
                      />
                    </Field>
                  )}
                  {channelConfig.sms && (
                    <Field
                      theme={t}
                      label={translate("phoneOptionalSmsUpdates")}
                      style={{ marginBottom: 0 }}
                    >
                      <Input
                        theme={t}
                        type="tel"
                        name="tel"
                        autoComplete="tel"
                        placeholder={translate("phoneOptionalSmsUpdates")}
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                      />
                    </Field>
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
                    <Field
                      key={i}
                      theme={t}
                      error={fieldErrors[`guest-${i}`]}
                      style={{ marginBottom: 0 }}
                      label={translate("plusOnePlaceholder", {
                        number: i + 1,
                        required: event.plusOneNamesRequired ? "yes" : "no",
                      })}
                    >
                      <Input
                        theme={t}
                        required={event.plusOneNamesRequired}
                        placeholder={translate("plusOnePlaceholder", {
                          number: i + 1,
                          required: event.plusOneNamesRequired ? "yes" : "no",
                        })}
                        value={n}
                        onChange={(e) => {
                          const next = [...plusOneNames];
                          next[i] = e.target.value;
                          setPlusOneNames(next);
                          clearFieldError(`guest-${i}`);
                        }}
                      />
                    </Field>
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

          {Object.keys(fieldErrors).length > 0 && (
            <InlineAlert theme={t}>{translate("checkFields")}</InlineAlert>
          )}
          {error && (
            <div ref={errorRef} tabIndex={-1}>
              <InlineAlert theme={t}>{error}</InlineAlert>
            </div>
          )}
        </div>

        <div style={S.footer}>
          <a
            href={`/e/${event.slug}${savedEditToken ? `?token=${savedEditToken}` : ""}`}
            {...buttonProps(t, { variant: "secondary" })}
          >
            {translate("cancel")}
          </a>
          <Button theme={t} variant="primary" type="submit" disabled={isPending}>
            {isPending
              ? translate("saving")
              : step < maxStep
                ? translate("continue")
                : showUpdateCopy
                  ? translate("updateRsvp")
                  : translate("confirmRsvp")}
          </Button>
        </div>
      </form>
    );
  }

  // ── Step 2: Questionnaire ──────────────────────────────────────────────────────────
  return (
    <form
      ref={formRef}
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      style={S.page}
    >
      <EventAtmosphere theme={t} effect={effect} />
      <div style={S.header}>
        <p style={{ margin: 0, padding: "12px 0", fontSize: "14px" }}>
          <Button
            theme={t}
            variant="link"
            onGround
            type="button"
            onClick={() => {
              setFieldErrors({});
              setSubFieldErrors({});
              setError(null);
              setStep(1);
            }}
          >
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
        {visibleFields.map((f) => (
          <div key={f.id} style={{ marginBottom: "20px" }}>
            <QuestionnaireFieldInput
              field={f}
              value={answers[f.id] ?? ""}
              onChange={(val) => setAnswerValue(f.id, val)}
              error={fieldErrors[f.id]}
              subFieldErrors={subFieldErrors}
              onClearSubFieldError={(part) => clearAddressSubFieldError(f.id, part)}
              theme={t}
              idPrefix="question"
            />
          </div>
        ))}

        {Object.keys(fieldErrors).length > 0 && (
          <InlineAlert theme={t}>{translate("checkFields")}</InlineAlert>
        )}
        {error && (
          <div ref={errorRef} tabIndex={-1}>
            <InlineAlert theme={t}>{error}</InlineAlert>
          </div>
        )}
      </div>

      <div style={S.footer}>
        <Button
          theme={t}
          variant="secondary"
          type="button"
          onClick={() => {
            setFieldErrors({});
            setSubFieldErrors({});
            setError(null);
            setStep(1);
          }}
        >
          {translate("back")}
        </Button>
        <Button theme={t} variant="primary" type="submit" disabled={isPending}>
          {isPending
            ? translate("saving")
            : showUpdateCopy
              ? translate("updateRsvp")
              : translate("submit")}
        </Button>
      </div>
    </form>
  );
}
