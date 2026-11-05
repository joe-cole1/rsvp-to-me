import type { ManagementData } from "@/lib/notifications/manage";
import { CATEGORIES, type Category } from "@/lib/notifications/preferences";

const rows = (categories: readonly Category[]) =>
  categories.map((category) => ({
    category,
    channels: ["email", "sms"] as ManagementData["rows"][number]["channels"],
  }));

/** A masked management DTO as readManagement returns it; defaults to a linked RSVP. */
export function managementFixture(overrides: Partial<ManagementData> = {}): ManagementData {
  const categories: Category[] = ["updates", "reminders", "confirmations"];
  return {
    kind: "rsvp",
    title: "Fixture event",
    revision: 0,
    offered: ["email", "sms"],
    linked: true,
    hostAlertsEnabled: null,
    own: false,
    categories,
    rows: rows(categories),
    contacts: [
      { channel: "email", destination: "g•••t@example.com", state: "on_file" },
      { channel: "sms", destination: null, state: "missing" },
    ],
    connections: [],
    ...overrides,
  };
}

export function profileFixture(overrides: Partial<ManagementData> = {}): ManagementData {
  return managementFixture({
    kind: "profile",
    title: null,
    linked: true,
    own: true,
    categories: [...CATEGORIES],
    rows: rows(CATEGORIES),
    contacts: [],
    ...overrides,
  });
}
