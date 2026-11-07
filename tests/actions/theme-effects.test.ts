import "@/tests/helpers/english-request-locale";
import { beforeEach, describe, expect, it, vi } from "vitest";

// #825: saveEventTheme's effect fields — custom library mixtures, movement,
// size bounds, the atomic source/icon-list write and omitted-field semantics.

const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  find: vi.fn(),
  upsert: vi.fn(),
  captcha: vi.fn(),
  revalidate: vi.fn(),
}));
vi.mock("@/lib/db", () => ({
  db: { event: { findUnique: mocks.find }, eventTheme: { upsert: mocks.upsert } },
}));
vi.mock("@/lib/session", () => ({ getSession: mocks.session }));
vi.mock("@/lib/captcha", () => ({ assertCaptcha: mocks.captcha }));
vi.mock("@/lib/activity", () => ({ logActivity: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));

import { saveEventTheme, type ThemeExtras } from "@/app/actions/event/settings";

const save = (extras?: ThemeExtras, token = "captcha-token") =>
  saveEventTheme(
    "event-1",
    "DARK",
    "#7c3aed",
    "#1e40af",
    "#a855f7",
    undefined,
    undefined,
    extras,
    token
  );

const update = () => mocks.upsert.mock.calls[0][0].update as Record<string, unknown>;
const create = () => mocks.upsert.mock.calls[0][0].create as Record<string, unknown>;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.session.mockResolvedValue({ userId: "host-1", role: "HOST" });
  mocks.find.mockResolvedValue({
    id: "event-1",
    slug: "party",
    hostId: "host-1",
    coHosts: [{ userId: "cohost-1" }],
  });
  mocks.upsert.mockResolvedValue({});
  mocks.captcha.mockResolvedValue(undefined);
});

describe("saveEventTheme — library effects", () => {
  it("saves a custom mixture with all its settings in one write", async () => {
    await save({
      effectId: "custom",
      effectIconIds: ["noto:cat", "fluent-emoji-flat:red-heart", "fluent-emoji-flat:pizza"],
      effectDensity: "dense",
      effectSpeed: "gentle",
      effectSize: 6,
      effectMovement: "random",
    });
    expect(update()).toMatchObject({
      effectId: "custom",
      effectIconIds: ["noto:cat", "fluent-emoji-flat:red-heart", "fluent-emoji-flat:pizza"],
      effectDensity: "dense",
      effectSpeed: "gentle",
      effectSize: 6,
      effectMovement: "random",
    });
    expect(create()).toMatchObject({ effectId: "custom", effectMovement: "random" });
    expect(mocks.captcha).toHaveBeenCalledWith("event_theme", "captcha-token");
    expect(mocks.revalidate).toHaveBeenCalledWith("/e/party");
  });

  it("lets a co-host save, and refuses anyone else", async () => {
    mocks.session.mockResolvedValue({ userId: "cohost-1", role: "HOST" });
    await save({ effectId: "custom", effectIconIds: ["noto:cat"] });
    expect(mocks.upsert).toHaveBeenCalledTimes(1);

    mocks.upsert.mockClear();
    mocks.session.mockResolvedValue({ userId: "stranger", role: "HOST" });
    await expect(save({ effectId: "custom", effectIconIds: ["noto:cat"] })).rejects.toThrow(
      "Forbidden"
    );
    mocks.session.mockResolvedValue(null);
    await expect(save({ effectId: "snow" })).rejects.toThrow("Unauthorized");
    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  it("stops at the CAPTCHA before writing", async () => {
    mocks.captcha.mockRejectedValue(new Error("Captcha verification failed."));
    await expect(save({ effectId: "custom", effectIconIds: ["noto:cat"] }, "")).rejects.toThrow(
      "Captcha"
    );
    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  it("clears the stored icons when switching to a built-in set or None", async () => {
    await save({ effectId: "snow", effectIconIds: [] });
    expect(update()).toMatchObject({ effectId: "snow", effectIconIds: [] });
    mocks.upsert.mockClear();
    await save({ effectId: null });
    expect(update()).toMatchObject({ effectId: null, effectIconIds: [] });
  });

  it.each([
    ["no icons", { effectId: "custom", effectIconIds: [] }],
    ["missing list", { effectId: "custom" }],
    ["duplicates", { effectId: "custom", effectIconIds: ["noto:cat", "noto:cat"] }],
    [
      "a fourth icon",
      {
        effectId: "custom",
        effectIconIds: ["noto:cat", "noto:dog", "noto:red-heart", "noto:pizza"],
      },
    ],
    ["another collection", { effectId: "custom", effectIconIds: ["mdi:cat"] }],
    ["a nonexistent id", { effectId: "custom", effectIconIds: ["noto:not-a-real-icon"] }],
    ["a URL", { effectId: "custom", effectIconIds: ["https://cdn.example.com/cat.svg"] }],
    ["a traversal string", { effectId: "custom", effectIconIds: ["noto:../../etc/passwd"] }],
    ["markup", { effectId: "custom", effectIconIds: ["<svg onload=alert(1)>"] }],
    ["icons on a built-in", { effectId: "snow", effectIconIds: ["noto:cat"] }],
    ["icons without a source", { effectIconIds: ["noto:cat"] }],
  ])("rejects %s", async (_label, extras) => {
    await expect(save(extras as ThemeExtras)).rejects.toThrow(
      "Choose one to three available icons"
    );
    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  it("rejects an unknown movement, source or size", async () => {
    await expect(save({ effectMovement: "sideways" })).rejects.toThrow("Invalid effect movement");
    await expect(save({ effectId: "lasers" })).rejects.toThrow("Unknown effect");
    for (const effectSize of [0.5, 10.5, NaN, Infinity, -Infinity]) {
      await expect(save({ effectSize })).rejects.toThrow("Invalid effect size");
    }
    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  it("accepts the size bounds and any value between them", async () => {
    for (const effectSize of [1, 2.5, 6, 10]) {
      mocks.upsert.mockClear();
      await save({ effectSize });
      expect(update().effectSize).toBe(effectSize);
    }
  });

  it("leaves the stored effect alone when the save omits effect fields", async () => {
    await save({ fontId: "playfair" });
    const fields = update();
    for (const key of [
      "effectId",
      "effectIconIds",
      "effectDensity",
      "effectSpeed",
      "effectSize",
      "effectMovement",
    ]) {
      expect(fields, key).not.toHaveProperty(key);
    }
    mocks.upsert.mockClear();
    await save();
    expect(update()).not.toHaveProperty("effectIconIds");
  });

  it("clears movement back to inheriting with an explicit null", async () => {
    await save({ effectMovement: null });
    expect(update()).toMatchObject({ effectMovement: null });
    expect(update()).not.toHaveProperty("effectIconIds");
  });
});
