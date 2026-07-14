import "dotenv/config";
import bcrypt from "bcryptjs";
import { db } from "../lib/db";
import { UserModel, EventModel, RSVPFieldModel, RSVPModel } from "../app/generated/prisma/models";
import { THEME_PRESETS } from "../lib/theme";
import {
  DEFAULT_EFFECT_SIZE,
  isValidEffectDensity,
  isValidEffectId,
  isValidEffectSize,
  isValidEffectSpeed,
  type EffectDensity,
  type EffectSpeed,
} from "../lib/effects";
import { isValidFontId } from "../lib/fonts";

interface EventTemplate {
  title: string;
  description: string;
  startAt: Date;
  endAt?: Date;
  timezone?: string;
  locationType: "PHYSICAL" | "VIRTUAL" | "TBD";
  locationName?: string;
  locationAddress?: string;
  virtualUrl?: string;
  capacity?: number;
  rsvpDeadline?: Date;
  allowEditAfterDeadline?: boolean;
  approvalRequired?: boolean;
  visibility: "PUBLIC" | "UNLISTED" | "PRIVATE";
  status: "DRAFT" | "PUBLISHED" | "CANCELLED";
  guestListVis?: "ALL" | "GUESTS_ONLY" | "HOST_ONLY";
  guestSharingEnabled?: boolean;
  guestsCanInvite?: boolean;
  hostAlertEmail?: boolean;
  hostAlertSms?: boolean;
  showTimestamps?: boolean;
  password?: string;
  hostDisplayName?: string;
  theme: {
    baseTheme: "DARK" | "SOFT" | "BOLD";
    gradientFrom: string;
    gradientTo: string;
    accentColor: string;
    appliedPresetId?: string;
    cardOpacity?: number;
    fontId?: string;
    effectId?: string;
    effectDensity?: EffectDensity;
    effectSpeed?: EffectSpeed;
    effectSize?: number;
  };
  plusOneAllowed: boolean;
  plusOneMax?: number;
  plusOneNamesRequired?: boolean;
  commentsEnabled: boolean;
  maybeEnabled: boolean;
  questionnaireEnabled: boolean;
  cohost?: boolean;
  pendingCohostInvite?: boolean;
  invitedCount?: number;
  walkIn?: boolean;
  polls?: boolean;
  updateBlast?: boolean;
  infoSections?: { type: string; content: string; order: number }[];
  potluck?: { label: string; quantity: number }[];
}

function slugify(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}

function assertRichSeedCoverage(eventTemplates: EventTemplate[]) {
  const requirements: Record<string, boolean> = {
    "approval-required event": eventTemplates.some((event) => event.approvalRequired),
    "invited/unresponded guests": eventTemplates.some((event) => (event.invitedCount ?? 0) > 0),
    "custom heading fonts": eventTemplates.some((event) => event.theme.fontId),
    "animated theme effects": eventTemplates.some((event) => event.theme.effectId),
    "effect controls": eventTemplates.some(
      (event) =>
        event.theme.effectDensity !== undefined &&
        event.theme.effectSpeed !== undefined &&
        event.theme.effectSize !== undefined
    ),
    polls: eventTemplates.some((event) => event.polls),
    potluck: eventTemplates.some((event) => event.potluck?.length),
    questionnaires: eventTemplates.some((event) => event.questionnaireEnabled),
    "event update blasts": eventTemplates.some((event) => event.updateBlast),
    "pending co-host invitations": eventTemplates.some((event) => event.pendingCohostInvite),
    "cancelled events": eventTemplates.some((event) => event.status === "CANCELLED"),
    "RSVP deadlines": eventTemplates.some((event) => event.rsvpDeadline),
    "private password gates": eventTemplates.some(
      (event) => event.visibility === "PRIVATE" && event.password
    ),
    "all location modes": new Set(eventTemplates.map((event) => event.locationType)).size === 3,
    "all visibility modes": new Set(eventTemplates.map((event) => event.visibility)).size === 3,
    "all guest-list privacy modes":
      new Set(eventTemplates.map((event) => event.guestListVis ?? "ALL")).size === 3,
    "walk-in check-ins": eventTemplates.some((event) => event.walkIn),
  };

  const missing = Object.entries(requirements)
    .filter(([, covered]) => !covered)
    .map(([requirement]) => requirement);
  if (missing.length > 0) {
    throw new Error(`Rich seed is missing documented scenarios: ${missing.join(", ")}`);
  }

  const presetIds = new Set(THEME_PRESETS.map((preset) => preset.id));
  for (const event of eventTemplates) {
    const { theme } = event;
    if (theme.appliedPresetId && !presetIds.has(theme.appliedPresetId)) {
      throw new Error(`Invalid seed theme preset: ${theme.appliedPresetId}`);
    }
    if (!isValidFontId(theme.fontId)) throw new Error(`Invalid seed font: ${theme.fontId}`);
    if (!isValidEffectId(theme.effectId)) throw new Error(`Invalid seed effect: ${theme.effectId}`);
    if (!isValidEffectDensity(theme.effectDensity)) {
      throw new Error(`Invalid seed effect density: ${theme.effectDensity}`);
    }
    if (!isValidEffectSpeed(theme.effectSpeed)) {
      throw new Error(`Invalid seed effect speed: ${theme.effectSpeed}`);
    }
    if (!isValidEffectSize(theme.effectSize)) {
      throw new Error(`Invalid seed effect size: ${theme.effectSize}`);
    }
  }
}

async function main() {
  const code = process.env.HOST_INVITE_CODE ?? "letmein";

  await db.hostInviteCode.upsert({
    where: { code },
    update: {},
    create: { code, note: "Default invite code from seed" },
  });

  // Upsert theme presets so seed stays in sync with THEME_PRESETS (migration already inserted defaults)
  for (let i = 0; i < THEME_PRESETS.length; i++) {
    const p = THEME_PRESETS[i];
    await db.themePreset.upsert({
      where: { id: p.id },
      update: {
        name: p.name,
        emoji: p.emoji,
        base: p.base,
        gradientFrom: p.gradientFrom,
        gradientTo: p.gradientTo,
        accentColor: p.accentColor,
        seasonal: p.seasonal ?? false,
        month: p.month ?? null,
        fontId: p.fontId ?? null,
        sortOrder: i,
      },
      create: {
        id: p.id,
        name: p.name,
        emoji: p.emoji,
        base: p.base,
        gradientFrom: p.gradientFrom,
        gradientTo: p.gradientTo,
        accentColor: p.accentColor,
        seasonal: p.seasonal ?? false,
        month: p.month ?? null,
        fontId: p.fontId ?? null,
        active: true,
        sortOrder: i,
        originalSnapshot: {
          name: p.name,
          emoji: p.emoji,
          base: p.base,
          gradientFrom: p.gradientFrom,
          gradientTo: p.gradientTo,
          accentColor: p.accentColor,
          seasonal: p.seasonal ?? false,
          month: p.month ?? null,
          fontId: p.fontId ?? null,
        },
        defaultSnapshot: {
          name: p.name,
          emoji: p.emoji,
          base: p.base,
          gradientFrom: p.gradientFrom,
          gradientTo: p.gradientTo,
          accentColor: p.accentColor,
          seasonal: p.seasonal ?? false,
          month: p.month ?? null,
          fontId: p.fontId ?? null,
        },
      },
    });
  }
  console.log(`Upserted ${THEME_PRESETS.length} theme presets.`);

  // Upsert the SYSTEM tombstone user used when anonymizing deleted host accounts
  await db.user.upsert({
    where: { id: "system" },
    create: { id: "system", role: "ADMIN", name: "System", email: null, phone: null },
    update: {},
  });
  console.log("Upserted SYSTEM tombstone user.");

  console.log(`Seed complete. Default invite code: "${code}"`);

  // Check if we should seed heavy test data
  const seedTestData = process.env.SEED_TEST_DATA === "true";
  if (!seedTestData) {
    console.log("SEED_TEST_DATA is not set to 'true'. Skipping heavy test data seeding.");
    return;
  }

  const eventCount = await db.event.count();
  if (eventCount > 0) {
    console.log(
      "Database already contains events. Skipping heavy test data seeding to prevent duplication."
    );
    return;
  }

  console.log("SEED_TEST_DATA is 'true' and database is empty. Starting rich test data seeding...");

  // 1. Create Primary Admin, Host and Co-Host
  await db.user.upsert({
    where: { email: "admin@test.com" },
    update: { role: "ADMIN" },
    create: {
      email: "admin@test.com",
      name: "System Admin",
      role: "ADMIN",
    },
  });

  const host = await db.user.upsert({
    where: { email: "host@test.com" },
    update: { role: "HOST" },
    create: {
      email: "host@test.com",
      name: "Primary Host",
      role: "HOST",
    },
  });

  const cohost = await db.user.upsert({
    where: { email: "cohost@test.com" },
    update: { role: "HOST" },
    create: {
      email: "cohost@test.com",
      name: "Test Co-Host",
      role: "HOST",
    },
  });

  // 2. Create pool of 20 guest users
  const guestUsersData: { email: string; phone?: string; name: string }[] = [
    { email: "guest1@test.com", phone: "+15550000001", name: "Alice Smith" },
    { email: "guest2@test.com", phone: "+15550000002", name: "Bob Jones" },
    { email: "guest3@test.com", name: "Charlie Brown" },
    { email: "guest4@test.com", name: "Diana Prince" },
    { email: "guest5@test.com", name: "Ethan Hunt" },
    { email: "guest6@test.com", name: "Fiona Gallagher" },
    { email: "guest7@test.com", name: "George Clark" },
    { email: "guest8@test.com", name: "Hannah Abbott" },
    { email: "guest9@test.com", name: "Ian Malcolm" },
    { email: "guest10@test.com", name: "Julia Roberts" },
    { email: "guest11@test.com", name: "Kevin Bacon" },
    { email: "guest12@test.com", name: "Laura Croft" },
    { email: "guest13@test.com", name: "Michael Scott" },
    { email: "guest14@test.com", name: "Nancy Drew" },
    { email: "guest15@test.com", name: "Oscar Wilde" },
    { email: "guest16@test.com", name: "Penelope Cruz" },
    { email: "guest17@test.com", name: "Quentin Tarantino" },
    { email: "guest18@test.com", name: "Rachel Green" },
    { email: "guest19@test.com", name: "Sam Winchester" },
    { email: "guest20@test.com", name: "Tina Fey" },
  ];

  const guests: UserModel[] = [];
  for (const data of guestUsersData) {
    const u = await db.user.upsert({
      where: { email: data.email },
      update: {},
      create: {
        email: data.email,
        phone: data.phone,
        name: data.name,
        role: "GUEST",
      },
    });
    guests.push(u);
  }

  const now = new Date();

  // 3. Generate 10 diverse events
  const eventTemplates: EventTemplate[] = [
    // PAST EVENTS
    {
      title: "Wine Tasting & Cheese Night",
      description:
        "A cozy evening tasting local wines paired with artisanal cheeses. Dress code is smart casual.",
      startAt: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000), // 10 days ago
      endAt: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000),
      timezone: "America/Los_Angeles",
      locationType: "PHYSICAL" as const,
      locationName: "Primary Host's Dining Room",
      locationAddress: "123 Vineyard Lane, Napa Valley, CA",
      visibility: "PUBLIC" as const,
      status: "PUBLISHED" as const,
      theme: {
        baseTheme: "SOFT" as const,
        gradientFrom: "#fda4af",
        gradientTo: "#f0abfc",
        accentColor: "#d946ef",
        appliedPresetId: "rose-cloud",
        cardOpacity: 0.82,
        fontId: "playfair",
        effectId: "hearts",
        effectDensity: "sparse" as const,
        effectSpeed: "gentle" as const,
        effectSize: 2,
      }, // magenta
      plusOneAllowed: true,
      plusOneMax: 2,
      commentsEnabled: true,
      maybeEnabled: true,
      questionnaireEnabled: false,
      showTimestamps: false,
      polls: true,
      updateBlast: true,
      walkIn: true,
      infoSections: [
        { type: "shirt", content: "Smart casual / cozy attire", order: 1 },
        {
          type: "utensils",
          content: "Artisanal cheeses provided, feel free to bring a bottle of your favorite wine!",
          order: 2,
        },
      ],
    },
    {
      title: "Virtual Board Games Night",
      description:
        "Join us online for some Codenames, Gartic Phone, and Jackbox games! Grab your favorite drinks and snacks.",
      startAt: new Date(now.getTime() - 18 * 24 * 60 * 60 * 1000), // 18 days ago
      locationType: "VIRTUAL" as const,
      virtualUrl: "https://zoom.us/j/123456789",
      visibility: "UNLISTED" as const,
      status: "PUBLISHED" as const,
      theme: {
        baseTheme: "DARK" as const,
        gradientFrom: "#164e63",
        gradientTo: "#1e3a5f",
        accentColor: "#06b6d4",
        appliedPresetId: "deep-sea",
        fontId: "space-grotesk",
        effectId: "stars",
        effectDensity: "dense" as const,
        effectSpeed: "lively" as const,
        effectSize: 1,
      }, // cyan
      plusOneAllowed: false,
      commentsEnabled: true,
      maybeEnabled: false,
      questionnaireEnabled: false,
      guestListVis: "GUESTS_ONLY" as const,
    },
    {
      title: "Spontaneous Coffee Hangout",
      description: "Catching up over some afternoon brew.",
      startAt: new Date(now.getTime() - 25 * 24 * 60 * 60 * 1000), // 25 days ago
      locationType: "TBD" as const,
      visibility: "PRIVATE" as const,
      status: "CANCELLED" as const,
      guestsCanInvite: true,
      guestListVis: "HOST_ONLY" as const,
      guestSharingEnabled: false,
      password: "coffee-friends-only",
      theme: {
        baseTheme: "BOLD" as const,
        gradientFrom: "#f97316",
        gradientTo: "#ec4899",
        accentColor: "#f97316",
        appliedPresetId: "sunset",
        cardOpacity: 0.65,
        fontId: "caveat",
      }, // orange
      plusOneAllowed: true,
      plusOneMax: 1,
      commentsEnabled: false,
      maybeEnabled: true,
      questionnaireEnabled: false,
      hostDisplayName: "Your Neighborhood Coffee Crew",
      invitedCount: 2,
    },
    // PRESENT/UPCOMING EVENTS
    {
      title: "Summer Backyard BBQ",
      description:
        "Burgers, hot dogs, cold drinks, and lawn games! We've got a pool, so bring your swimsuits and towels.",
      startAt: new Date(now.getTime() + 2 * 60 * 60 * 1000), // today in 2 hours
      locationType: "PHYSICAL" as const,
      locationName: "Host's Backyard Oasis",
      locationAddress: "456 Sunny Meadow Lane, Austin, TX",
      visibility: "PUBLIC" as const,
      status: "PUBLISHED" as const,
      approvalRequired: true,
      theme: {
        baseTheme: "SOFT" as const,
        gradientFrom: "#bbf7d0",
        gradientTo: "#a5f3fc",
        accentColor: "#10b981",
        appliedPresetId: "summer",
        fontId: "fredoka",
        effectId: "sun-palms",
        effectDensity: "medium" as const,
        effectSpeed: "medium" as const,
        effectSize: 3,
      }, // emerald
      plusOneAllowed: true,
      plusOneMax: 2,
      plusOneNamesRequired: true,
      commentsEnabled: true,
      maybeEnabled: true,
      questionnaireEnabled: true,
      cohost: true, // cohost cohost@test.com
      invitedCount: 3,
      pendingCohostInvite: true,
      polls: true,
      updateBlast: true,
      infoSections: [
        { type: "shirt", content: "Swimwear, sunglasses, sunscreen!", order: 1 },
        {
          type: "parking",
          content: "Please park on the street, don't block the driveway.",
          order: 2,
        },
        { type: "utensils", content: "Potluck structure! Claim an item below.", order: 3 },
      ],
      potluck: [
        { label: "Burger Buns (8-pack)", quantity: 3 },
        { label: "Soda / Seltzer cans", quantity: 24 },
        { label: "Potato Chips & Dip", quantity: 4 },
        { label: "Watermelon slices", quantity: 2 },
        { label: "Paper Plates & Napkins", quantity: 100 },
        { label: "Ice Bag", quantity: 2 },
      ],
    },
    {
      title: "Launch Party Celebration",
      description:
        "Celebrating our product release! Champagne toast, hors d'oeuvres, and live music.",
      startAt: new Date(now.getTime() + 24 * 60 * 60 * 1000), // tomorrow
      locationType: "PHYSICAL" as const,
      locationName: "The Penthouse Loft",
      locationAddress: "789 Skyline Blvd, New York, NY",
      capacity: 50,
      visibility: "PUBLIC" as const,
      status: "PUBLISHED" as const,
      rsvpDeadline: new Date(now.getTime() + 12 * 60 * 60 * 1000),
      allowEditAfterDeadline: true,
      theme: {
        baseTheme: "BOLD" as const,
        gradientFrom: "#7c3aed",
        gradientTo: "#ec4899",
        accentColor: "#8b5cf6",
        appliedPresetId: "ultraviolet",
        cardOpacity: 0.72,
        fontId: "righteous",
        effectId: "confetti",
        effectDensity: "dense" as const,
        effectSpeed: "lively" as const,
        effectSize: 4,
      }, // violet
      plusOneAllowed: true,
      plusOneMax: 1,
      plusOneNamesRequired: false,
      commentsEnabled: true,
      maybeEnabled: true,
      questionnaireEnabled: true,
      invitedCount: 2,
      hostAlertSms: true,
    },
    {
      title: "Weekly Team Sync",
      description:
        "Weekly sync meeting for the engineering and design teams. Reviewing roadmaps and feedback.",
      startAt: new Date(now.getTime() + 4 * 60 * 60 * 1000), // today in 4 hours
      locationType: "VIRTUAL" as const,
      virtualUrl: "https://meet.google.com/abc-defg-hij",
      visibility: "UNLISTED" as const,
      status: "PUBLISHED" as const,
      theme: {
        baseTheme: "DARK" as const,
        gradientFrom: "#334155",
        gradientTo: "#0f172a",
        accentColor: "#64748b",
        appliedPresetId: "obsidian",
        fontId: "roboto",
        effectId: "bubbles",
        effectDensity: "sparse" as const,
        effectSpeed: "gentle" as const,
        effectSize: DEFAULT_EFFECT_SIZE,
      }, // slate
      plusOneAllowed: false,
      commentsEnabled: true,
      maybeEnabled: true,
      questionnaireEnabled: false,
      hostAlertEmail: false,
    },
    {
      title: "Friday Pizza Social",
      description: "End of the week wind-down with wood-fired pizzas and cold beers.",
      startAt: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000), // in 2 days
      locationType: "PHYSICAL" as const,
      locationName: "Pizzeria Locale",
      locationAddress: "101 Crust St, Chicago, IL",
      visibility: "PUBLIC" as const,
      status: "PUBLISHED" as const,
      theme: {
        baseTheme: "SOFT" as const,
        gradientFrom: "#fecdd3",
        gradientTo: "#fda4af",
        accentColor: "#f43f5e",
        appliedPresetId: "flamingo",
        fontId: "pacifico",
        effectId: "beer",
        effectDensity: "medium" as const,
        effectSpeed: "medium" as const,
        effectSize: 2.5,
      }, // rose
      plusOneAllowed: true,
      plusOneMax: 3,
      commentsEnabled: true,
      maybeEnabled: true,
      questionnaireEnabled: false,
      invitedCount: 2,
    },
    // FUTURE EVENTS
    {
      title: "Halloween Costume Bash",
      description:
        "Spooky season is here! Costume contest, pumpkin carving, and spooky punch. Best costume wins a prize!",
      startAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000), // in 30 days
      locationType: "PHYSICAL" as const,
      locationName: "The Haunted Mansion",
      locationAddress: "666 Cobweb Lane, Salem, MA",
      visibility: "PUBLIC" as const,
      status: "PUBLISHED" as const,
      theme: {
        baseTheme: "DARK" as const,
        gradientFrom: "#9a3412",
        gradientTo: "#1c1917",
        accentColor: "#ea580c",
        appliedPresetId: "halloween",
        fontId: "bebas",
        effectId: "halloween",
        effectDensity: "dense" as const,
        effectSpeed: "lively" as const,
        effectSize: 5,
      }, // orange
      plusOneAllowed: true,
      plusOneMax: 2,
      commentsEnabled: true,
      maybeEnabled: true,
      questionnaireEnabled: false,
      cohost: true, // cohost cohost@test.com
      polls: true,
      infoSections: [
        {
          type: "shirt",
          content: "MANDATORY: You must wear a costume! Dress to impress.",
          order: 1,
        },
        { type: "info", content: "Best costume prize details announced at 10 PM.", order: 2 },
      ],
    },
    {
      title: "New Year's Eve Gala",
      description:
        "Welcome the new year in style! Elegant dinner, ballroom dancing, and balloon drop at midnight.",
      startAt: new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000), // in 60 days
      locationType: "PHYSICAL" as const,
      locationName: "Grand Plaza Ballroom",
      locationAddress: "777 Glittering Ave, Las Vegas, NV",
      capacity: 100,
      visibility: "PUBLIC" as const,
      status: "PUBLISHED" as const,
      theme: {
        baseTheme: "BOLD" as const,
        gradientFrom: "#eab308",
        gradientTo: "#f97316",
        accentColor: "#eab308",
        appliedPresetId: "new-years",
        cardOpacity: 0.88,
        fontId: "dancing-script",
        effectId: "fireworks",
        effectDensity: "dense" as const,
        effectSpeed: "medium" as const,
        effectSize: 6,
      }, // yellow/gold
      plusOneAllowed: true,
      plusOneMax: 1,
      commentsEnabled: true,
      maybeEnabled: true,
      questionnaireEnabled: false,
      updateBlast: true,
    },
    {
      title: "Spring Picnic",
      description:
        "Soaking up the sun and enjoying the blooming flowers. Bringing frisbees, blankets, and light snacks.",
      startAt: new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000), // in 90 days
      locationType: "TBD" as const,
      visibility: "PUBLIC" as const,
      status: "DRAFT" as const,
      theme: {
        baseTheme: "SOFT" as const,
        gradientFrom: "#ccfbf1",
        gradientTo: "#a5f3fc",
        accentColor: "#14b8a6",
        appliedPresetId: "spring",
        fontId: "lora",
        effectId: "blossoms",
        effectDensity: "sparse" as const,
        effectSpeed: "gentle" as const,
        effectSize: 1.5,
      }, // teal
      plusOneAllowed: true,
      plusOneMax: 2,
      commentsEnabled: true,
      maybeEnabled: true,
      questionnaireEnabled: false,
      invitedCount: 1,
    },
  ];

  assertRichSeedCoverage(eventTemplates);

  for (const temp of eventTemplates) {
    const slug = slugify(temp.title);
    const event = await db.event.create({
      data: {
        slug,
        title: temp.title,
        description: temp.description,
        startAt: temp.startAt,
        endAt: temp.endAt,
        timezone: temp.timezone ?? "America/New_York",
        locationType: temp.locationType,
        locationName: temp.locationName,
        locationAddress: temp.locationAddress,
        virtualUrl: temp.virtualUrl,
        capacity: temp.capacity,
        rsvpDeadline: temp.rsvpDeadline,
        allowEditAfterDeadline: temp.allowEditAfterDeadline ?? false,
        approvalRequired: temp.approvalRequired ?? false,
        visibility: temp.visibility,
        hostId: host.id,
        status: temp.status,
        guestListVis: temp.guestListVis ?? "ALL",
        guestSharingEnabled: temp.guestSharingEnabled ?? true,
        guestsCanInvite: temp.guestsCanInvite ?? false,
        hostAlertEmail: temp.hostAlertEmail ?? true,
        hostAlertSms: temp.hostAlertSms ?? false,
        plusOneAllowed: temp.plusOneAllowed,
        plusOneMax: temp.plusOneMax ?? 1,
        plusOneNamesRequired: temp.plusOneNamesRequired ?? false,
        commentsEnabled: temp.commentsEnabled,
        maybeEnabled: temp.maybeEnabled,
        questionnaireEnabled: temp.questionnaireEnabled,
        showTimestamps: temp.showTimestamps ?? true,
        passwordHash: temp.password ? await bcrypt.hash(temp.password, 10) : null,
        hostDisplayName: temp.hostDisplayName,
        createdAt: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000), // Created 30 days ago
      },
    });

    // Create theme
    await db.eventTheme.create({
      data: {
        eventId: event.id,
        baseTheme: temp.theme.baseTheme,
        gradientFrom: temp.theme.gradientFrom,
        gradientTo: temp.theme.gradientTo,
        accentColor: temp.theme.accentColor,
        appliedPresetId: temp.theme.appliedPresetId,
        cardOpacity: temp.theme.cardOpacity,
        fontId: temp.theme.fontId,
        effectId: temp.theme.effectId,
        effectDensity: temp.theme.effectDensity,
        effectSpeed: temp.theme.effectSpeed,
        effectSize: temp.theme.effectSize,
      },
    });

    // Create reminder settings
    await db.eventReminderSettings.create({
      data: {
        eventId: event.id,
        emailWeekBefore: false,
        emailDayBefore: true,
        emailHoursBefore: 2,
        smsWeekBefore: false,
        smsDayBefore: false,
        smsHoursBefore: 0,
        nudgeUnresponded: true,
      },
    });

    // Co-host
    if (temp.cohost) {
      await db.eventCoHost.create({
        data: {
          eventId: event.id,
          userId: cohost.id,
        },
      });
    }

    if (temp.pendingCohostInvite) {
      await db.coHostInvitation.create({
        data: {
          eventId: event.id,
          email: "future-cohost@test.com",
          token: `seed-cohost-${event.slug}`,
          expiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
        },
      });
    }

    // Info sections
    if (temp.infoSections) {
      for (const info of temp.infoSections) {
        await db.eventInfoSection.create({
          data: {
            eventId: event.id,
            type: info.type,
            content: info.content,
            order: info.order,
          },
        });
      }
    }

    // Potluck items
    if (temp.potluck) {
      for (const p of temp.potluck) {
        await db.potluckItem.create({
          data: {
            eventId: event.id,
            label: p.label,
            quantity: p.quantity,
          },
        });
      }
    }

    if (temp.updateBlast) {
      await db.eventUpdate.create({
        data: {
          eventId: event.id,
          body: "Seeded event update: details have been refreshed. Check the event page for more information.",
          notifyGuests: true,
          createdAt: new Date(event.createdAt.getTime() + 20 * 60 * 60 * 1000),
        },
      });
    }

    if (temp.polls) {
      await seedPolls(event, guests);
    }

    // Seed RSVPs, comments, checkins, potluck claims, etc.
    await seedRsvpsAndRelatedData(event, temp, guests);
  }

  console.log("Rich test data seeding complete!");
}

async function seedPolls(event: EventModel, guests: UserModel[]) {
  const poll = await db.poll.create({
    data: {
      eventId: event.id,
      question: "Which activity should we add?",
      multiChoice: true,
      allowGuestsToAdd: true,
      hideVoters: false,
      options: {
        create: [
          { text: "Photo booth" },
          { text: "Trivia", creatorName: guests[0].name },
          { text: "Dance contest" },
        ],
      },
    },
    include: { options: true },
  });

  for (let i = 0; i < poll.options.length; i++) {
    await db.pollVote.create({
      data: {
        pollId: poll.id,
        pollOptionId: poll.options[i].id,
        voterName: guests[i].name ?? `Guest ${i + 1}`,
        userId: guests[i].id,
      },
    });
  }

  await db.poll.create({
    data: {
      eventId: event.id,
      question: "Which start time works best?",
      locked: true,
      hideVoters: true,
      options: { create: [{ text: "6:00 PM" }, { text: "7:00 PM" }] },
    },
  });
}

async function seedRsvpsAndRelatedData(
  event: EventModel,
  eventTemp: EventTemplate,
  guests: UserModel[]
) {
  const now = new Date();
  let numGuests = 8;
  if (eventTemp.title.includes("BBQ")) numGuests = 16;
  else if (eventTemp.title.includes("Launch")) numGuests = 12;
  else if (eventTemp.title.includes("Halloween")) numGuests = 14;
  else if (eventTemp.title.includes("Gala")) numGuests = 10;
  else if (eventTemp.title.includes("Pizza")) numGuests = 9;
  else if (eventTemp.title.includes("Sync")) numGuests = 5;
  else if (eventTemp.title.includes("Games")) numGuests = 6;
  else if (eventTemp.title.includes("Coffee")) numGuests = 4;
  else if (eventTemp.title.includes("Spring")) numGuests = 3;

  const eventGuests = guests.slice(0, numGuests);

  // Handle Questionnaire fields
  let rsvpFields: RSVPFieldModel[] = [];
  if (eventTemp.questionnaireEnabled) {
    const field1 = await db.rSVPField.create({
      data: {
        eventId: event.id,
        label: "What is your food preference?",
        fieldType: "SELECT",
        required: true,
        options: JSON.stringify(["Vegetarian", "Vegan", "Gluten-Free", "No preference"]),
        order: 1,
      },
    });
    const field2 = await db.rSVPField.create({
      data: {
        eventId: event.id,
        label: "Any songs you'd like to add to the playlist?",
        fieldType: "TEXT",
        required: false,
        order: 2,
      },
    });
    const field3 = await db.rSVPField.create({
      data: {
        eventId: event.id,
        label: "Which activities interest you?",
        fieldType: "CHECKBOX",
        required: false,
        options: JSON.stringify(["Games", "Dancing", "Conversation", "Photos"]),
        order: 3,
      },
    });
    const field4 = await db.rSVPField.create({
      data: {
        eventId: event.id,
        label: "Anything else the host should know?",
        fieldType: "TEXTAREA",
        required: false,
        order: 4,
      },
    });
    rsvpFields = [field1, field2, field3, field4];
  }

  // Get existing potluck items for claiming
  const potluckItems = await db.potluckItem.findMany({
    where: { eventId: event.id },
  });
  let potluckItemIdx = 0;

  const rsvps: RSVPModel[] = [];
  const guestComments: { name: string; body: string; rsvpId?: string }[] = [];

  for (let i = 0; i < eventGuests.length; i++) {
    const guestUser = eventGuests[i];

    // Deterministic status mapping
    let status: "GOING" | "MAYBE" | "NO" = "GOING";
    if (i % 5 === 4) {
      status = "NO";
    } else if (i % 3 === 2) {
      status = eventTemp.maybeEnabled ? "MAYBE" : "GOING";
    }

    let plusOneCount = 0;
    if (status === "GOING" && eventTemp.plusOneAllowed) {
      if (i % 3 === 1) {
        plusOneCount = Math.min(1, eventTemp.plusOneMax ?? 1);
      } else if (i % 6 === 0) {
        plusOneCount = Math.min(2, eventTemp.plusOneMax ?? 2);
      }
    }

    const notePool = [
      "Can't wait!",
      "Bringing wine!",
      "Might be slightly late",
      "Excited for this!",
      "Thanks for hosting!",
      "Let me know if you need help setting up",
      "Sad to miss it!",
      "Hope you all have fun!",
    ];

    let note: string | null = null;
    if (i % 2 === 0) {
      if (status === "NO") {
        note = "So sorry, I have a conflict that day!";
      } else {
        note = notePool[i % notePool.length];
      }
    }

    // Create RSVP
    const rsvp = await db.rSVP.create({
      data: {
        eventId: event.id,
        guestName: guestUser.name ?? "Guest",
        guestEmail: guestUser.email,
        status,
        plusOneCount,
        approved: !(eventTemp.approvalRequired && i < 2),
        responded: true,
        note,
        userId: guestUser.id,
        createdAt: new Date(event.createdAt.getTime() + (i + 1) * 60 * 60 * 1000), // Seeded over a timeline
      },
    });
    rsvps.push(rsvp);

    // Seed PlusOneGuest records if plusOneCount > 0
    if (plusOneCount > 0) {
      for (let pIdx = 0; pIdx < plusOneCount; pIdx++) {
        await db.plusOneGuest.create({
          data: {
            rsvpId: rsvp.id,
            name: `${guestUser.name ?? "Guest"}'s Guest ${pIdx + 1}`,
            order: pIdx,
          },
        });
      }
    }

    // Seed Questionnaire RSVP Answers
    if (rsvpFields.length > 0 && status === "GOING") {
      const foodPrefPool = ["Vegetarian", "Vegan", "Gluten-Free", "No preference"];
      await db.rSVPAnswer.create({
        data: {
          rsvpId: rsvp.id,
          rsvpFieldId: rsvpFields[0].id,
          value: foodPrefPool[i % foodPrefPool.length],
        },
      });

      const songPool = ["Dancing Queen", "September", "Blinding Lights", "Bohemian Rhapsody"];
      if (i % 2 === 0) {
        await db.rSVPAnswer.create({
          data: {
            rsvpId: rsvp.id,
            rsvpFieldId: rsvpFields[1].id,
            value: songPool[i % songPool.length],
          },
        });
      }

      await db.rSVPAnswer.create({
        data: {
          rsvpId: rsvp.id,
          rsvpFieldId: rsvpFields[2].id,
          value: JSON.stringify(i % 2 === 0 ? ["Games", "Photos"] : ["Conversation"]),
        },
      });

      if (i % 3 === 0) {
        await db.rSVPAnswer.create({
          data: {
            rsvpId: rsvp.id,
            rsvpFieldId: rsvpFields[3].id,
            value: "Please save me a seat near the entrance.",
          },
        });
      }
    }

    // Potluck Item claim
    if (
      status === "GOING" &&
      potluckItems.length > 0 &&
      i % 2 === 0 &&
      potluckItemIdx < potluckItems.length
    ) {
      const item = potluckItems[potluckItemIdx];
      await db.potluckClaim.create({
        data: {
          potluckItemId: item.id,
          guestName: guestUser.name || "Guest",
          quantity: 1,
          createdAt: new Date(rsvp.createdAt.getTime() + 5 * 60 * 1000), // claimed 5 mins after RSVPing
        },
      });
      potluckItemIdx++;
    }

    // Prepare comments
    if (i % 3 === 0) {
      const commentPool = [
        "This looks like it's going to be so much fun!",
        "Can I bring anything else?",
        "So excited for this event, count me in!",
        "Is there a dress code?",
        "Should we bring our own drinks?",
      ];
      guestComments.push({
        name: guestUser.name ?? "Guest",
        body: commentPool[i % commentPool.length],
        rsvpId: rsvp.id,
      });
    }

    // Check-ins for past events (checked in near startAt)
    const isPast = event.startAt.getTime() < now.getTime();
    if (
      isPast &&
      event.status !== "CANCELLED" &&
      status === "GOING" &&
      rsvp.approved &&
      i % 5 !== 4
    ) {
      await db.checkIn.create({
        data: {
          eventId: event.id,
          rsvpId: rsvp.id,
          checkedInAt: new Date(event.startAt.getTime() + (i * 3 - 5) * 60 * 1000),
          checkedInBy: i % 2 === 0 ? "host@test.com" : "cohost@test.com",
        },
      });
    }
  }

  const invitedGuests = guests.slice(numGuests, numGuests + (eventTemp.invitedCount ?? 0));
  for (let i = 0; i < invitedGuests.length; i++) {
    const guestUser = invitedGuests[i];
    const channel = i % 2 === 0 ? "EMAIL" : "SMS";
    const rsvp = await db.rSVP.create({
      data: {
        eventId: event.id,
        guestName: guestUser.name ?? "Invited Guest",
        guestEmail: guestUser.email,
        guestPhone: channel === "SMS" ? `+15550100${String(numGuests + i).padStart(3, "0")}` : null,
        status: "INVITED",
        approved: true,
        responded: false,
        userId: guestUser.id,
        createdAt: new Date(event.createdAt.getTime() + (numGuests + i + 1) * 60 * 60 * 1000),
      },
    });
    rsvps.push(rsvp);

    await db.invitation.create({
      data: {
        eventId: event.id,
        sentTo:
          channel === "EMAIL"
            ? (guestUser.email ?? "invited@test.com")
            : (rsvp.guestPhone ?? "+15550100000"),
        channel,
        rsvpId: rsvp.id,
        sentAt: new Date(rsvp.createdAt.getTime() + 5 * 60 * 1000),
      },
    });
  }

  if (eventTemp.walkIn) {
    const walkIn = await db.rSVP.create({
      data: {
        eventId: event.id,
        guestName: "Morgan Walk-In",
        status: "GOING",
        plusOneCount: 1,
        approved: true,
        responded: true,
        note: "Added at the door by the host.",
        createdAt: new Date(event.startAt.getTime() + 10 * 60 * 1000),
      },
    });
    rsvps.push(walkIn);
    await db.plusOneGuest.create({
      data: { rsvpId: walkIn.id, name: "Morgan's Guest", order: 0 },
    });
    await db.checkIn.create({
      data: {
        eventId: event.id,
        rsvpId: walkIn.id,
        checkedInAt: new Date(event.startAt.getTime() + 10 * 60 * 1000),
        checkedInBy: "host@test.com",
      },
    });
  }

  // Create threaded comments
  for (let cIdx = 0; cIdx < guestComments.length; cIdx++) {
    const gc = guestComments[cIdx];
    const parentComment = await db.comment.create({
      data: {
        eventId: event.id,
        guestName: gc.name,
        rsvpId: gc.rsvpId,
        body: gc.body,
        createdAt: new Date(event.createdAt.getTime() + (cIdx + 1) * 3 * 60 * 60 * 1000),
      },
    });

    // Threaded Host reply
    if (cIdx % 2 === 0) {
      await db.comment.create({
        data: {
          eventId: event.id,
          guestName: "Primary Host (Host)",
          body: `Thanks for the comment, ${gc.name}! Can't wait to see you there!`,
          parentId: parentComment.id,
          createdAt: new Date(parentComment.createdAt.getTime() + 30 * 60 * 1000),
        },
      });
    } else if (eventTemp.cohost && cIdx % 3 === 1) {
      // Threaded Co-Host reply
      await db.comment.create({
        data: {
          eventId: event.id,
          guestName: "Test Co-Host (Co-Host)",
          body: `Hey ${gc.name}! Yes, street parking is available. See you soon!`,
          parentId: parentComment.id,
          createdAt: new Date(parentComment.createdAt.getTime() + 45 * 60 * 1000),
        },
      });
    }
  }

  // Timeline History / Activity Logs
  await db.activityEvent.create({
    data: {
      eventId: event.id,
      type: "event_title",
      actorName: "Primary Host",
      detail: `created the event: "${event.title}"`,
      createdAt: new Date(event.createdAt.getTime() + 1000),
    },
  });

  if (eventTemp.infoSections && eventTemp.infoSections.length > 0) {
    await db.activityEvent.create({
      data: {
        eventId: event.id,
        type: "info_add",
        actorName: "Primary Host",
        detail: `added info section details`,
        createdAt: new Date(event.createdAt.getTime() + 10 * 60 * 1000),
      },
    });
  }

  if ((eventTemp.invitedCount ?? 0) > 0) {
    await db.activityEvent.create({
      data: {
        eventId: event.id,
        type: "invite_sent",
        actorName: "Primary Host",
        detail: `invited ${eventTemp.invitedCount} guests by email and SMS`,
        createdAt: new Date(event.createdAt.getTime() + 15 * 60 * 1000),
      },
    });
  }

  if (eventTemp.updateBlast) {
    await db.activityEvent.create({
      data: {
        eventId: event.id,
        type: "update_sent",
        actorName: "Primary Host",
        detail: "sent an event update to Going and Maybe guests",
        createdAt: new Date(event.createdAt.getTime() + 20 * 60 * 60 * 1000),
      },
    });
  }

  // Activity events for first 4 RSVPs
  for (let rIdx = 0; rIdx < Math.min(4, rsvps.length); rIdx++) {
    const r = rsvps[rIdx];
    await db.activityEvent.create({
      data: {
        eventId: event.id,
        type: "rsvp_new",
        actorName: r.guestName,
        detail: `RSVPed ${r.status}${r.plusOneCount > 0 ? ` (+${r.plusOneCount})` : ""}`,
        createdAt: new Date(r.createdAt.getTime() + 2000),
      },
    });
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
