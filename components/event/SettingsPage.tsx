"use client";

import { useState, useTransition, useEffect, useMemo } from "react";
import { ArrowLeft, Check, Plus, X } from "lucide-react";
import { ACCENT_PRESETS, BASE_THEMES, type BaseTheme, resolveTheme, type ResolvedTheme, getSortedPresets } from "@/lib/theme";
import {
  saveEventSettings,
  saveEventTheme,
  saveReminderSettings,
  addCoHost,
  removeCoHost,
  addRsvpField,
  updateRsvpField,
  deleteRsvpField,
  createPoll,
  deletePoll,
  addPollOption,
  deletePollOption,
  updatePollSettings,
  addPotluckItem,
  removePotluckItem,
  unclaimPotluckItem,
} from "@/app/actions/event";

type CoHostEntry = { id: string; user: { id: string; name: string | null; email: string } };

type RsvpFieldEntry = {
  id: string;
  label: string;
  fieldType: "TEXT" | "TEXTAREA" | "SELECT" | "CHECKBOX";
  required: boolean;
  options: string | null;
  order: number;
};

type PollOptionEntry = {
  id: string;
  pollId: string;
  text: string;
  creatorName: string | null;
  createdAt: Date;
  votes: { id: string; voterName: string; createdAt: Date }[];
};

type PollEntry = {
  id: string;
  eventId: string;
  question: string;
  multiChoice: boolean;
  allowGuestsToAdd: boolean;
  locked: boolean;
  hideVoters: boolean;
  createdAt: Date;
  updatedAt: Date;
  options: PollOptionEntry[];
};

type PotluckClaimEntry = {
  id: string;
  potluckItemId: string;
  guestName: string;
  quantity: number;
  createdAt: Date;
};

type PotluckItemEntry = {
  id: string;
  eventId: string;
  label: string;
  quantity: number;
  createdAt: Date;
  claims: PotluckClaimEntry[];
};

type EventInput = {
  id: string;
  slug: string;
  commentsEnabled: boolean;
  plusOneAllowed: boolean;
  plusOneMax: number;
  plusOneNamesRequired: boolean;
  guestSharingEnabled: boolean;
  guestsCanInvite: boolean;
  approvalRequired: boolean;
  rsvpDeadline: Date | null;
  capacity: number | null;
  guestListVis: "ALL" | "GUESTS_ONLY" | "HOST_ONLY";
  visibility: "PUBLIC" | "UNLISTED" | "PRIVATE";
  maybeEnabled: boolean;
  questionnaireEnabled: boolean;
  showTimestamps: boolean;
  password: string | null;
  theme: { baseTheme: "DARK" | "SOFT" | "BOLD"; gradientFrom: string; gradientTo: string; accentColor: string; coverImageUrl: string | null; appliedPresetId?: string | null } | null;
  reminderSettings: {
    emailWeekBefore: boolean; emailDayBefore: boolean; emailHoursBefore: number;
    smsWeekBefore: boolean; smsDayBefore: boolean; smsHoursBefore: number;
    nudgeUnresponded: boolean;
  } | null;
  coHosts: CoHostEntry[];
  rsvpFields: RsvpFieldEntry[];
  polls: PollEntry[];
  potluckItems: PotluckItemEntry[];
};

interface SettingsOverrides {
  commentsEnabled?: boolean;
  plusOneAllowed?: boolean;
  plusOneMax?: number;
  plusOneNamesRequired?: boolean;
  approvalRequired?: boolean;
  rsvpDeadline?: string | null;
  capacity?: number | null;
  guestListVis?: "ALL" | "GUESTS_ONLY" | "HOST_ONLY";
  visibility?: "PUBLIC" | "UNLISTED" | "PRIVATE";
  maybeEnabled?: boolean;
  questionnaireEnabled?: boolean;
  showTimestamps?: boolean;
  password?: string | null;
  guestSharingEnabled?: boolean;
  guestsCanInvite?: boolean;
}

interface ReminderOverrides {
  emailWeekBefore?: boolean;
  emailDayBefore?: boolean;
  emailHoursBefore?: number;
  smsWeekBefore?: boolean;
  smsDayBefore?: boolean;
  smsHoursBefore?: number;
  nudgeUnresponded?: boolean;
}

const formatOptionsForTextarea = (optionsStr: string | null): string => {
  if (!optionsStr) return "";
  try {
    const parsed = JSON.parse(optionsStr);
    if (Array.isArray(parsed)) {
      return parsed.join("\n");
    }
  } catch {
    // fallback
  }
  return optionsStr;
};

const serializeOptionsForDb = (optionsStr: string): string => {
  const list = optionsStr.split("\n").map(s => s.trim()).filter(Boolean);
  return JSON.stringify(list);
};

type ThemeSnapObj = {
  name: string;
  emoji: string;
  base: "DARK" | "SOFT" | "BOLD";
  gradientFrom: string;
  gradientTo: string;
  accentColor: string;
  seasonal: boolean;
  month?: number | null;
};

type DbThemePreset = {
  id: string;
  name: string;
  emoji: string;
  base: "DARK" | "SOFT" | "BOLD";
  gradientFrom: string;
  gradientTo: string;
  accentColor: string;
  seasonal?: boolean | null;
  month?: number | null;
  defaultSnapshot?: unknown;
};

export function SettingsPage({ event, isOwner, themePresets = [] }: { event: EventInput; isOwner: boolean; themePresets?: DbThemePreset[] }) {
  const [isPending, startTransition] = useTransition();
  const [saveStatus, setSaveStatus] = useState<"IDLE" | "SAVING" | "SAVED" | "ERROR">("IDLE");
  const [err, setErr] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<"theme" | "hosts" | "rsvp" | "questionnaire" | "privacy" | "reminders" | "polls" | "potluck" | null>(null);

  // ── Theme State ──
  const [base, setBase] = useState<BaseTheme>(event.theme?.baseTheme ?? "DARK");
  const [gradientFrom, setGradientFrom] = useState(event.theme?.gradientFrom ?? "#7c3aed");
  const [gradientTo, setGradientTo] = useState(event.theme?.gradientTo ?? "#1e40af");
  const [accent, setAccent] = useState(event.theme?.accentColor ?? "#a855f7");
  const [themePresetId, setThemePresetId] = useState<string | null>(event.theme?.appliedPresetId ?? null);
  const [themeSearch, setThemeSearch] = useState("");
  const [themeFilter, setThemeFilter] = useState<"all" | "seasonal" | "general" | "light" | "dark">("all");
  const [themeCustomizeOpen, setThemeCustomizeOpen] = useState(false);

  // ── RSVP Options State ──
  const [plusOneAllowed, setPlusOneAllowed] = useState(event.plusOneAllowed);
  const [plusOneMax, setPlusOneMax] = useState(event.plusOneMax);
  const [plusOneNamesRequired, setPlusOneNamesRequired] = useState(event.plusOneNamesRequired);
  const [approvalRequired, setApprovalRequired] = useState(event.approvalRequired);
  const [guestsCanInvite, setGuestsCanInvite] = useState(event.guestsCanInvite);
  const [maybeEnabled, setMaybeEnabled] = useState(event.maybeEnabled);
  const [capacity, setCapacity] = useState(event.capacity?.toString() ?? "");
  const [rsvpDeadline, setRsvpDeadline] = useState(
    event.rsvpDeadline ? new Date(event.rsvpDeadline).toISOString().slice(0, 16) : ""
  );

  // ── Display & Privacy State ──
  const [commentsEnabled, setCommentsEnabled] = useState(event.commentsEnabled);
  const [guestSharingEnabled, setGuestSharingEnabled] = useState(event.guestSharingEnabled);
  const [guestListVis, setGuestListVis] = useState(event.guestListVis);
  const [showTimestamps, setShowTimestamps] = useState(event.showTimestamps);
  const [visibility, setVisibility] = useState(event.visibility);
  const [password, setPassword] = useState(event.password ?? "");

  // ── Reminders State ──
  const rs = event.reminderSettings;
  const [emailWeekBefore, setEmailWeekBefore] = useState(rs?.emailWeekBefore ?? false);
  const [emailDayBefore, setEmailDayBefore] = useState(rs?.emailDayBefore ?? true);
  const [emailHoursBefore, setEmailHoursBefore] = useState(rs?.emailHoursBefore ?? 2);
  const [smsWeekBefore, setSmsWeekBefore] = useState(rs?.smsWeekBefore ?? false);
  const [smsDayBefore, setSmsDayBefore] = useState(rs?.smsDayBefore ?? false);
  const [smsHoursBefore, setSmsHoursBefore] = useState(rs?.smsHoursBefore ?? 0);
  const [nudgeUnresponded, setNudgeUnresponded] = useState(rs?.nudgeUnresponded ?? true);

  // ── Co-hosts State ──
  const [coHosts, setCoHosts] = useState<CoHostEntry[]>(event.coHosts);
  const [cohostEmail, setCohostEmail] = useState("");
  const [cohostError, setCohostError] = useState<string | null>(null);

  // ── Questionnaire State ──
  const [questionnaireEnabled, setQuestionnaireEnabled] = useState(event.questionnaireEnabled);
  const [fields, setFields] = useState<RsvpFieldEntry[]>(event.rsvpFields);
  const [addingField, setAddingField] = useState(false);
  const [newFieldLabel, setNewFieldLabel] = useState("");
  const [newFieldType, setNewFieldType] = useState<"TEXT" | "TEXTAREA" | "SELECT" | "CHECKBOX">("TEXT");
  const [newFieldRequired, setNewFieldRequired] = useState(false);
  const [newFieldOptions, setNewFieldOptions] = useState("");
  const [labelDrafts, setLabelDrafts] = useState<Record<string, string>>(() =>
    Object.fromEntries(event.rsvpFields.map((f) => [f.id, f.label]))
  );
  const [optionsDrafts, setOptionsDrafts] = useState<Record<string, string>>(() =>
    Object.fromEntries(event.rsvpFields.map((f) => [f.id, formatOptionsForTextarea(f.options)]))
  );

  // ── Polls State ──
  const [polls, setPolls] = useState<PollEntry[]>(event.polls || []);
  const [newPollQuestion, setNewPollQuestion] = useState("");
  const [newPollOptions, setNewPollOptions] = useState<string[]>(["", ""]);
  const [newPollMultiChoice, setNewPollMultiChoice] = useState(false);
  const [newPollAllowGuestsToAdd, setNewPollAllowGuestsToAdd] = useState(true);
  const [newPollHideVoters, setNewPollHideVoters] = useState(false);
  const [newPollOptionTexts, setNewPollOptionTexts] = useState<Record<string, string>>({});

  // ── Potluck State ──
  const [potluckItems, setPotluckItems] = useState<PotluckItemEntry[]>(event.potluckItems || []);
  const [newPotluckLabel, setNewPotluckLabel] = useState("");
  const [newPotluckQty, setNewPotluckQty] = useState<number | "">(1);

  // Clear saved status after delay
  useEffect(() => {
    if (saveStatus === "SAVED" || saveStatus === "ERROR") {
      const timer = setTimeout(() => setSaveStatus("IDLE"), 2500);
      return () => clearTimeout(timer);
    }
  }, [saveStatus]);

  // Sync active section with URL query parameter for browser back button support
  useEffect(() => {
    const getSectionFromUrl = () => {
      if (typeof window === "undefined") return null;
      const params = new URLSearchParams(window.location.search);
      const section = params.get("section");
      const validSections = ["theme", "hosts", "rsvp", "questionnaire", "privacy", "reminders", "polls", "potluck"];
      if (validSections.includes(section || "")) {
        return section as "theme" | "hosts" | "rsvp" | "questionnaire" | "privacy" | "reminders" | "polls" | "potluck";
      }
      return null;
    };

    const initialSection = getSectionFromUrl();
    if (initialSection) {
      setTimeout(() => {
        setActiveSection(initialSection);
      }, 0);
    }

    const handlePopState = () => {
      setActiveSection(getSectionFromUrl());
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const openSection = (section: "theme" | "hosts" | "rsvp" | "questionnaire" | "privacy" | "reminders" | "polls" | "potluck") => {
    const url = new URL(window.location.href);
    url.searchParams.set("section", section);
    window.history.pushState({ section }, "", url.toString());
    setActiveSection(section);
  };

  const closeSection = () => {
    if (window.history.state && window.history.state.section) {
      window.history.back();
    } else {
      const url = new URL(window.location.href);
      url.searchParams.delete("section");
      window.history.replaceState(null, "", url.toString());
      setActiveSection(null);
    }
  };

  // ── Theme Presets (sorted by month proximity) ──
  const sortedThemePresets = useMemo(() => getSortedPresets(themePresets), [themePresets]);
  const visibleThemePresets = useMemo(() => {
    let result = sortedThemePresets;
    if (themeFilter === "seasonal") result = result.filter((p) => p.seasonal);
    if (themeFilter === "general") result = result.filter((p) => !p.seasonal);
    if (themeFilter === "light") result = result.filter((p) => p.base === "SOFT" || p.base === "BOLD");
    if (themeFilter === "dark") result = result.filter((p) => p.base === "DARK");
    if (themeSearch.trim()) {
      const q = themeSearch.toLowerCase();
      result = result.filter((p) => p.name.toLowerCase().includes(q) || p.emoji.includes(q));
    }
    return result;
  }, [sortedThemePresets, themeFilter, themeSearch]);

  // ── Theme Auto-Save ──
  const triggerSaveTheme = (newBase: BaseTheme, newFrom: string, newTo: string, newAccent: string, presetId?: string | null) => {
    setSaveStatus("SAVING");
    setErr(null);
    startTransition(async () => {
      try {
        await saveEventTheme(event.id, newBase, newFrom, newTo, newAccent, presetId !== undefined ? presetId : themePresetId);
        setSaveStatus("SAVED");
      } catch {
        setSaveStatus("ERROR");
        setErr("Failed to save theme settings.");
      }
    });
  };

  // ── Settings Auto-Save ──
  const triggerSaveSettings = (overrides: SettingsOverrides) => {
    setSaveStatus("SAVING");
    setErr(null);
    const data = {
      plusOneAllowed: overrides.plusOneAllowed !== undefined ? overrides.plusOneAllowed : plusOneAllowed,
      plusOneMax: overrides.plusOneMax !== undefined ? overrides.plusOneMax : plusOneMax,
      plusOneNamesRequired: overrides.plusOneNamesRequired !== undefined ? overrides.plusOneNamesRequired : plusOneNamesRequired,
      guestSharingEnabled: overrides.guestSharingEnabled !== undefined ? overrides.guestSharingEnabled : guestSharingEnabled,
      guestsCanInvite: overrides.guestsCanInvite !== undefined ? overrides.guestsCanInvite : guestsCanInvite,
      approvalRequired: overrides.approvalRequired !== undefined ? overrides.approvalRequired : approvalRequired,
      maybeEnabled: overrides.maybeEnabled !== undefined ? overrides.maybeEnabled : maybeEnabled,
      capacity: overrides.capacity !== undefined ? overrides.capacity : (capacity.trim() ? Number(capacity) : null),
      rsvpDeadline: overrides.rsvpDeadline !== undefined ? overrides.rsvpDeadline : (rsvpDeadline || null),
      commentsEnabled: overrides.commentsEnabled !== undefined ? overrides.commentsEnabled : commentsEnabled,
      guestListVis: overrides.guestListVis !== undefined ? overrides.guestListVis : guestListVis,
      showTimestamps: overrides.showTimestamps !== undefined ? overrides.showTimestamps : showTimestamps,
      visibility: overrides.visibility !== undefined ? overrides.visibility : visibility,
      password: overrides.password !== undefined ? overrides.password : (password.trim() || null),
      questionnaireEnabled: overrides.questionnaireEnabled !== undefined ? overrides.questionnaireEnabled : questionnaireEnabled,
    };
    startTransition(async () => {
      try {
        const res = await saveEventSettings(event.id, data);
        if (res && !res.success) {
          setSaveStatus("ERROR");
          setErr(res.error ?? "Failed to save settings.");
        } else {
          setSaveStatus("SAVED");
        }
      } catch {
        setSaveStatus("ERROR");
        setErr("Failed to save settings.");
      }
    });
  };

  // ── Reminders Auto-Save ──
  const triggerSaveReminders = (overrides: ReminderOverrides) => {
    setSaveStatus("SAVING");
    setErr(null);
    const data = {
      emailWeekBefore: overrides.emailWeekBefore !== undefined ? overrides.emailWeekBefore : emailWeekBefore,
      emailDayBefore: overrides.emailDayBefore !== undefined ? overrides.emailDayBefore : emailDayBefore,
      emailHoursBefore: overrides.emailHoursBefore !== undefined ? overrides.emailHoursBefore : emailHoursBefore,
      smsWeekBefore: overrides.smsWeekBefore !== undefined ? overrides.smsWeekBefore : smsWeekBefore,
      smsDayBefore: overrides.smsDayBefore !== undefined ? overrides.smsDayBefore : smsDayBefore,
      smsHoursBefore: overrides.smsHoursBefore !== undefined ? overrides.smsHoursBefore : smsHoursBefore,
      nudgeUnresponded: overrides.nudgeUnresponded !== undefined ? overrides.nudgeUnresponded : nudgeUnresponded,
    };
    startTransition(async () => {
      try {
        await saveReminderSettings(event.id, data);
        setSaveStatus("SAVED");
      } catch {
        setSaveStatus("ERROR");
        setErr("Failed to save reminders.");
      }
    });
  };

  // ── Co-hosts Actions ──
  const handleAddCohost = () => {
    setSaveStatus("SAVING");
    setCohostError(null);
    startTransition(async () => {
      try {
        const result = await addCoHost(event.id, cohostEmail.trim());
        if (!result.success) {
          setCohostError(result.error ?? "Error adding co-host");
          setSaveStatus("ERROR");
          return;
        }
        setCoHosts((prev) => [...prev, {
          id: result.cohostId!,
          user: { id: result.cohostId!, name: result.name ?? null, email: result.email! },
        }]);
        setCohostEmail("");
        setSaveStatus("SAVED");
      } catch {
        setCohostError("An unexpected error occurred.");
        setSaveStatus("ERROR");
      }
    });
  };

  const handleRemoveCohost = (cohostRecordId: string) => {
    setSaveStatus("SAVING");
    startTransition(async () => {
      try {
        await removeCoHost(cohostRecordId);
        setCoHosts((prev) => prev.filter((c) => c.id !== cohostRecordId));
        setSaveStatus("SAVED");
      } catch {
        setSaveStatus("ERROR");
      }
    });
  };

  // ── Poll Actions ──
  const handleAddPoll = () => {
    const question = newPollQuestion.trim();
    const opts = newPollOptions.map((o) => o.trim()).filter(Boolean);
    if (!question || opts.length < 2) return;

    setSaveStatus("SAVING");
    startTransition(async () => {
      try {
        const result = await createPoll(
          event.id,
          question,
          opts,
          newPollMultiChoice,
          newPollAllowGuestsToAdd,
          newPollHideVoters
        );
        if (result.success && result.id) {
          const newPollObj: PollEntry = {
            id: result.id,
            eventId: event.id,
            question,
            multiChoice: newPollMultiChoice,
            allowGuestsToAdd: newPollAllowGuestsToAdd,
            locked: false,
            hideVoters: newPollHideVoters,
            createdAt: new Date(),
            updatedAt: new Date(),
            options: opts.map((text, idx) => ({
              id: `${result.id}-opt-${idx}-${Date.now()}`,
              pollId: result.id,
              text,
              creatorName: null,
              createdAt: new Date(),
              votes: [],
            })),
          };
          setPolls((prev) => [...prev, newPollObj]);
          setNewPollQuestion("");
          setNewPollOptions(["", ""]);
          setNewPollMultiChoice(false);
          setNewPollAllowGuestsToAdd(true);
          setNewPollHideVoters(false);
          setSaveStatus("SAVED");
        } else {
          setSaveStatus("ERROR");
        }
      } catch {
        setSaveStatus("ERROR");
      }
    });
  };

  const handleDeletePoll = (pollId: string) => {
    setSaveStatus("SAVING");
    startTransition(async () => {
      try {
        await deletePoll(pollId);
        setPolls((prev) => prev.filter((p) => p.id !== pollId));
        setSaveStatus("SAVED");
      } catch {
        setSaveStatus("ERROR");
      }
    });
  };

  const handleUpdatePollSettings = (pollId: string, settings: { question?: string; multiChoice?: boolean; allowGuestsToAdd?: boolean; locked?: boolean; hideVoters?: boolean }) => {
    setSaveStatus("SAVING");
    startTransition(async () => {
      try {
        await updatePollSettings(pollId, settings);
        setPolls((prev) =>
          prev.map((p) => (p.id === pollId ? { ...p, ...settings } : p))
        );
        setSaveStatus("SAVED");
      } catch {
        setSaveStatus("ERROR");
      }
    });
  };

  const handleAddPollOption = async (pollId: string) => {
    const optionText = newPollOptionTexts[pollId]?.trim();
    if (!optionText) return;

    setSaveStatus("SAVING");
    startTransition(async () => {
      try {
        const result = await addPollOption(pollId, optionText, "Host");
        if (result.success && result.id) {
          setPolls((prev) =>
            prev.map((p) => {
              if (p.id !== pollId) return p;
              return {
                ...p,
                options: [
                  ...p.options,
                  {
                    id: result.id!,
                    pollId,
                    text: optionText,
                    creatorName: null,
                    createdAt: new Date(),
                    votes: [],
                  },
                ],
              };
            })
          );
          setNewPollOptionTexts((prev) => ({ ...prev, [pollId]: "" }));
          setSaveStatus("SAVED");
        } else {
          setSaveStatus("ERROR");
        }
      } catch {
        setSaveStatus("ERROR");
      }
    });
  };

  const handleDeletePollOption = async (pollId: string, optionId: string) => {
    setSaveStatus("SAVING");
    startTransition(async () => {
      try {
        await deletePollOption(pollId, optionId);
        setPolls((prev) =>
          prev.map((p) => {
            if (p.id !== pollId) return p;
            return {
              ...p,
              options: p.options.filter((o) => o.id !== optionId),
            };
          })
        );
        setSaveStatus("SAVED");
      } catch {
        setSaveStatus("ERROR");
      }
    });
  };

  // ── Potluck Actions ──
  const handleAddPotluckItem = () => {
    const label = newPotluckLabel.trim();
    const qty = typeof newPotluckQty === "number" ? newPotluckQty : 1;
    if (!label) return;

    setSaveStatus("SAVING");
    startTransition(async () => {
      try {
        const result = await addPotluckItem(event.id, label, qty);
        if (result && result.id) {
          setPotluckItems((prev) => [
            ...prev,
            {
              id: result.id,
              eventId: event.id,
              label,
              quantity: qty,
              claims: [],
              createdAt: new Date(),
            },
          ]);
          setNewPotluckLabel("");
          setNewPotluckQty(1);
          setSaveStatus("SAVED");
        } else {
          setSaveStatus("ERROR");
        }
      } catch {
        setSaveStatus("ERROR");
      }
    });
  };

  const handleRemovePotluckItem = (itemId: string) => {
    setSaveStatus("SAVING");
    startTransition(async () => {
      try {
        await removePotluckItem(itemId);
        setPotluckItems((prev) => prev.filter((i) => i.id !== itemId));
        setSaveStatus("SAVED");
      } catch {
        setSaveStatus("ERROR");
      }
    });
  };

  const handleUnclaimItem = (itemId: string, guestName: string) => {
    setSaveStatus("SAVING");
    startTransition(async () => {
      try {
        const result = await unclaimPotluckItem(itemId, guestName);
        if (result.success) {
          setPotluckItems((prev) =>
            prev.map((i) =>
              i.id === itemId
                ? { ...i, claims: i.claims.filter((c) => c.guestName !== guestName) }
                : i
            )
          );
          setSaveStatus("SAVED");
        } else {
          setSaveStatus("ERROR");
        }
      } catch {
        setSaveStatus("ERROR");
      }
    });
  };

  const handleAddField = () => {
    if (!newFieldLabel.trim()) return;
    setSaveStatus("SAVING");
    startTransition(async () => {
      try {
        const serialized = (newFieldType === "SELECT" || newFieldType === "CHECKBOX") ? serializeOptionsForDb(newFieldOptions) : undefined;
        const result = await addRsvpField(event.id, {
          label: newFieldLabel.trim(),
          fieldType: newFieldType,
          required: newFieldRequired,
          options: serialized,
          order: fields.length,
        });
        if (result.success) {
          setFields((prev) => [...prev, {
            id: result.id!,
            label: newFieldLabel.trim(),
            fieldType: newFieldType,
            required: newFieldRequired,
            options: serialized ?? null,
            order: prev.length,
          }]);
          setLabelDrafts((prev) => ({ ...prev, [result.id!]: newFieldLabel.trim() }));
          setOptionsDrafts((prev) => ({ ...prev, [result.id!]: formatOptionsForTextarea(serialized ?? null) }));
          setNewFieldLabel("");
          setNewFieldType("TEXT");
          setNewFieldRequired(false);
          setNewFieldOptions("");
          setAddingField(false);
          setSaveStatus("SAVED");
        } else {
          setSaveStatus("ERROR");
        }
      } catch {
        setSaveStatus("ERROR");
      }
    });
  };

  const handleUpdateFieldType = (fieldId: string, fieldType: RsvpFieldEntry["fieldType"]) => {
    setSaveStatus("SAVING");
    startTransition(async () => {
      try {
        await updateRsvpField(fieldId, { fieldType });
        setFields((prev) => prev.map((x) => x.id === fieldId ? { ...x, fieldType } : x));
        setSaveStatus("SAVED");
      } catch {
        setSaveStatus("ERROR");
      }
    });
  };

  const handleUpdateFieldRequired = (fieldId: string, required: boolean) => {
    setSaveStatus("SAVING");
    startTransition(async () => {
      try {
        await updateRsvpField(fieldId, { required });
        setFields((prev) => prev.map((x) => x.id === fieldId ? { ...x, required } : x));
        setSaveStatus("SAVED");
      } catch {
        setSaveStatus("ERROR");
      }
    });
  };

  const handleUpdateFieldLabel = (fieldId: string) => {
    const label = (labelDrafts[fieldId] ?? "").trim();
    if (!label) return;
    setSaveStatus("SAVING");
    startTransition(async () => {
      try {
        await updateRsvpField(fieldId, { label });
        setFields((prev) => prev.map((x) => x.id === fieldId ? { ...x, label } : x));
        setSaveStatus("SAVED");
      } catch {
        setSaveStatus("ERROR");
      }
    });
  };

  const handleUpdateFieldOptions = (fieldId: string) => {
    const rawOptions = optionsDrafts[fieldId] ?? "";
    const options = serializeOptionsForDb(rawOptions);
    setSaveStatus("SAVING");
    startTransition(async () => {
      try {
        await updateRsvpField(fieldId, { options });
        setFields((prev) => prev.map((x) => x.id === fieldId ? { ...x, options } : x));
        setSaveStatus("SAVED");
      } catch {
        setSaveStatus("ERROR");
      }
    });
  };

  const handleDeleteField = (fieldId: string) => {
    setSaveStatus("SAVING");
    startTransition(async () => {
      try {
        await deleteRsvpField(fieldId);
        setFields((prev) => prev.filter((x) => x.id !== fieldId));
        setSaveStatus("SAVED");
      } catch {
        setSaveStatus("ERROR");
      }
    });
  };

  // Resolve theme using state
  const t = resolveTheme(base, gradientFrom, gradientTo, accent);

  const S = {
    page: { minHeight: "100vh", background: t.pageBg, color: t.textPrimary, fontFamily: "inherit", paddingBottom: "120px", position: "relative" as const, overflowX: "hidden" as const },
    container: { maxWidth: "480px", margin: "0 auto", padding: "24px 16px 80px", position: "relative" as const, zIndex: 1 },
    header: { position: "sticky" as const, top: 0, background: t.cardBg, borderBottom: `1px solid ${t.cardBorder}`, padding: "16px 20px", display: "flex", alignItems: "center", gap: "12px", zIndex: 10, backdropFilter: "blur(14px)" },
    inp: { width: "100%", padding: "10px 14px", background: t.inputBg, border: `1px solid ${t.inputBorder}`, borderRadius: "10px", color: t.textPrimary, fontFamily: "inherit", fontSize: "14px", outline: "none", boxSizing: "border-box", colorScheme: t.textPrimary === "#ffffff" ? "dark" : "light" } as React.CSSProperties,
    smallBtn: { padding: "8px 16px", background: t.accent, color: t.accentFg, border: "none", borderRadius: "8px", cursor: "pointer", fontFamily: "inherit", fontSize: "13px", fontWeight: 700, whiteSpace: "nowrap" } as React.CSSProperties,
    av: { width: "32px", height: "32px", borderRadius: "50%", background: t.avatarGradient, display: "flex" as const, alignItems: "center" as const, justifyContent: "center" as const, fontSize: "13px", fontWeight: 700, color: t.accentFg, flexShrink: 0 },
  };

  const renderDecorations = () => {
    if (t.pageDecoration === "dark-orbs") {
      return (
        <>
          <div style={{ position: "fixed", top: "-20%", left: "30%", width: "600px", height: "600px", borderRadius: "50%", background: t.pageDecorationBg1, filter: "blur(40px)", pointerEvents: "none", zIndex: 0 }} />
          <div style={{ position: "fixed", bottom: "10%", right: "-10%", width: "400px", height: "400px", borderRadius: "50%", background: t.pageDecorationBg2, filter: "blur(40px)", pointerEvents: "none", zIndex: 0 }} />
        </>
      );
    }
    if (t.pageDecoration === "soft-blobs") {
      return (
        <>
          <div style={{ position: "fixed", top: "-10%", right: "-10%", width: "500px", height: "500px", borderRadius: "50%", background: t.pageDecorationBg1, filter: "blur(60px)", pointerEvents: "none", zIndex: 0 }} />
          <div style={{ position: "fixed", bottom: "20%", left: "-5%", width: "400px", height: "400px", borderRadius: "50%", background: t.pageDecorationBg2, filter: "blur(60px)", pointerEvents: "none", zIndex: 0 }} />
        </>
      );
    }
    if (t.pageDecoration === "bold-hero") {
      return <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: t.pageDecorationBg1, zIndex: 0 }} />;
    }
    return null;
  };

  return (
    <div style={S.page}>
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
      {renderDecorations()}
      
      <div style={S.header}>
        <button
          onClick={() => {
            if (activeSection) {
              closeSection();
            } else {
              window.location.href = `/e/${event.slug}`;
            }
          }}
          style={{ display: "flex", alignItems: "center", color: t.textSecondary, background: "none", border: "none", cursor: "pointer", padding: 0 }}
        >
          <ArrowLeft size={20} />
        </button>
        <h1 style={{ fontSize: "17px", fontWeight: 700, color: t.textPrimary, flex: 1, marginLeft: "12px" }}>
          {activeSection ? (
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ cursor: "pointer", opacity: 0.6 }} onClick={closeSection}>Settings</span>
              <span style={{ opacity: 0.4 }}>/</span>
              <span>
                {activeSection === "theme" && "Theme"}
                {activeSection === "hosts" && "Hosts"}
                {activeSection === "rsvp" && "RSVP Options"}
                {activeSection === "questionnaire" && "Questionnaire"}
                {activeSection === "polls" && "Polls"}
                {activeSection === "potluck" && "Potluck"}
                {activeSection === "privacy" && "Display Options"}
                {activeSection === "reminders" && "Auto-Reminders"}
              </span>
            </div>
          ) : (
            "Event Settings"
          )}
        </h1>
        {saveStatus === "SAVING" && (
          <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: t.textMuted }}>
            <span style={{
              display: "inline-block", width: "12px", height: "12px",
              borderRadius: "50%", border: `2px solid ${t.accent}`,
              borderTopColor: "transparent", animation: "spin 0.6s linear infinite",
              boxSizing: "border-box"
            }} />
            Saving...
          </div>
        )}
      </div>

      {/* Floating toast notification for settings save status */}
      {(saveStatus === "SAVED" || saveStatus === "ERROR") && (
        <div style={{
          position: "fixed",
          top: "20px",
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 10000,
          display: "flex",
          alignItems: "center",
          gap: "8px",
          background: t.cardBg,
          border: `1px solid ${saveStatus === "SAVED" ? "#22c55e" : "#ef4444"}`,
          borderRadius: t.cardRadius,
          padding: "10px 16px",
          boxShadow: "0 8px 30px rgba(0, 0, 0, 0.15)",
          color: saveStatus === "SAVED" ? "#22c55e" : "#ef4444",
          fontWeight: 600,
          fontSize: "14px",
          backdropFilter: "blur(8px)",
          transition: "all 0.2s ease-in-out"
        }}>
          {saveStatus === "SAVED" ? <Check size={16} color="#22c55e" /> : <span>⚠️</span>}
          {saveStatus === "SAVED" ? "Changes saved" : "Error saving changes"}
        </div>
      )}

      <div style={S.container}>

        {activeSection === null && (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {([
              ...(isOwner ? [{ id: "hosts" as const, title: "👥 Hosts & Co-hosts", desc: "Manage who can edit this event" }] : []),
              { id: "privacy", title: "🔒 Display Options", desc: "Guest list visibility, password, and public settings" },
              { id: "rsvp", title: "✉️ RSVP Options", desc: "+1 settings, RSVP approval, and maybe options" },
              { id: "theme", title: "🎨 Theme", desc: "Change base theme and accent color" },
              { id: "reminders", title: "🔔 Auto-Reminders", desc: "Set up automatic emails and texts before/after event" },
              { id: "polls", title: "📊 Polls", desc: "Create and manage polls for guests" },
              { id: "questionnaire", title: "📋 Questionnaire", desc: "Ask custom questions to guests during RSVP" },
              { id: "potluck", title: "🍽️ Potluck", desc: "Manage items guests can sign up to bring" }
            ] as {
              id: "theme" | "hosts" | "rsvp" | "questionnaire" | "privacy" | "reminders" | "polls" | "potluck";
              title: string;
              desc: string;
            }[]).map((sec) => (
              <button
                key={sec.id}
                onClick={() => openSection(sec.id)}
                style={{
                  textAlign: "left",
                  background: t.cardBg,
                  border: `1px solid ${t.cardBorder}`,
                  borderRadius: t.cardRadius,
                  padding: "20px",
                  boxShadow: t.cardShadow,
                  backdropFilter: "blur(12px)",
                  cursor: "pointer",
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "16px",
                  transition: "all 0.15s ease-in-out"
                }}
              >
                <div style={{ flex: 1 }}>
                  <h3 style={{ fontSize: "15px", fontWeight: 700, color: t.textPrimary, margin: "0 0 4px" }}>{sec.title}</h3>
                  <p style={{ fontSize: "13px", color: t.textMuted, margin: 0 }}>{sec.desc}</p>
                </div>
                <span style={{ fontSize: "18px", color: t.textMuted }}>➔</span>
              </button>
            ))}
          </div>
        )}

        {/* ── Theme ── */}
        {activeSection === "theme" && (
          <Section title="Theme" t={t}>
            {/* Search */}
            <div style={{ marginBottom: "10px" }}>
              <input
                type="text"
                value={themeSearch}
                onChange={(e) => setThemeSearch(e.target.value)}
                placeholder="Search themes…"
                style={{
                  width: "100%", boxSizing: "border-box", padding: "8px 12px",
                  background: t.inputBg, border: `1px solid ${t.inputBorder}`,
                  borderRadius: "10px", color: t.textPrimary, fontSize: "13px", outline: "none",
                }}
              />
            </div>

            {/* Filter pills + reset */}
            {(() => {
              const savedBase: BaseTheme = event.theme?.baseTheme ?? "DARK";
              const savedFrom = event.theme?.gradientFrom ?? "#7c3aed";
              const savedTo = event.theme?.gradientTo ?? "#1e40af";
              const savedAccent = event.theme?.accentColor ?? "#a855f7";
              const hasChanged = base !== savedBase || gradientFrom !== savedFrom || gradientTo !== savedTo || accent !== savedAccent;
              const appliedPreset = themePresetId ? themePresets.find((p) => p.id === themePresetId) : null;
              const presetDefault = (appliedPreset?.defaultSnapshot as ThemeSnapObj | null) ?? null;
              const divergedFromPreset = presetDefault && (
                base !== presetDefault.base ||
                gradientFrom !== presetDefault.gradientFrom ||
                gradientTo !== presetDefault.gradientTo ||
                accent !== presetDefault.accentColor
              );
              return (
                <>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "8px" }}>
                    <div style={{ display: "flex", gap: "6px", flex: 1, overflowX: "auto" }}>
                      {(["all", "seasonal", "general", "light", "dark"] as const).map((f) => (
                        <button
                          key={f}
                          onClick={() => setThemeFilter(f)}
                          style={{
                            padding: "4px 10px", borderRadius: "20px", fontSize: "12px", fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0,
                            border: `1px solid ${themeFilter === f ? t.accent : t.inputBorder}`,
                            background: themeFilter === f ? t.accentBg : "transparent",
                            color: themeFilter === f ? t.accent : t.textMuted,
                          }}
                        >
                          {f === "all" ? "All" : f === "seasonal" ? "🎉 Seasonal" : f === "general" ? "🎨 General" : f === "light" ? "☀️ Light" : "🌙 Dark"}
                        </button>
                      ))}
                    </div>
                    {hasChanged && (
                      <button
                        onClick={() => {
                          setBase(savedBase);
                          setGradientFrom(savedFrom);
                          setGradientTo(savedTo);
                          setAccent(savedAccent);
                          triggerSaveTheme(savedBase, savedFrom, savedTo, savedAccent);
                        }}
                        style={{ padding: "4px 10px", borderRadius: "20px", fontSize: "12px", fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0, border: `1px solid ${t.inputBorder}`, background: "transparent", color: t.textMuted }}
                      >
                        ↺ Reset
                      </button>
                    )}
                  </div>
                  {divergedFromPreset && presetDefault && appliedPreset && (
                    <button
                      type="button"
                      onClick={() => {
                        setBase(presetDefault.base);
                        setGradientFrom(presetDefault.gradientFrom);
                        setGradientTo(presetDefault.gradientTo);
                        setAccent(presetDefault.accentColor);
                        triggerSaveTheme(presetDefault.base, presetDefault.gradientFrom, presetDefault.gradientTo, presetDefault.accentColor, themePresetId);
                      }}
                      style={{ width: "100%", marginBottom: "8px", padding: "8px 12px", background: "transparent", border: `1px solid ${t.accentBorder}`, borderRadius: "10px", color: t.accent, fontSize: "12px", fontWeight: 600, cursor: "pointer", textAlign: "center" }}
                    >
                      ↺ Restore to &ldquo;{appliedPreset.name}&rdquo; defaults
                    </button>
                  )}
                </>
              );
            })()}

            {/* Preset grid */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(90px, 1fr))",
                gap: "7px",
                maxHeight: "300px",
                overflowY: "auto",
                marginBottom: "14px",
              }}
            >
              {visibleThemePresets.map((p) => {
                const isActive = base === p.base && gradientFrom === p.gradientFrom && gradientTo === p.gradientTo && accent === p.accentColor;
                return (
                  <button
                    key={p.id}
                    onClick={() => {
                      setBase(p.base);
                      setGradientFrom(p.gradientFrom);
                      setGradientTo(p.gradientTo);
                      setAccent(p.accentColor);
                      setThemePresetId(p.id);
                      triggerSaveTheme(p.base, p.gradientFrom, p.gradientTo, p.accentColor, p.id);
                    }}
                    style={{
                      padding: 0,
                      border: `2px solid ${isActive ? t.accent : t.inputBorder}`,
                      borderRadius: "10px",
                      cursor: "pointer",
                      background: isActive ? t.accentBg : t.inputBg,
                      transition: "all 0.15s",
                      overflow: "hidden",
                      display: "flex",
                      flexDirection: "column",
                    }}
                  >
                    <div style={{ position: "relative", height: "36px", background: `linear-gradient(135deg, ${p.gradientFrom}, ${p.gradientTo})` }}>
                      <span style={{ position: "absolute", top: "3px", left: "4px", fontSize: "10px" }}>{p.emoji}</span>
                      <div style={{ position: "absolute", bottom: "3px", right: "4px", width: "7px", height: "7px", borderRadius: "50%", background: p.accentColor, border: "1px solid rgba(255,255,255,0.3)" }} />
                    </div>
                    <div style={{ padding: "4px 5px", fontSize: "9px", fontWeight: 600, color: t.textSecondary, textAlign: "center", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {p.name}
                    </div>
                  </button>
                );
              })}
              {visibleThemePresets.length === 0 && (
                <div style={{ gridColumn: "1 / -1", textAlign: "center", padding: "20px", color: t.textMuted, fontSize: "12px" }}>
                  No themes match
                </div>
              )}
            </div>

            {/* Customize accordion */}
            <div style={{ marginBottom: "12px", border: `1px solid ${t.inputBorder}`, borderRadius: "12px", overflow: "hidden" }}>
              <button
                onClick={() => setThemeCustomizeOpen((o) => !o)}
                style={{
                  width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "10px 14px", background: t.inputBg, border: "none",
                  cursor: "pointer", color: t.textPrimary, fontSize: "13px", fontWeight: 600,
                }}
              >
                <span>Customize colors</span>
                <span style={{ fontSize: "11px", color: t.textMuted, transform: themeCustomizeOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>▼</span>
              </button>

              {themeCustomizeOpen && (
                <div style={{ padding: "14px", borderTop: `1px solid ${t.inputBorder}` }}>
                  {/* Style selector */}
                  <div style={{ marginBottom: "14px" }}>
                    <Label t={t}>Style</Label>
                    <div style={{ display: "flex", gap: "8px" }}>
                      {BASE_THEMES.map((bt) => (
                        <button
                          key={bt.id}
                          onClick={() => {
                            const newFrom = bt.defaultGradientFrom;
                            const newTo = bt.defaultGradientTo;
                            const newAccent = bt.defaultAccent;
                            setBase(bt.id);
                            setGradientFrom(newFrom);
                            setGradientTo(newTo);
                            setAccent(newAccent);
                            triggerSaveTheme(bt.id, newFrom, newTo, newAccent);
                          }}
                          style={{ flex: 1, padding: 0, border: `2px solid ${base === bt.id ? t.textPrimary : t.inputBorder}`, borderRadius: "12px", cursor: "pointer", overflow: "hidden", background: "none", transition: "border-color 0.15s" }}
                        >
                          <div style={{ height: "36px", background: bt.preview }} />
                          <div style={{ padding: "5px 4px", color: t.textPrimary, fontSize: "10px", fontWeight: 600, background: t.inputBg }}>{bt.label}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Background colors */}
                  <div style={{ marginBottom: "14px" }}>
                    <Label t={t}>Background Colors</Label>
                    <div style={{ display: "flex", gap: "10px" }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: "11px", color: t.textMuted, marginBottom: "5px" }}>Start</div>
                        <label style={{ display: "flex", alignItems: "center", gap: "8px", padding: "7px 10px", background: t.inputBg, border: `1px solid ${t.inputBorder}`, borderRadius: "9px", cursor: "pointer" }}>
                          <div style={{ width: "18px", height: "18px", borderRadius: "5px", background: gradientFrom, flexShrink: 0 }} />
                          <span style={{ fontSize: "11px", color: t.textSecondary, fontFamily: "monospace" }}>{gradientFrom}</span>
                          <input type="color" value={gradientFrom} onChange={(e) => { setGradientFrom(e.target.value); triggerSaveTheme(base, e.target.value, gradientTo, accent); }} style={{ position: "absolute", opacity: 0, width: 0, height: 0 }} />
                        </label>
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: "11px", color: t.textMuted, marginBottom: "5px" }}>End</div>
                        <label style={{ display: "flex", alignItems: "center", gap: "8px", padding: "7px 10px", background: t.inputBg, border: `1px solid ${t.inputBorder}`, borderRadius: "9px", cursor: "pointer" }}>
                          <div style={{ width: "18px", height: "18px", borderRadius: "5px", background: gradientTo, flexShrink: 0 }} />
                          <span style={{ fontSize: "11px", color: t.textSecondary, fontFamily: "monospace" }}>{gradientTo}</span>
                          <input type="color" value={gradientTo} onChange={(e) => { setGradientTo(e.target.value); triggerSaveTheme(base, gradientFrom, e.target.value, accent); }} style={{ position: "absolute", opacity: 0, width: 0, height: 0 }} />
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* Accent color */}
                  <Label t={t}>Accent Color</Label>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "7px" }}>
                    {ACCENT_PRESETS.map((p) => (
                      <button key={p.value} onClick={() => { setAccent(p.value); triggerSaveTheme(base, gradientFrom, gradientTo, p.value); }} title={p.name} style={{ width: "30px", height: "30px", borderRadius: "50%", background: p.value, border: `3px solid ${accent === p.value ? t.textPrimary : "transparent"}`, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        {accent === p.value && <Check size={12} color={t.accentFg} strokeWidth={3} />}
                      </button>
                    ))}
                    <label style={{ width: "30px", height: "30px", borderRadius: "50%", border: `3px solid ${!ACCENT_PRESETS.some(p => p.value === accent) ? t.textPrimary : "transparent"}`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", background: ACCENT_PRESETS.some(p => p.value === accent) ? t.inputBg : accent, position: "relative", overflow: "hidden" }}>
                      🎨
                      <input type="color" value={accent} onChange={(e) => { setAccent(e.target.value); triggerSaveTheme(base, gradientFrom, gradientTo, e.target.value); }} style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer" }} />
                    </label>
                  </div>
                </div>
              )}
            </div>
          </Section>
        )}

        {/* ── Hosts ── */}
        {activeSection === "hosts" && isOwner && (
          <Section title="Hosts" t={t}>
            <div style={{ marginBottom: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 0", borderBottom: `1px solid ${t.cardBorder}` }}>
                <div style={S.av}>{event.slug[0]?.toUpperCase()}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "14px", fontWeight: 600, color: t.textPrimary }}>You</div>
                  <div style={{ fontSize: "12px", color: t.textMuted }}>Host</div>
                </div>
              </div>
              {coHosts.map((ch) => (
                <div key={ch.id} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 0", borderBottom: `1px solid ${t.cardBorder}` }}>
                  <div style={S.av}>{(ch.user.name ?? ch.user.email)[0].toUpperCase()}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: "14px", fontWeight: 600, color: t.textPrimary }}>{ch.user.name ?? ch.user.email}</div>
                    <div style={{ fontSize: "12px", color: t.textMuted }}>{ch.user.email} · Co-host</div>
                  </div>
                  <button onClick={() => handleRemoveCohost(ch.id)} style={{ background: "none", border: "none", cursor: "pointer", color: t.textMuted, padding: "4px" }} title="Remove co-host">
                    <X size={16} />
                  </button>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              <input
                value={cohostEmail}
                onChange={(e) => setCohostEmail(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleAddCohost(); }}
                placeholder="cohost@email.com"
                style={{ ...S.inp, flex: 1 }}
              />
              <button onClick={handleAddCohost} disabled={isPending || !cohostEmail.trim()} style={S.smallBtn}>Add</button>
            </div>
            {cohostError && <div style={{ fontSize: "13px", color: "#f87171", marginTop: "8px" }}>{cohostError}</div>}
          </Section>
        )}

        {/* ── RSVP Options ── */}
        {activeSection === "rsvp" && (
          <Section title="RSVP Options" t={t}>
            {/* Max plus-ones select dropdown */}
            <div style={{ marginBottom: "16px" }}>
              <Label t={t}>Max plus-ones per guest</Label>
              <select
                style={{ ...S.inp, cursor: "pointer" }}
                value={plusOneAllowed ? plusOneMax : 0}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  const allowed = val > 0;
                  setPlusOneAllowed(allowed);
                  setPlusOneMax(allowed ? val : 0);
                  triggerSaveSettings({ plusOneAllowed: allowed, plusOneMax: allowed ? val : 0 });
                }}
              >
                <option value={0}>No +1s</option>
                {Array.from({ length: 9 }, (_, i) => (
                  <option key={i + 1} value={i + 1}>
                    Up to {i + 1}
                  </option>
                ))}
              </select>
            </div>

            {plusOneAllowed && (
              <Toggle
                label="Require plus-one names"
                value={plusOneNamesRequired}
                onChange={(val) => {
                  setPlusOneNamesRequired(val);
                  triggerSaveSettings({ plusOneNamesRequired: val });
                }}
                t={t}
              />
            )}

            <div style={{ borderTop: `1px solid ${t.cardBorder}`, margin: "16px -20px 16px -20px", padding: "16px 20px 0 20px" }}>
              <div style={{ fontSize: "12px", fontWeight: 700, textTransform: "none", color: t.textMuted, marginBottom: "12px", letterSpacing: "0.02em" }}>
                RSVP & Approval Options
              </div>
              <Toggle label="Require host approval for each RSVP" value={approvalRequired} onChange={(val) => { setApprovalRequired(val); triggerSaveSettings({ approvalRequired: val }); }} t={t} />
              <Toggle label="Guests can RSVP «Maybe»" value={maybeEnabled} onChange={(val) => { setMaybeEnabled(val); triggerSaveSettings({ maybeEnabled: val }); }} t={t} />
            </div>
            <Toggle label="Show RSVP timestamps" value={showTimestamps} onChange={(val) => { setShowTimestamps(val); triggerSaveSettings({ showTimestamps: val }); }} t={t} />

            <div style={{ marginBottom: "16px", marginTop: "16px" }}>
              <Label t={t}>Capacity limit (optional)</Label>
              <input
                type="number"
                placeholder="No limit"
                value={capacity}
                onChange={(e) => setCapacity(e.target.value)}
                onBlur={() => {
                  const val = capacity.trim() ? Number(capacity) : null;
                  triggerSaveSettings({ capacity: val });
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    const val = capacity.trim() ? Number(capacity) : null;
                    triggerSaveSettings({ capacity: val });
                    e.currentTarget.blur();
                  }
                }}
                style={S.inp}
              />
            </div>
            <div>
              <Label t={t}>RSVP deadline (optional)</Label>
              <input
                type="datetime-local"
                value={rsvpDeadline}
                onChange={(e) => setRsvpDeadline(e.target.value)}
                onBlur={() => {
                  triggerSaveSettings({ rsvpDeadline: rsvpDeadline || null });
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    triggerSaveSettings({ rsvpDeadline: rsvpDeadline || null });
                    e.currentTarget.blur();
                  }
                }}
                style={S.inp}
              />
            </div>
          </Section>
        )}

        {/* ── Questionnaire ── */}
        {activeSection === "questionnaire" && (
          <Section title="Questionnaire" t={t}>
            <Toggle label="Ask guests custom questions" value={questionnaireEnabled} onChange={(val) => { setQuestionnaireEnabled(val); triggerSaveSettings({ questionnaireEnabled: val }); }} t={t} />

            {fields.length > 0 && (
              <div style={{ marginTop: "16px", display: "flex", flexDirection: "column", gap: "10px" }}>
                {fields.map((f) => (
                  <div key={f.id} style={{ background: t.inputBg, border: `1px solid ${t.inputBorder}`, borderRadius: "14px", padding: "14px" }}>
                    {/* Top row: type select + required + delete */}
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
                      <select
                        value={f.fieldType}
                        onChange={(e) => handleUpdateFieldType(f.id, e.target.value as RsvpFieldEntry["fieldType"])}
                        style={{ flex: 1, padding: "6px 10px", background: t.cardBg, border: `1px solid ${t.inputBorder}`, borderRadius: "8px", color: t.textPrimary, fontFamily: "inherit", fontSize: "12px", cursor: "pointer", colorScheme: t.textPrimary === "#ffffff" ? "dark" : "light" }}
                      >
                        <option value="TEXT">Short text</option>
                        <option value="TEXTAREA">Long text</option>
                        <option value="SELECT">Multiple choice</option>
                        <option value="CHECKBOX">Checkboxes</option>
                      </select>
                      <label style={{ display: "flex", alignItems: "center", gap: "5px", cursor: "pointer", fontSize: "12px", color: t.textSecondary, whiteSpace: "nowrap" }}>
                        <input
                          type="checkbox"
                          checked={f.required}
                          onChange={(e) => handleUpdateFieldRequired(f.id, e.target.checked)}
                          style={{ accentColor: t.accent }}
                        />
                        Required
                      </label>
                      <button onClick={() => handleDeleteField(f.id)} style={{ background: "none", border: "none", cursor: "pointer", color: t.textMuted, padding: "4px", flexShrink: 0, display: "flex", alignItems: "center" }}>
                        <X size={15} />
                      </button>
                    </div>
                    {/* Label input */}
                    <input
                      value={labelDrafts[f.id] ?? f.label}
                      onChange={(e) => setLabelDrafts((prev) => ({ ...prev, [f.id]: e.target.value }))}
                      onBlur={() => handleUpdateFieldLabel(f.id)}
                      onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
                      placeholder="Question text"
                      style={{ ...S.inp, marginBottom: (f.fieldType === "SELECT" || f.fieldType === "CHECKBOX") ? "8px" : 0 }}
                    />
                    {/* Options textarea for SELECT/CHECKBOX */}
                    {(f.fieldType === "SELECT" || f.fieldType === "CHECKBOX") && (
                      <textarea
                        value={optionsDrafts[f.id] ?? (f.options ?? "")}
                        onChange={(e) => setOptionsDrafts((prev) => ({ ...prev, [f.id]: e.target.value }))}
                        onBlur={() => handleUpdateFieldOptions(f.id)}
                        placeholder="Options, one per line"
                        style={{ ...S.inp, resize: "none", marginTop: "4px" } as React.CSSProperties}
                        rows={3}
                      />
                    )}
                  </div>
                ))}
              </div>
            )}

            {addingField ? (
              <div style={{ marginTop: "12px", background: t.inputBg, border: `1px solid ${t.inputBorder}`, borderRadius: "14px", padding: "14px", display: "flex", flexDirection: "column", gap: "8px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <select value={newFieldType} onChange={(e) => setNewFieldType(e.target.value as typeof newFieldType)} style={{ flex: 1, padding: "6px 10px", background: t.cardBg, border: `1px solid ${t.inputBorder}`, borderRadius: "8px", color: t.textPrimary, fontFamily: "inherit", fontSize: "12px", cursor: "pointer", colorScheme: t.textPrimary === "#ffffff" ? "dark" : "light" }}>
                    <option value="TEXT">Short text</option>
                    <option value="TEXTAREA">Long text</option>
                    <option value="SELECT">Multiple choice</option>
                    <option value="CHECKBOX">Checkboxes</option>
                  </select>
                  <label style={{ display: "flex", alignItems: "center", gap: "5px", cursor: "pointer", fontSize: "12px", color: t.textSecondary, whiteSpace: "nowrap" }}>
                    <input type="checkbox" checked={newFieldRequired} onChange={(e) => setNewFieldRequired(e.target.checked)} style={{ accentColor: t.accent }} />
                    Required
                  </label>
                </div>
                <input value={newFieldLabel} onChange={(e) => setNewFieldLabel(e.target.value)} placeholder="Question text *" style={S.inp} />
                {(newFieldType === "SELECT" || newFieldType === "CHECKBOX") && (
                  <textarea value={newFieldOptions} onChange={(e) => setNewFieldOptions(e.target.value)} placeholder="Options, one per line" style={{ ...S.inp, resize: "none" } as React.CSSProperties} rows={3} />
                )}
                <div style={{ display: "flex", gap: "6px" }}>
                  <button onClick={handleAddField} disabled={!newFieldLabel.trim() || isPending} style={{ ...S.smallBtn, flex: 1 }}>Add Question</button>
                  <button onClick={() => setAddingField(false)} style={{ ...S.smallBtn, background: t.inputBg, color: t.textSecondary, border: `1px solid ${t.inputBorder}` }}>Cancel</button>
                </div>
              </div>
            ) : (
              <button onClick={() => setAddingField(true)} style={{ marginTop: "12px", display: "flex", alignItems: "center", gap: "6px", background: t.inputBg, border: `1px dashed ${t.accentBorder}`, borderRadius: "10px", padding: "10px 14px", color: t.textMuted, cursor: "pointer", fontFamily: "inherit", fontSize: "13px", width: "100%" }}>
                <Plus size={14} /> Add Question
              </button>
            )}
          </Section>
        )}

        {/* ── Display Options ── */}
        {activeSection === "privacy" && (
          <Section title="Display Options" t={t}>
            <Toggle label="Allow guest comments" value={commentsEnabled} onChange={(val) => { setCommentsEnabled(val); triggerSaveSettings({ commentsEnabled: val }); }} t={t} />
            
            <Toggle
              label="Allow guest sharing (Copy link & QR code)"
              value={guestSharingEnabled}
              onChange={(val) => {
                setGuestSharingEnabled(val);
                triggerSaveSettings({ guestSharingEnabled: val });
              }}
              t={t}
            />

            <div style={{ marginBottom: "16px" }}>
              <Label t={t}>Guest list visibility</Label>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {([["ALL", "Everyone can see"], ["GUESTS_ONLY", "Going guests only"], ["HOST_ONLY", "Host only"]] as const).map(([val, label]) => (
                  <label key={val} style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer" }}>
                    <input type="radio" checked={guestListVis === val} onChange={() => { setGuestListVis(val); triggerSaveSettings({ guestListVis: val }); }} style={{ accentColor: t.accent }} />
                    <span style={{ fontSize: "14px", color: t.textSecondary }}>{label}</span>
                  </label>
                ))}
              </div>
            </div>
            <div style={{ marginBottom: "16px" }}>
              <Label t={t}>Event visibility</Label>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {([["PUBLIC", "Public — findable by anyone"], ["UNLISTED", "Unlisted — only people with the link"], ["PRIVATE", "Private — invite only"]] as const).map(([val, label]) => (
                  <label key={val} style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer" }}>
                    <input type="radio" checked={visibility === val} onChange={() => { setVisibility(val); triggerSaveSettings({ visibility: val }); }} style={{ accentColor: t.accent }} />
                    <span style={{ fontSize: "14px", color: t.textSecondary }}>{label}</span>
                  </label>
                ))}
              </div>
            </div>
            {visibility === "PRIVATE" && (
              <Toggle
                label="Allow guests to invite friends"
                value={guestsCanInvite}
                onChange={(val) => { setGuestsCanInvite(val); triggerSaveSettings({ guestsCanInvite: val }); }}
                t={t}
              />
            )}
            {visibility === "PRIVATE" && (
              <div>
                <Label t={t}>Event password (optional)</Label>
                <input
                  type="text"
                  placeholder="Leave blank for no password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onBlur={() => {
                    triggerSaveSettings({ password: password.trim() || null });
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      triggerSaveSettings({ password: password.trim() || null });
                      e.currentTarget.blur();
                    }
                  }}
                  style={S.inp}
                  autoComplete="off"
                />
                {password && <div style={{ fontSize: "12px", color: t.textMuted, marginTop: "6px" }}>Guests must enter this password to view the event.</div>}
              </div>
            )}
          </Section>
        )}

        {/* ── Auto-Reminders ── */}
        {activeSection === "reminders" && (
          <Section title="Auto-Reminders" t={t}>
            <div style={{ fontSize: "13px", color: t.textMuted, marginBottom: "16px" }}>
              Reminders are sent to guests who provided their email or phone number.
            </div>
            <Toggle label="Nudge guests who haven't RSVP'd (3 days before)" value={nudgeUnresponded} onChange={(val) => { setNudgeUnresponded(val); triggerSaveReminders({ nudgeUnresponded: val }); }} t={t} />
            <div style={{ marginBottom: "20px" }}>
              <Label t={t}>Email reminders</Label>
              <Toggle label="1 week before" value={emailWeekBefore} onChange={(val) => { setEmailWeekBefore(val); triggerSaveReminders({ emailWeekBefore: val }); }} t={t} />
              <Toggle label="1 day before" value={emailDayBefore} onChange={(val) => { setEmailDayBefore(val); triggerSaveReminders({ emailDayBefore: val }); }} t={t} />
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
                <span style={{ fontSize: "14px", color: t.textSecondary, flex: 1 }}>Hours before</span>
                <select value={emailHoursBefore} onChange={(e) => { const val = Number(e.target.value); setEmailHoursBefore(val); triggerSaveReminders({ emailHoursBefore: val }); }} style={{ padding: "6px 10px", background: t.inputBg, border: `1px solid ${t.inputBorder}`, borderRadius: "8px", color: t.textPrimary, fontFamily: "inherit", colorScheme: t.textPrimary === "#ffffff" ? "dark" : "light", cursor: "pointer" }}>
                  <option value={0}>Off</option>
                  <option value={1}>1 hour</option>
                  <option value={2}>2 hours</option>
                  <option value={4}>4 hours</option>
                </select>
              </div>
            </div>
            <div style={{ marginBottom: "20px" }}>
              <Label t={t}>SMS reminders</Label>
              <Toggle label="1 week before" value={smsWeekBefore} onChange={(val) => { setSmsWeekBefore(val); triggerSaveReminders({ smsWeekBefore: val }); }} t={t} />
              <Toggle label="1 day before" value={smsDayBefore} onChange={(val) => { setSmsDayBefore(val); triggerSaveReminders({ smsDayBefore: val }); }} t={t} />
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
                <span style={{ fontSize: "14px", color: t.textSecondary, flex: 1 }}>Hours before</span>
                <select value={smsHoursBefore} onChange={(e) => { const val = Number(e.target.value); setSmsHoursBefore(val); triggerSaveReminders({ smsHoursBefore: val }); }} style={{ padding: "6px 10px", background: t.inputBg, border: `1px solid ${t.inputBorder}`, borderRadius: "8px", color: t.textPrimary, fontFamily: "inherit", colorScheme: t.textPrimary === "#ffffff" ? "dark" : "light", cursor: "pointer" }}>
                  <option value={0}>Off</option>
                  <option value={1}>1 hour</option>
                  <option value={2}>2 hours</option>
                </select>
              </div>
            </div>
          </Section>
        )}

        {/* ── Polls Sub-page ── */}
        {activeSection === "polls" && (
          <Section title="Manage Polls" t={t}>
            {/* Create Poll Form */}
            <div style={{ background: "rgba(255, 255, 255, 0.03)", padding: "16px", borderRadius: t.cardRadius, border: `1px solid ${t.cardBorder}`, marginBottom: "20px" }}>
              <div style={{ fontWeight: 700, fontSize: "14px", color: t.textPrimary, marginBottom: "12px" }}>Create a New Poll</div>
              <div style={{ marginBottom: "12px" }}>
                <input
                  style={S.inp}
                  placeholder="Ask a question... (e.g. What day works best?)"
                  value={newPollQuestion}
                  onChange={(e) => setNewPollQuestion(e.target.value)}
                />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "12px" }}>
                <div style={{ fontSize: "12px", fontWeight: 700, color: t.textMuted }}>Options:</div>
                {newPollOptions.map((opt, idx) => (
                  <div key={idx} style={{ display: "flex", gap: "6px" }}>
                    <input
                      style={{ ...S.inp, padding: "8px 12px" }}
                      placeholder={`Option ${idx + 1}`}
                      value={opt}
                      onChange={(e) => {
                        const updated = [...newPollOptions];
                        updated[idx] = e.target.value;
                        setNewPollOptions(updated);
                      }}
                    />
                    {newPollOptions.length > 2 && (
                      <button
                        type="button"
                        onClick={() => {
                          setNewPollOptions(newPollOptions.filter((_, i) => i !== idx));
                        }}
                        style={{ background: "none", border: "none", cursor: "pointer", color: t.textMuted, padding: "4px" }}
                      >
                        <X size={16} />
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setNewPollOptions([...newPollOptions, ""])}
                  style={{ background: "none", border: "none", cursor: "pointer", color: t.accent, fontSize: "12px", fontWeight: 600, display: "flex", alignItems: "center", gap: "4px", alignSelf: "flex-start", padding: "4px 0" }}
                >
                  <Plus size={14} /> Add option
                </button>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "16px" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: t.textSecondary, cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={newPollMultiChoice}
                    onChange={(e) => setNewPollMultiChoice(e.target.checked)}
                    style={{ cursor: "pointer" }}
                  />
                  <span>Allow voting for multiple options</span>
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: t.textSecondary, cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={newPollAllowGuestsToAdd}
                    onChange={(e) => setNewPollAllowGuestsToAdd(e.target.checked)}
                    style={{ cursor: "pointer" }}
                  />
                  <span>Allow guests to suggest options</span>
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: t.textSecondary, cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={newPollHideVoters}
                    onChange={(e) => setNewPollHideVoters(e.target.checked)}
                    style={{ cursor: "pointer" }}
                  />
                  <span>Hide voter names from other guests</span>
                </label>
              </div>

              <button
                type="button"
                onClick={handleAddPoll}
                disabled={!newPollQuestion.trim() || newPollOptions.filter(o => o.trim()).length < 2 || isPending}
                style={{ ...S.smallBtn, width: "100%", padding: "10px", borderRadius: "10px", fontSize: "13px" }}
              >
                Create Poll
              </button>
            </div>

            {/* List Existing Polls */}
            <div>
              <div style={{ fontWeight: 700, fontSize: "14px", color: t.textPrimary, marginBottom: "12px" }}>Active Polls ({polls.length})</div>
              {polls.length === 0 ? (
                <div style={{ fontSize: "13px", color: t.textMuted, fontStyle: "italic" }}>No polls created yet. Use the form above to create one.</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  {polls.map((poll) => (
                    <div key={poll.id} style={{ background: "rgba(255, 255, 255, 0.02)", border: `1px solid ${t.cardBorder}`, borderRadius: t.cardRadius, padding: "14px" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                        <div style={{ fontWeight: 600, fontSize: "14px", color: t.textPrimary }}>{poll.question}</div>
                        <button
                          type="button"
                          onClick={() => handleDeletePoll(poll.id)}
                          style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444", fontSize: "12px", fontWeight: 600 }}
                        >
                          Delete
                        </button>
                      </div>

                      {/* Poll options list with delete buttons */}
                      <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "12px" }}>
                        {poll.options.map((opt) => (
                          <div key={opt.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: t.inputBg, padding: "6px 10px", borderRadius: "8px", fontSize: "12.5px" }}>
                            <span style={{ color: t.textSecondary }}>{opt.text} ({opt.votes.length} votes)</span>
                            {poll.options.length > 2 && (
                              <button
                                type="button"
                                onClick={() => handleDeletePollOption(poll.id, opt.id)}
                                style={{ background: "none", border: "none", cursor: "pointer", color: t.textMuted, display: "flex", alignItems: "center" }}
                              >
                                <X size={12} />
                              </button>
                            )}
                          </div>
                        ))}

                        {/* Add option to existing poll */}
                        <div style={{ display: "flex", gap: "6px", marginTop: "4px" }}>
                          <input
                            style={{ ...S.inp, padding: "6px 10px", fontSize: "12px" }}
                            placeholder="Add option..."
                            value={newPollOptionTexts[poll.id] ?? ""}
                            onChange={(e) => setNewPollOptionTexts({ ...newPollOptionTexts, [poll.id]: e.target.value })}
                            onKeyDown={(e) => { if (e.key === "Enter") handleAddPollOption(poll.id); }}
                          />
                          <button
                            type="button"
                            onClick={() => handleAddPollOption(poll.id)}
                            style={{ ...S.smallBtn, padding: "6px 12px", fontSize: "12px" }}
                          >
                            Add
                          </button>
                        </div>
                      </div>

                      {/* Poll controls */}
                      <div style={{ display: "flex", flexDirection: "column", gap: "6px", borderTop: `1px solid ${t.cardBorder}`, paddingTop: "8px" }}>
                        <Toggle
                          label="Locked (closed for voting)"
                          value={poll.locked}
                          onChange={(val) => handleUpdatePollSettings(poll.id, { locked: val })}
                          t={t}
                        />
                        <Toggle
                          label="Multi-choice voting"
                          value={poll.multiChoice}
                          onChange={(val) => handleUpdatePollSettings(poll.id, { multiChoice: val })}
                          t={t}
                        />
                        <Toggle
                          label="Allow guests to add options"
                          value={poll.allowGuestsToAdd}
                          onChange={(val) => handleUpdatePollSettings(poll.id, { allowGuestsToAdd: val })}
                          t={t}
                        />
                        <Toggle
                          label="Hide voter names"
                          value={poll.hideVoters}
                          onChange={(val) => handleUpdatePollSettings(poll.id, { hideVoters: val })}
                          t={t}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Section>
        )}

        {/* ── Potluck Sub-page ── */}
        {activeSection === "potluck" && (
          <Section title="Manage Potluck Items" t={t}>
            {/* Add Potluck Item Form */}
            <div style={{ background: "rgba(255, 255, 255, 0.03)", padding: "16px", borderRadius: t.cardRadius, border: `1px solid ${t.cardBorder}`, marginBottom: "20px" }}>
              <div style={{ fontWeight: 700, fontSize: "14px", color: t.textPrimary, marginBottom: "12px" }}>Add a New Item</div>
              <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
                <input
                  style={{ ...S.inp, flex: 1 }}
                  placeholder="Item name (e.g. Red wine, cups, chips)"
                  value={newPotluckLabel}
                  onChange={(e) => setNewPotluckLabel(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleAddPotluckItem(); }}
                />
                <input
                  type="number"
                  min="1"
                  style={{ ...S.inp, width: "70px", textAlign: "center" }}
                  value={newPotluckQty}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === "") {
                      setNewPotluckQty("");
                    } else {
                      const num = parseInt(val);
                      setNewPotluckQty(isNaN(num) ? "" : Math.max(1, num));
                    }
                  }}
                  placeholder="Qty"
                />
              </div>
              <button
                type="button"
                onClick={handleAddPotluckItem}
                disabled={!newPotluckLabel.trim() || isPending}
                style={{ ...S.smallBtn, width: "100%", padding: "10px", borderRadius: "10px", fontSize: "13px" }}
              >
                Add Item
              </button>
            </div>

            {/* List Existing Potluck Items */}
            <div>
              <div style={{ fontWeight: 700, fontSize: "14px", color: t.textPrimary, marginBottom: "12px" }}>Items Needed ({potluckItems.length})</div>
              {potluckItems.length === 0 ? (
                <div style={{ fontSize: "13px", color: t.textMuted, fontStyle: "italic" }}>No potluck items added yet. Use the form above to add items for guests to claim.</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {potluckItems.map((item) => {
                    const totalClaimed = item.claims ? item.claims.reduce((sum, c) => sum + c.quantity, 0) : 0;
                    const remaining = Math.max(0, item.quantity - totalClaimed);
                    return (
                      <div key={item.id} style={{ background: t.cardBg, border: `1px solid ${t.cardBorder}`, borderRadius: t.cardRadius, padding: "12px 16px" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <div style={{ flex: 1 }}>
                            <span style={{ fontSize: "14px", fontWeight: 600, color: t.textPrimary }}>
                              {item.label} {item.quantity > 1 && `(need ${item.quantity})`}
                            </span>
                            {totalClaimed > 0 && (
                              <span style={{ fontSize: "12px", color: t.textMuted, marginLeft: "8px" }}>
                                ({remaining} remaining)
                              </span>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemovePotluckItem(item.id)}
                            style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444", fontSize: "12px", fontWeight: 600, padding: "4px" }}
                          >
                            Remove
                          </button>
                        </div>
                        {item.claims && item.claims.length > 0 && (
                          <div style={{ marginTop: "8px", borderTop: `1px dashed ${t.cardBorder}`, paddingTop: "6px", display: "flex", flexDirection: "column", gap: "4px" }}>
                            {item.claims.map((claim) => (
                              <div key={claim.id} style={{ fontSize: "12px", color: t.textSecondary, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                <span>• {claim.guestName} <span style={{ color: t.textMuted }}>(bringing {claim.quantity})</span></span>
                                <button
                                  type="button"
                                  onClick={() => handleUnclaimItem(item.id, claim.guestName)}
                                  style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444", fontSize: "11px", fontWeight: 600, padding: "2px 4px" }}
                                  title="Remove claim"
                                >
                                  Unclaim
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </Section>
        )}

        {err && <div style={{ color: "#f87171", fontSize: "13px", textAlign: "center", marginTop: "16px" }}>{err}</div>}
      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function Label({ children, t }: { children: React.ReactNode; t: ResolvedTheme }) {
  return <div style={{ fontSize: "12px", fontWeight: 700, textTransform: "none", letterSpacing: "0.02em", color: t.textMuted, marginBottom: "10px" }}>{children}</div>;
}

function Toggle({ label, value, onChange, t }: { label: string; value: boolean; onChange: (v: boolean) => void; t: ResolvedTheme }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
      <span style={{ fontSize: "14px", color: t.textSecondary }}>{label}</span>
      <button onClick={() => onChange(!value)} style={{ width: "44px", height: "24px", borderRadius: "100px", cursor: "pointer", background: value ? t.accent : t.inputBg, border: `1px solid ${t.inputBorder}`, position: "relative", transition: "background 0.2s", flexShrink: 0 }}>
        <span style={{ position: "absolute", top: "3px", left: value ? "23px" : "3px", width: "18px", height: "18px", borderRadius: "50%", background: value ? t.accentFg : t.textSecondary, transition: "left 0.2s" }} />
      </button>
    </div>
  );
}

function Section({ title, children, t }: { title: string; children: React.ReactNode; t: ResolvedTheme }) {
  return (
    <div style={{ background: t.cardBg, border: `1px solid ${t.cardBorder}`, borderRadius: t.cardRadius, padding: "20px", marginBottom: "16px", boxShadow: t.cardShadow, backdropFilter: "blur(12px)" }}>
      <h2 style={{ fontSize: "15px", fontWeight: 700, color: t.textPrimary, marginBottom: "20px" }}>{title}</h2>
      {children}
    </div>
  );
}
