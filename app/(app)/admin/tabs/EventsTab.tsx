"use client";
import { useLocale, useTranslations } from "next-intl";

import { APP_SHELL, APP_SHELL_THEME as T } from "@/lib/theme";
import { appCardStyle } from "@/components/ui/AppPrimitives";
import { Button, buttonProps } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import type { AdminEvent } from "./types";

export function EventsTab({
  eventSearch,
  handleEventSearch,
  events,
  handleEventDelete,
}: {
  eventSearch: string;
  handleEventSearch: (val: string) => Promise<void>;
  events: AdminEvent[];
  handleEventDelete: (eventId: string, title: string) => void;
}) {
  const tr = useTranslations("Ui.Admin");
  const locale = useLocale();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <Input
        theme={T}
        type="text"
        aria-label={tr("searchEventsByTitleSlugOrHostDetails")}
        placeholder={tr("searchEventsByTitleSlugOrHostDetails")}
        value={eventSearch}
        onChange={(e) => handleEventSearch(e.target.value)}
      />

      <div
        style={{
          ...appCardStyle,
          overflowX: "auto",
        }}
      >
        <div style={{ minWidth: "700px" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
            <thead>
              <tr
                style={{
                  borderBottom: `1px solid ${APP_SHELL.navBorder}`,
                  color: APP_SHELL.textSecondary,
                  textAlign: "left",
                }}
              >
                <th style={{ padding: "16px" }}>{tr("eventInfo")}</th>
                <th style={{ padding: "16px" }}>{tr("host2")}</th>
                <th style={{ padding: "16px" }}>{tr("stats")}</th>
                <th style={{ padding: "16px", textAlign: "right" }}>{tr("actions")}</th>
              </tr>
            </thead>
            <tbody>
              {events.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    style={{
                      padding: "32px",
                      textAlign: "center",
                      color: APP_SHELL.textMuted,
                    }}
                  >
                    {tr("noEventsFound")}
                  </td>
                </tr>
              ) : (
                events.map((e) => (
                  <tr key={e.id} style={{ borderBottom: `1px solid ${APP_SHELL.navBorder}` }}>
                    <td style={{ padding: "16px" }}>
                      <div style={{ fontWeight: 700, color: APP_SHELL.textPrimary }}>{e.title}</div>
                      <div
                        style={{
                          fontSize: "12px",
                          color: APP_SHELL.textSecondary,
                          marginTop: "2px",
                        }}
                      >
                        {tr("date")}
                        {new Date(e.startAt).toLocaleString(locale)} {tr("status")}
                        {e.status}
                      </div>
                    </td>
                    <td style={{ padding: "16px" }}>
                      <div style={{ color: APP_SHELL.textPrimary }}>{e.hostName}</div>
                      <div style={{ fontSize: "12px", color: APP_SHELL.textSecondary }}>
                        {e.hostEmail}
                      </div>
                    </td>
                    <td style={{ padding: "16px" }}>
                      <div style={{ color: APP_SHELL.textPrimary }}>
                        {tr("rsvpsMessage", { value0: e.rsvpCount })}
                      </div>
                      <span
                        style={{
                          fontSize: "10px",
                          color: APP_SHELL.textSecondary,
                          textTransform: "uppercase",
                        }}
                      >
                        {e.visibility}
                      </span>
                    </td>
                    <td style={{ padding: "16px", textAlign: "right" }}>
                      <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                        <a
                          href={`/e/${e.slug}?admin=1`}
                          target="_blank"
                          rel="noopener noreferrer"
                          {...buttonProps(T, { variant: "secondary", size: "sm" })}
                        >
                          {tr("moderate")}
                        </a>
                        <Button
                          theme={T}
                          variant="destructive"
                          size="sm"
                          onClick={() => handleEventDelete(e.id, e.title)}
                        >
                          {tr("delete")}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
