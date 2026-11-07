"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  getNotificationSchedule,
  saveNotificationSchedule,
  type NotificationScheduleData,
} from "@/app/actions/notification-schedule";
import { useCaptcha } from "@/components/ui/CaptchaProvider";
import { Section } from "@/components/event/settings-page/ui";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { InlineAlert } from "@/components/ui/Feedback";
import { Toggle } from "@/components/ui/Toggle";
import type { ResolvedTheme } from "@/lib/theme";
import type { SaveReport } from "./NotificationPreferences";

/** Hosts choose when; each guest's own settings choose how. Switches save immediately. */
export function ReminderSchedule({
  eventId,
  theme,
  onStatus,
}: {
  eventId: string;
  theme: ResolvedTheme;
  onStatus?: SaveReport;
}) {
  const t = useTranslations("Ui.Notifications");
  const panel = useTranslations("Ui.Event.RemindersPanel");
  const { runWithCaptcha } = useCaptcha();
  const [schedule, setSchedule] = useState<NotificationScheduleData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [status, setStatus] = useState<{ tone: "success" | "error" | "info"; text: string } | null>(
    null
  );
  const [custom, setCustom] = useState("");
  const confirmed = useRef<NotificationScheduleData | null>(null);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const pending = useRef(0);
  const epoch = useRef(0);

  // Effects only set state from the response; a retry clears the error first.
  const fetchSchedule = useCallback(() => {
    getNotificationSchedule(eventId)
      .then((result) => {
        if (!result.success) return setLoadError(result.error);
        confirmed.current = result.data;
        setSchedule(result.data);
      })
      .catch(() => setLoadError(t("errors.loadFailed")));
  }, [eventId, t]);
  useEffect(fetchSchedule, [fetchSchedule]);
  const load = () => {
    setLoadError(null);
    fetchSchedule();
  };

  const announce = (tone: "success" | "error" | "info", text: string) => {
    onStatus?.(tone === "error" ? "ERROR" : tone === "info" ? "SAVING" : "SAVED", text);
    setStatus({ tone, text });
  };

  const commit = (next: NotificationScheduleData, text: string, convertLegacy = false) => {
    setSchedule(next);
    const mine = epoch.current;
    pending.current++;
    announce("info", t("saving"));
    queue.current = queue.current.then(async () => {
      if (mine !== epoch.current) {
        pending.current--;
        return;
      }
      let result: Awaited<ReturnType<typeof saveNotificationSchedule>>;
      try {
        result = await runWithCaptcha("event_settings", (token) =>
          saveNotificationSchedule(
            eventId,
            {
              revision: confirmed.current!.revision,
              hours: next.times.filter((row) => row.enabled).map((row) => row.hours),
              nudge: next.nudge.enabled,
              convertLegacy,
            },
            token
          )
        );
      } catch {
        result = { success: false, error: t("errors.saveFailed") };
      }
      pending.current--;
      if (result.success) {
        confirmed.current = result.data;
        if (!pending.current) setSchedule(result.data);
        announce("success", text);
        return;
      }
      epoch.current++;
      pending.current = 0;
      setSchedule(confirmed.current);
      announce("error", result.error);
    });
  };

  const statusText = (value: string) =>
    value === "done" ? t("scheduleDone") : value === "passed" ? t("schedulePassed") : null;
  const timeLabel = (hours: number) =>
    hours === 168
      ? panel("1WeekBefore")
      : hours === 24
        ? panel("1DayBefore")
        : t("hoursBefore", { hours });
  const customHours = Number(custom);
  const customValid =
    Number.isInteger(customHours) &&
    customHours >= 1 &&
    customHours <= 8760 &&
    !!schedule &&
    schedule.times.filter((row) => row.enabled).length < 10;

  const hint = (text: string) => (
    <p
      style={{
        margin: "0 0 14px",
        fontSize: "13px",
        lineHeight: "19px",
        color: theme.textSecondary,
      }}
    >
      {text}
    </p>
  );

  let body: React.ReactNode;
  if (!schedule)
    body = loadError ? (
      <>
        <InlineAlert theme={theme} tone="error">
          {loadError}
        </InlineAlert>
        <Button theme={theme} variant="secondary" type="button" onClick={load}>
          {t("retry")}
        </Button>
      </>
    ) : (
      hint(t("loading"))
    );
  else
    body = (
      <>
        {hint(t("scheduleHint"))}
        {schedule.legacy.length > 0 && (
          <InlineAlert theme={theme} tone="info">
            {t("scheduleLegacy", {
              limits: schedule.legacy
                .map(
                  (row) =>
                    `${row.kind === "nudge" ? t("nudgeShort") : timeLabel(row.hours)}: ${row.channels
                      .map((channel) => t(channel as "email" | "sms"))
                      .join(t("and"))}`
                )
                .join("; "),
            })}{" "}
            <Button
              theme={theme}
              variant="secondary"
              size="sm"
              type="button"
              onClick={() => commit(schedule, t("legacyConverted"), true)}
            >
              {t("convertLegacy")}
            </Button>
          </InlineAlert>
        )}
        {schedule.times.map((row) => {
          const note = statusText(row.status);
          const label = `${timeLabel(row.hours)}${note ? ` · ${note}` : ""}`;
          return (
            <Toggle
              key={row.hours}
              theme={theme}
              label={label}
              value={row.enabled}
              onChange={(on) =>
                commit(
                  {
                    ...schedule,
                    times: schedule.times.map((item) =>
                      item.hours === row.hours ? { ...item, enabled: on } : item
                    ),
                  },
                  t(on ? "timeOn" : "timeOff", { time: timeLabel(row.hours) })
                )
              }
            />
          );
        })}
        <Toggle
          theme={theme}
          label={`${t("nudgeToggle")}${statusText(schedule.nudge.status) ? ` · ${statusText(schedule.nudge.status)}` : ""}`}
          value={schedule.nudge.enabled}
          onChange={(on) =>
            commit(
              { ...schedule, nudge: { ...schedule.nudge, enabled: on } },
              t(on ? "timeOn" : "timeOff", { time: t("nudgeShort") })
            )
          }
        />
        <div
          style={{
            display: "grid",
            gap: "10px",
            padding: "14px",
            marginBottom: "16px",
            border: `1px solid ${theme.inputBorder}`,
            borderRadius: "12px",
          }}
        >
          <Field theme={theme} label={t("customHours")} style={{ marginBottom: 0 }}>
            <Input
              theme={theme}
              type="number"
              min={1}
              max={8760}
              inputMode="numeric"
              value={custom}
              onChange={(event) => setCustom(event.target.value)}
            />
          </Field>
          <Button
            theme={theme}
            variant="secondary"
            type="button"
            disabled={!customValid}
            onClick={() => {
              setCustom("");
              const exists = schedule.times.some((row) => row.hours === customHours);
              commit(
                {
                  ...schedule,
                  times: exists
                    ? schedule.times.map((row) =>
                        row.hours === customHours ? { ...row, enabled: true } : row
                      )
                    : [
                        ...schedule.times,
                        { hours: customHours, enabled: true, status: "pending" as const },
                      ].sort((a, b) => b.hours - a.hours),
                },
                t("timeOn", { time: timeLabel(customHours) })
              );
            }}
          >
            {t("addTime")}
          </Button>
        </div>
        {status && (
          <InlineAlert theme={theme} tone={status.tone}>
            {status.text}
          </InlineAlert>
        )}
      </>
    );
  return (
    <Section title={panel("autoReminders")} t={theme}>
      {body}
    </Section>
  );
}
