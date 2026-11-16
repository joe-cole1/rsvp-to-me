"use client";

import { useId, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { previewEventUrl, saveEventUrl } from "@/app/actions/event";
import {
  EventSlugSchema,
  retainsRandomCode,
  type EventVisibility,
  type SaveEventUrlInput,
} from "@/lib/event-url-shared";
import { APP_SHELL, chromeTheme, type ResolvedTheme } from "@/lib/theme";
import { Button } from "@/components/ui/Button";
import { Check, Input, Label } from "@/components/ui/Field";
import { InlineAlert } from "@/components/ui/Feedback";
import { Dialog } from "@/components/ui/Dialog";
import { dialogPanelStyle } from "@/components/ui/ConfirmDialog";
import { useCaptcha } from "@/components/ui/CaptchaProvider";

type Request = {
  slug: string;
  visibility: EventVisibility;
  proof?: string;
  code?: string | null;
  allowGuessable?: boolean;
};

export function EventUrlSettings({
  eventId,
  initialSlug,
  initialRandomCode,
  visibility,
  onVisibilitySaved,
  disabled = false,
  theme: t,
}: {
  eventId: string;
  initialSlug: string;
  initialRandomCode?: string | null;
  visibility: EventVisibility;
  onVisibilitySaved: (visibility: EventVisibility) => void;
  disabled?: boolean;
  theme: ResolvedTheme;
}) {
  const tr = useTranslations("Ui.Event.EventUrlSettings");
  const router = useRouter();
  const labels = useTranslations("Ui.Event.DisplayOptionsPanel");
  const [current, setCurrent] = useState({
    slug: initialSlug,
    code: initialRandomCode ?? null,
    visibility,
  });
  const [draft, setDraft] = useState(initialSlug);
  const [proposal, setProposal] = useState<{ code: string; proof: string } | null>(null);
  const [decision, setDecision] = useState<{
    kind: "guessable" | "change";
    request: Request;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const { runWithCaptcha } = useCaptcha();
  const id = useId();
  const busy = disabled || pending;
  const ct = chromeTheme(t);
  const hint = { fontSize: "13px", lineHeight: "19px", color: t.textSecondary };
  const actions = { display: "flex", flexWrap: "wrap" as const, gap: "8px" };
  const currentCode = retainsRandomCode(draft.trim(), proposal?.code)
    ? proposal?.code
    : retainsRandomCode(draft.trim(), current.code)
      ? current.code
      : null;

  async function commit(request: Request) {
    setError(null);
    setSaved(null);
    const input: SaveEventUrlInput = {
      expectedSlug: current.slug,
      expectedVisibility: current.visibility,
      slug: request.slug,
      visibility: request.visibility,
      generatedProof: request.proof,
      allowGuessable: request.allowGuessable,
      confirmLinkChange: request.slug !== current.slug,
    };
    try {
      const result = await runWithCaptcha("event_settings", (token) =>
        saveEventUrl(eventId, input, token)
      );
      if (!result.success) {
        setDecision(null);
        setError(tr(result.error));
        return;
      }
      setCurrent({ slug: result.slug, code: result.randomCode, visibility: result.visibility });
      if (result.slug !== current.slug) {
        setDraft(result.slug);
        setProposal(null);
      }
      setDecision(null);
      onVisibilitySaved(result.visibility);
      setSaved(tr(request.slug !== current.slug ? "urlSaved" : "visibilitySaved"));
      if (result.slug !== current.slug) {
        // Replace the retired route in this tab's history after a successful rename.
        router.replace(`/e/${result.slug}/settings?section=privacy`);
      }
    } catch {
      setDecision(null);
      setError(tr("failed"));
    }
  }

  async function requestSave(request: Request) {
    const parsed = EventSlugSchema.safeParse(request.slug);
    if (!parsed.success) {
      setError(tr("invalid"));
      return;
    }
    request = { ...request, slug: parsed.data };
    setError(null);
    setSaved(null);
    if (
      request.visibility === "UNLISTED" &&
      !retainsRandomCode(request.slug, request.code) &&
      !request.allowGuessable
    ) {
      setDecision({ kind: "guessable", request });
    } else if (request.slug !== current.slug) {
      setDecision({ kind: "change", request });
    } else {
      await commit(request);
    }
  }

  function generate(prefix: string, request?: Request) {
    startTransition(async () => {
      setError(null);
      setSaved(null);
      try {
        const result = await runWithCaptcha("event_settings", (token) =>
          previewEventUrl(eventId, prefix.slice(0, 50).replace(/-+$/, ""), token)
        );
        setProposal({ code: result.code, proof: result.proof });
        setDraft(result.slug);
        if (request) await requestSave({ ...request, ...result, allowGuessable: false });
      } catch {
        setDecision(null);
        setError(tr("failed"));
      }
    });
  }

  const trimCode = (value: string) => {
    const code = retainsRandomCode(value, proposal?.code) ? proposal?.code : current.code;
    if (!retainsRandomCode(value, code)) return value;
    return value === code ? "" : value.slice(0, -(code!.length + 1));
  };

  return (
    <div style={{ marginBottom: "24px" }}>
      <Label theme={t}>{labels("eventVisibility")}</Label>
      <div
        role="radiogroup"
        aria-label={labels("eventVisibility")}
        style={{ display: "grid", gap: "8px", marginBottom: "20px" }}
      >
        {(
          [
            ["PUBLIC", labels("publicFindableByAnyone")],
            ["UNLISTED", labels("unlistedOnlyPeopleLink")],
            ["PRIVATE", labels("privateInviteOnly")],
          ] as const
        ).map(([value, label]) => (
          <label
            key={value}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              fontSize: "14px",
              color: t.textSecondary,
            }}
          >
            <Check
              theme={t}
              type="radio"
              name={`${id}-visibility`}
              checked={visibility === value}
              disabled={busy}
              onChange={() => {
                startTransition(() =>
                  requestSave({ slug: current.slug, visibility: value, code: current.code })
                );
              }}
            />
            {label}
          </label>
        ))}
      </div>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          startTransition(() =>
            requestSave({
              slug: draft,
              visibility: current.visibility,
              proof: proposal?.proof,
              code: currentCode,
            })
          );
        }}
      >
        <Label theme={t} htmlFor={`${id}-url`}>
          {tr("eventUrl")}
        </Label>
        <p style={{ ...hint, margin: "0 0 8px" }}>{tr("prefix")}</p>
        <Input
          theme={t}
          id={`${id}-url`}
          value={draft}
          disabled={busy}
          maxLength={80}
          autoComplete="off"
          spellCheck={false}
          aria-invalid={error === tr("invalid")}
          aria-describedby={`${id}-hint`}
          onChange={(event) => {
            setDraft(event.target.value);
            setError(null);
            setSaved(null);
          }}
        />
        <p style={{ ...hint, overflowWrap: "anywhere", margin: "8px 0" }}>
          {tr("preview")} <strong style={{ color: t.textPrimary }}>/e/{draft.trim()}</strong>
        </p>
        <p id={`${id}-hint`} style={{ ...hint, margin: "0 0 12px" }}>
          {tr(
            currentCode
              ? "randomHint"
              : current.visibility === "PRIVATE"
                ? "privateHint"
                : current.visibility === "UNLISTED"
                  ? "customHint"
                  : "publicHint"
          )}
        </p>
        <div style={actions}>
          <Button
            theme={t}
            type="submit"
            disabled={busy || draft.trim() === current.slug}
            variant="primary"
          >
            {tr("saveUrl")}
          </Button>
          <Button
            theme={t}
            type="button"
            disabled={busy}
            variant="secondary"
            onClick={() => generate("")}
          >
            {tr("generateNew")}
          </Button>
          {!currentCode && (
            <Button
              theme={t}
              type="button"
              disabled={busy || !EventSlugSchema.safeParse(draft.trim()).success}
              variant="secondary"
              onClick={() => generate(draft.trim())}
            >
              {tr("addCode")}
            </Button>
          )}
        </div>
      </form>
      {saved && (
        <p role="status" style={{ ...hint, color: t.status.success.text, margin: "12px 0 0" }}>
          {saved}
        </p>
      )}
      {error && (
        <InlineAlert theme={t} style={{ marginTop: "12px", marginBottom: 0 }}>
          {error}
        </InlineAlert>
      )}
      <Dialog
        open={decision !== null}
        onClose={() => {
          if (!pending) setDecision(null);
        }}
        titleId={`${id}-title`}
        describedBy={`${id}-description`}
        panelStyle={{
          ...dialogPanelStyle(ct),
          background: APP_SHELL.chromeSurface,
          border: `1px solid ${APP_SHELL.navBorder}`,
          boxShadow: APP_SHELL.chromeShadow,
        }}
      >
        {decision && (
          <>
            <h2
              id={`${id}-title`}
              style={{ fontSize: "15px", fontWeight: 700, margin: "0 0 12px" }}
            >
              {tr(decision.kind === "guessable" ? "guessableTitle" : "changeTitle")}
            </h2>
            <p
              id={`${id}-description`}
              style={{
                fontSize: "14px",
                lineHeight: 1.5,
                color: ct.textSecondary,
                margin: "0 0 12px",
              }}
            >
              {tr(decision.kind === "guessable" ? "guessableMessage" : "changeMessage")}
            </p>
            <p style={{ fontSize: "14px", overflowWrap: "anywhere", margin: "0 0 20px" }}>
              /e/{decision.request.slug}
            </p>
            <div style={actions}>
              <Button
                theme={ct}
                variant="secondary"
                disabled={pending}
                onClick={() => setDecision(null)}
              >
                {tr("cancel")}
              </Button>
              {decision.kind === "guessable" ? (
                <>
                  <Button
                    theme={ct}
                    variant="secondary"
                    disabled={pending}
                    onClick={() => {
                      startTransition(() =>
                        requestSave({ ...decision.request, allowGuessable: true })
                      );
                    }}
                  >
                    {tr("useAnyway")}
                  </Button>
                  <Button
                    theme={ct}
                    variant="primary"
                    disabled={pending}
                    onClick={() => generate(trimCode(decision.request.slug), decision.request)}
                  >
                    {tr("addCode")}
                  </Button>
                </>
              ) : (
                <Button
                  theme={ct}
                  variant="primary"
                  disabled={pending}
                  onClick={() => {
                    startTransition(() => commit(decision.request));
                  }}
                >
                  {tr("changeUrl")}
                </Button>
              )}
            </div>
          </>
        )}
      </Dialog>
    </div>
  );
}
