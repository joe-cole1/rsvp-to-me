export function makeSession(overrides = {}) {
  return { userId: "user-1", email: "user@example.com", role: "HOST" as const, ...overrides };
}

export function makeEvent(overrides = {}) {
  return {
    id: "event-1",
    slug: "test-event",
    title: "Test Event",
    hostId: "user-1",
    status: "PUBLISHED",
    visibility: "PUBLIC",
    startAt: new Date("2026-12-01T20:00:00Z"),
    endAt: null,
    timezone: "America/New_York",
    locationType: "PHYSICAL",
    locationName: "My House",
    locationAddress: null,
    virtualUrl: null,
    capacity: null,
    rsvpDeadline: null,
    approvalRequired: false,
    plusOneAllowed: true,
    plusOneMax: null,
    commentsEnabled: true,
    coHosts: [],
    ...overrides,
  };
}

export function makeRsvp(overrides = {}) {
  return {
    id: "rsvp-1",
    eventId: "event-1",
    guestName: "Alice",
    guestEmail: "alice@example.com",
    guestPhone: null,
    status: "GOING",
    plusOneCount: 0,
    editToken: "tok-abc",
    approved: true,
    responded: true,
    note: null,
    userId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

export function makeUser(overrides = {}) {
  return {
    id: "user-1",
    email: "user@example.com",
    phone: null,
    name: "Test User",
    role: "HOST" as const,
    avatarUrl: null,
    emailNotifications: true,
    smsNotifications: true,
    createdAt: new Date(),
    ...overrides,
  };
}

export function makePoll(overrides = {}) {
  return {
    id: "poll-1",
    eventId: "event-1",
    question: "What to eat?",
    multiChoice: false,
    allowGuestsToAdd: false,
    locked: false,
    hideVoters: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}
