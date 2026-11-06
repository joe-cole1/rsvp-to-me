"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { Minus, Plus } from "lucide-react";
import { Section } from "@/components/event/settings-page/ui";
import { Button, DISABLED_OPACITY, buttonProps } from "@/components/ui/Button";
import { chipStyle } from "@/components/ui/Choice";
import { Check } from "@/components/ui/Field";
import { InlineAlert, StatusChip } from "@/components/ui/Feedback";
import { Toggle } from "@/components/ui/Toggle";
import { APP_SHELL_THEME as APP_THEME, type ResolvedTheme } from "@/lib/theme";
import type { Category, Channel } from "@/lib/notifications/preferences";
import type { ManagementData, ManagementScope } from "@/lib/notifications/manage";
import {
  bindNotificationConnection,
  getNotificationManagement,
  removeNotificationConnection,
  saveNotificationPreferences,
} from "@/app/actions/notifications";
import { actionFailure } from "./action-error";
import { DestinationVerifier } from "./DestinationVerifier";

export type SaveReport = (state: "SAVING" | "SAVED" | "ERROR", message?: string) => void;
type Row = ManagementData["rows"][number];
type Result =
  { success: true; data: ManagementData } | { success: false; error: string; code?: string };
type Status = {
  section: string;
  tone: "success" | "error" | "info";
  text: string;
  reload?: boolean;
} | null;

/**
 * Every change saves immediately. Saves run in order against the latest confirmed revision; a
 * failure restores the confirmed state and drops anything queued behind it.
 */
function useManagement(scope: ManagementScope, initialData?: ManagementData, report?: SaveReport) {
  const t = useTranslations("Ui.Notifications");
  const [data, setData] = useState<ManagementData | null>(initialData ?? null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>(null);
  const confirmed = useRef<ManagementData | null>(initialData ?? null);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const pending = useRef(0);
  const epoch = useRef(0);
  const scopeKey = JSON.stringify(scope);

  // Effects only set state from the response; a retry clears the error first.
  const fetchData = useCallback(() => {
    getNotificationManagement(JSON.parse(scopeKey))
      .then((result) => {
        if (!result.success) return setLoadError(result.error);
        confirmed.current = result.data;
        setData(result.data);
      })
      .catch((error) =>
        setLoadError(
          t(
            actionFailure(error).code === "staleClient" ? "errors.staleClient" : "errors.loadFailed"
          )
        )
      );
  }, [scopeKey, t]);

  useEffect(() => {
    if (!initialData) fetchData();
  }, [initialData, fetchData]);
  const load = () => {
    setLoadError(null);
    fetchData();
  };

  const announce = useCallback(
    (section: string, tone: "success" | "error" | "info", text: string, code?: string) => {
      if (report) report(tone === "error" ? "ERROR" : tone === "info" ? "SAVING" : "SAVED", text);
      setStatus({ section, tone, text, reload: code === "staleClient" });
    },
    [report]
  );

  const run = (
    section: string,
    operation: () => Promise<Result>,
    optimistic: ManagementData | null,
    savedText: string
  ) => {
    if (optimistic) setData(optimistic);
    const mine = epoch.current;
    pending.current++;
    announce(section, "info", t("saving"));
    queue.current = queue.current.then(async () => {
      if (mine !== epoch.current) {
        pending.current--;
        return;
      }
      let result: Result;
      try {
        result = await operation();
      } catch (error) {
        const { code } = actionFailure(error);
        result = { success: false, error: t(`errors.${code}`), code };
      }
      pending.current--;
      if (result.success) {
        confirmed.current = result.data;
        if (!pending.current) setData(result.data);
        announce(section, "success", savedText);
        return;
      }
      epoch.current++;
      pending.current = 0;
      setData(confirmed.current);
      announce(section, "error", result.error, result.code);
      if (result.code === "settingsChanged") load();
    });
  };

  /** Writes every row this scope controls, or none to follow the profile again. */
  const save = (section: string, rows: Row[] | null, savedText: string) => {
    if (!data) return;
    run(
      section,
      () =>
        saveNotificationPreferences(JSON.parse(scopeKey), {
          revision: confirmed.current!.revision,
          categories: rows ?? [],
        }),
      rows ? { ...data, own: true, rows } : { ...data, own: false },
      savedText
    );
  };

  const replace = (section: string, next: ManagementData, text: string) => {
    confirmed.current = next;
    setData(next);
    announce(section, "success", text);
  };

  return { data, loadError, load, status, save, run, replace, announce, scopeKey };
}
type Management = ReturnType<typeof useManagement>;

function StatusLine({
  status,
  section,
  theme,
}: {
  status: Status;
  section: string;
  theme: ResolvedTheme;
}) {
  const t = useTranslations("Ui.Notifications");
  if (!status || status.section !== section) return null;
  return (
    <div style={{ marginTop: "12px" }}>
      <InlineAlert theme={theme} tone={status.tone}>
        {status.text}{" "}
        {status.reload && (
          <Button
            theme={theme}
            variant="link"
            type="button"
            onClick={() => window.location.reload()}
          >
            {t("reload")}
          </Button>
        )}
      </InlineAlert>
    </div>
  );
}

function Hint({ theme, children }: { theme: ResolvedTheme; children: React.ReactNode }) {
  return (
    <p
      style={{
        margin: "0 0 14px",
        fontSize: "13px",
        lineHeight: "19px",
        color: theme.textSecondary,
      }}
    >
      {children}
    </p>
  );
}

/** What you get × where: one checkbox per message type and channel. */
function PreferenceTable({
  data,
  theme,
  disabled,
  onToggle,
}: {
  data: ManagementData;
  theme: ResolvedTheme;
  disabled: boolean;
  onToggle: (category: Category, channel: Channel, on: boolean) => void;
}) {
  const t = useTranslations("Ui.Notifications");
  const divider = `1px solid ${theme.cardBorder}`;
  const head: CSSProperties = {
    fontSize: "12px",
    fontWeight: 700,
    letterSpacing: "0.02em",
    color: theme.textSecondary,
  };
  return (
    <div
      className="rsvp-pref"
      style={
        {
          "--rsvp-pref-cols": data.offered.length,
          "--rsvp-pref-border": theme.inputBorder,
        } as CSSProperties
      }
    >
      <div role="table" aria-label={t("tableName")}>
        <div role="row" className="rsvp-pref-row rsvp-pref-head" style={{ borderBottom: divider }}>
          <span role="columnheader" style={head}>
            {t("columnMessage")}
          </span>
          {data.offered.map((channel) => (
            <span key={channel} role="columnheader" style={{ ...head, textAlign: "center" }}>
              {t(channel)}
            </span>
          ))}
        </div>
        {data.rows.map((row, index) => (
          <div
            key={row.category}
            role="row"
            className="rsvp-pref-row"
            style={{ borderBottom: index < data.rows.length - 1 ? divider : "none" }}
          >
            <div role="rowheader">
              <div style={{ fontSize: "14px", color: theme.textPrimary }}>{t(row.category)}</div>
              <div style={{ fontSize: "13px", color: theme.textSecondary, marginTop: "2px" }}>
                {t(`${row.category}Hint`)}
              </div>
            </div>
            {data.offered.map((channel) => (
              <label
                key={channel}
                role="cell"
                className="rsvp-pref-cell"
                style={{
                  color: theme.textPrimary,
                  cursor: disabled ? "not-allowed" : "pointer",
                  opacity: disabled ? DISABLED_OPACITY : 1,
                }}
              >
                <Check
                  theme={theme}
                  aria-label={t("cellLabel", { category: t(row.category), channel: t(channel) })}
                  checked={row.channels.includes(channel)}
                  disabled={disabled}
                  onChange={(event) => onToggle(row.category, channel, event.target.checked)}
                  // The cell carries the disabled look; don't fade the box twice.
                  style={{ width: "20px", height: "20px", opacity: 1 }}
                />
                <span className="rsvp-pref-cell-label" aria-hidden>
                  {t(channel)}
                </span>
              </label>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Saves one box; the row keeps the site's channel order. */
function useToggle(data: ManagementData, m: Management) {
  const t = useTranslations("Ui.Notifications");
  return (category: Category, channel: Channel, on: boolean) =>
    m.save(
      "table",
      data.rows.map((row) =>
        row.category === category
          ? {
              ...row,
              channels: data.offered.filter((item) =>
                item === channel ? on : row.channels.includes(item)
              ),
            }
          : row
      ),
      t(on ? "cellOn" : "cellOff", { category: t(category), channel: t(channel) })
    );
}

/** Contacts grouped by channel: one row per address, or an empty line. */
function ContactGroup({
  theme,
  label,
  children,
}: {
  theme: ResolvedTheme;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: "16px" }}>
      <div
        style={{
          fontSize: "12px",
          fontWeight: 700,
          letterSpacing: "0.02em",
          color: theme.textSecondary,
          marginBottom: "4px",
        }}
      >
        {label}
      </div>
      <ul
        style={{
          listStyle: "none",
          margin: 0,
          padding: 0,
          borderTop: `1px solid ${theme.cardBorder}`,
        }}
      >
        {children}
      </ul>
    </div>
  );
}

function ContactItem({
  theme,
  children,
  below,
}: {
  theme: ResolvedTheme;
  children: React.ReactNode;
  below?: React.ReactNode;
}) {
  return (
    <li style={{ borderBottom: `1px solid ${theme.cardBorder}` }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "12px",
          minHeight: "52px",
          padding: "6px 0",
        }}
      >
        {children}
      </div>
      {below && <div style={{ display: "grid", gap: "12px", padding: "4px 0 16px" }}>{below}</div>}
    </li>
  );
}

function Address({ theme, children }: { theme: ResolvedTheme; children: React.ReactNode }) {
  return (
    <span
      style={{
        flex: "1 1 auto",
        minWidth: 0,
        fontSize: "14px",
        color: theme.textPrimary,
        overflowWrap: "anywhere",
      }}
    >
      {children}
    </span>
  );
}

/** Reusable verified addresses: plus at the top, minus on each address. */
function ProfileContacts({ data, theme, scope, m }: EditorProps) {
  const t = useTranslations("Ui.Notifications");
  const free = data.offered.filter(
    (channel) => !data.connections.some((row) => row.channel === channel)
  );
  const [adding, setAdding] = useState(false);
  const [picked, setPicked] = useState<Channel | null>(null);
  const channel = picked && free.includes(picked) ? picked : free[0];
  const formStyle: CSSProperties = {
    display: "grid",
    gap: "12px",
    padding: "16px",
    marginBottom: "16px",
    border: `1px solid ${theme.inputBorder}`,
    borderRadius: "12px",
  };
  return (
    <Section
      title={t("contactsTitle")}
      t={theme}
      action={
        free.length > 0 && !adding ? (
          <Button theme={theme} variant="secondary" type="button" onClick={() => setAdding(true)}>
            <Plus size={16} aria-hidden />
            {t("add")}
          </Button>
        ) : undefined
      }
    >
      <Hint theme={theme}>{t("profileContactsHint")}</Hint>
      {adding && channel && (
        <div style={formStyle}>
          <div style={{ fontSize: "14px", fontWeight: 700, color: theme.textPrimary }}>
            {t("addTitle")}
          </div>
          {free.length > 1 && (
            <fieldset
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "8px",
                margin: 0,
                padding: 0,
                border: "none",
              }}
            >
              <legend className="rsvp-pref-cell-label">{t("addKind")}</legend>
              {free.map((option) => (
                <label
                  key={option}
                  className="rsvp-field-within"
                  style={{ ...chipStyle(theme, option === channel), gap: "8px" }}
                >
                  <Check
                    theme={theme}
                    type="radio"
                    name="contact-kind"
                    checked={option === channel}
                    onChange={() => setPicked(option)}
                    style={{ width: "16px", height: "16px" }}
                  />
                  {t(option)}
                </label>
              ))}
            </fieldset>
          )}
          <DestinationVerifier
            key={channel}
            scope={scope}
            channel={channel}
            theme={theme}
            onVerified={(next) => {
              setAdding(false);
              m.replace("contacts", next, t("verifiedDone"));
            }}
            onError={(message, code) => m.announce("contacts", "error", message, code)}
            onCancel={() => setAdding(false)}
          />
        </div>
      )}
      {data.offered.map((group) => {
        const connection = data.connections.find((row) => row.channel === group);
        return (
          <ContactGroup key={group} theme={theme} label={t(group)}>
            {connection ? (
              <ContactItem theme={theme}>
                <Address theme={theme}>{connection.destination}</Address>
                <StatusChip theme={theme} tone="success">
                  {t("contactVerified")}
                </StatusChip>
                <Button
                  theme={theme}
                  variant="icon"
                  type="button"
                  aria-label={t("removeAddress", { destination: connection.destination })}
                  onClick={() =>
                    m.run(
                      "contacts",
                      () => removeNotificationConnection(JSON.parse(m.scopeKey), group),
                      null,
                      t("removeDone")
                    )
                  }
                >
                  <Minus size={16} aria-hidden />
                </Button>
              </ContactItem>
            ) : (
              <li style={{ padding: "14px 0", fontSize: "13px", color: theme.textSecondary }}>
                {t("noneYet")}
              </li>
            )}
          </ContactGroup>
        );
      })}
      <StatusLine status={m.status} section="contacts" theme={theme} />
    </Section>
  );
}

/** This event's contacts: the event holds them, so each can be added, changed or verified. */
function EventContacts({ data, theme, scope, m, embedded }: EditorProps & { embedded: boolean }) {
  const t = useTranslations("Ui.Notifications");
  const organizer = data.kind === "organizer";
  const [editing, setEditing] = useState<Channel | null>(null);
  const chipText = (state: ManagementData["contacts"][number]["state"]) => {
    switch (state) {
      case "verified":
        return t("contactVerified");
      case "on_file":
        return t("contactOnFile");
      case "paused":
        return t("contactPaused");
      case "unverified":
        return t("contactUnverified");
      default:
        return null;
    }
  };
  const chip = (state: ManagementData["contacts"][number]["state"]) => {
    const text = chipText(state);
    return (
      text && (
        <StatusChip theme={theme} tone={state === "verified" ? "success" : "neutral"}>
          {text}
        </StatusChip>
      )
    );
  };
  const unbound = data.connections.filter((row) => !row.bound);
  const Wrapper = embedded ? Embedded : Section;
  return (
    <Wrapper title={t("contactsTitle")} t={theme}>
      <Hint theme={theme}>{organizer ? t("organizerContactsHint") : t("contactsHint")}</Hint>
      {data.contacts.map((row) => (
        <ContactGroup key={row.channel} theme={theme} label={t(row.channel)}>
          <ContactItem
            theme={theme}
            below={
              !organizer && editing === row.channel ? (
                <DestinationVerifier
                  scope={scope}
                  channel={row.channel}
                  theme={theme}
                  onVerified={(next) => {
                    setEditing(null);
                    m.replace("contacts", next, t("verifiedDone"));
                  }}
                  onError={(message, code) => m.announce("contacts", "error", message, code)}
                  onCancel={() => setEditing(null)}
                />
              ) : undefined
            }
          >
            <Address theme={theme}>
              {row.destination ?? (
                <span style={{ fontSize: "13px", color: theme.textSecondary }}>{t("noneYet")}</span>
              )}
            </Address>
            {chip(row.state)}
            {!organizer && editing !== row.channel && (
              <Button
                theme={theme}
                variant="link"
                type="button"
                onClick={() => setEditing(row.channel)}
              >
                {t(
                  row.state === "missing"
                    ? "addContact"
                    : row.state === "paused"
                      ? "verifyContact"
                      : "changeContact"
                )}
              </Button>
            )}
          </ContactItem>
        </ContactGroup>
      ))}
      {unbound.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "12px" }}>
          {unbound.map((row) => (
            <Button
              key={row.id}
              theme={theme}
              variant="secondary"
              type="button"
              onClick={() =>
                m.run(
                  "contacts",
                  () => bindNotificationConnection(JSON.parse(m.scopeKey), row.id),
                  null,
                  t("verifiedDone")
                )
              }
            >
              {t("useForEvent", { destination: row.destination })}
            </Button>
          ))}
        </div>
      )}
      {organizer && (
        <Link href="/profile" {...buttonProps(theme, { variant: "link" })}>
          {t("manageProfileConnections")}
        </Link>
      )}
      <StatusLine status={m.status} section="contacts" theme={theme} />
    </Wrapper>
  );
}

/** A titled block for use inside a card that already exists. */
function Embedded({
  title,
  t: theme,
  children,
}: {
  title: string;
  t: ResolvedTheme;
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginTop: "20px" }}>
      <h3
        style={{ margin: "0 0 12px", fontSize: "14px", fontWeight: 700, color: theme.textPrimary }}
      >
        {title}
      </h3>
      {children}
    </div>
  );
}

type EditorProps = {
  data: ManagementData;
  theme: ResolvedTheme;
  scope: ManagementScope;
  m: Management;
};

function ProfileEditor(props: EditorProps) {
  const { data, theme, m } = props;
  const t = useTranslations("Ui.Notifications");
  const toggle = useToggle(data, m);
  return (
    <>
      <Section title={t("title")} t={theme}>
        <Hint theme={theme}>{t("tableHint")}</Hint>
        {data.offered.length ? (
          <>
            <PreferenceTable data={data} theme={theme} disabled={false} onToggle={toggle} />
            <Hint theme={theme}>{t("emptyRow")}</Hint>
          </>
        ) : (
          <InlineAlert theme={theme} tone="info">
            {t("noneOffered")}
          </InlineAlert>
        )}
        <StatusLine status={m.status} section="table" theme={theme} />
      </Section>
      <ProfileContacts {...props} />
      <Section title={t("oneEventTitle")} t={theme}>
        <p style={{ margin: 0, fontSize: "13px", lineHeight: "19px", color: theme.textSecondary }}>
          {t("oneEventHint")}
        </p>
      </Section>
    </>
  );
}

function EventEditor(props: EditorProps & { embedded: boolean }) {
  const { data, theme, m, embedded } = props;
  const t = useTranslations("Ui.Notifications");
  const toggle = useToggle(data, m);
  // Without an account there is no profile to follow: the table is the only control.
  const following = data.linked && !data.own;
  // Never claim a route that would not send: a checked channel without a usable contact says so.
  const blocked = data.contacts.filter(
    (row) =>
      row.state !== "verified" &&
      row.state !== "on_file" &&
      data.rows.some((item) => item.channels.includes(row.channel))
  );
  const table =
    data.kind === "organizer" && data.hostAlertsEnabled === false ? (
      <Hint theme={theme}>{t("organizerOff")}</Hint>
    ) : data.offered.length ? (
      <>
        {data.linked && (
          <Toggle
            theme={theme}
            label={t("useProfile")}
            value={following}
            onChange={(follow) =>
              m.save("table", follow ? null : data.rows, follow ? t("followDone") : t("eventOwn"))
            }
          />
        )}
        <PreferenceTable data={data} theme={theme} disabled={following} onToggle={toggle} />
        {blocked.map((row) => (
          <Hint key={row.channel} theme={theme}>
            {t("channelUnavailable", { channel: t(row.channel) })}
          </Hint>
        ))}
        <StatusLine status={m.status} section="table" theme={theme} />
      </>
    ) : (
      <InlineAlert theme={theme} tone="info">
        {t("noneOffered")}
      </InlineAlert>
    );
  const contacts = !(data.kind === "organizer" && data.hostAlertsEnabled === false) && (
    <EventContacts {...props} embedded={embedded} />
  );
  // Embedded in event settings, which is already a card: no nested cards.
  if (embedded)
    return (
      <>
        {table}
        {contacts}
      </>
    );
  return (
    <>
      <Section title={t("eventTitle", { event: data.title ?? "" })} t={theme}>
        <Hint theme={theme}>{t("tableHint")}</Hint>
        {table}
      </Section>
      {contacts}
    </>
  );
}

export function NotificationPreferences({
  scope,
  initialData,
  theme = APP_THEME,
  embedded = false,
  onStatus,
}: {
  scope: ManagementScope;
  initialData?: ManagementData;
  theme?: ResolvedTheme;
  embedded?: boolean;
  onStatus?: SaveReport;
}) {
  const t = useTranslations("Ui.Notifications");
  const m = useManagement(scope, initialData, onStatus);
  let content: React.ReactNode;
  if (!m.data) {
    const waiting = m.loadError ? (
      <>
        <InlineAlert theme={theme} tone="error">
          {m.loadError}
        </InlineAlert>
        <Button theme={theme} variant="secondary" type="button" onClick={m.load}>
          {t("retry")}
        </Button>
      </>
    ) : (
      <Hint theme={theme}>{t("loading")}</Hint>
    );
    content = embedded ? (
      waiting
    ) : (
      <Section title={t("title")} t={theme}>
        {waiting}
      </Section>
    );
  } else if (m.data.kind === "profile") {
    content = <ProfileEditor data={m.data} theme={theme} scope={scope} m={m} />;
  } else {
    content = <EventEditor data={m.data} theme={theme} scope={scope} m={m} embedded={embedded} />;
  }
  return <div>{content}</div>;
}
