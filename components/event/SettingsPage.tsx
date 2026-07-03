"use client";

import { useState, useTransition, useEffect, useMemo } from "react";
import { ArrowLeft, Check } from "lucide-react";
import { AppNavLogo } from "@/components/ui/AppNav";
import ProfileDropdown from "@/components/ui/ProfileDropdown";
import AdminHamburger from "@/components/ui/AdminHamburger";
import { type BaseTheme, resolveTheme, getSortedPresets } from "@/lib/theme";
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
import type {
  CoHostEntry,
  DbThemePreset,
  EventInput,
  PollEntry,
  PotluckItemEntry,
  ReminderOverrides,
  RsvpFieldEntry,
  SessionUser,
  SettingsOverrides,
  SettingsSection,
} from "./settings-page/types";
import { formatOptionsForTextarea, serializeOptionsForDb } from "./settings-page/helpers";
import { buildStyles } from "./settings-page/styles";
import { SettingsDecorations } from "./settings-page/SettingsDecorations";
import { SettingsMenu } from "./settings-page/SettingsMenu";
import { ThemePanel } from "./settings-page/ThemePanel";
import { HostsPanel } from "./settings-page/HostsPanel";
import { RsvpOptionsPanel } from "./settings-page/RsvpOptionsPanel";
import { QuestionnairePanel } from "./settings-page/QuestionnairePanel";
import { DisplayOptionsPanel } from "./settings-page/DisplayOptionsPanel";
import { RemindersPanel } from "./settings-page/RemindersPanel";
import { PollsPanel } from "./settings-page/PollsPanel";
import { PotluckPanel } from "./settings-page/PotluckPanel";
import { EmailsPanel } from "./settings-page/EmailsPanel";

export type { SessionUser } from "./settings-page/types";

export function SettingsPage({
  event,
  isOwner,
  themePresets = [],
  sessionUser = null,
  channelConfig = { email: true, sms: true },
}: {
  event: EventInput;
  isOwner: boolean;
  themePresets?: DbThemePreset[];
  sessionUser?: SessionUser | null;
  channelConfig?: { email: boolean; sms: boolean };
}) {
  const [isPending, startTransition] = useTransition();
  const [saveStatus, setSaveStatus] = useState<"IDLE" | "SAVING" | "SAVED" | "ERROR">("IDLE");
  const [err, setErr] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<SettingsSection | null>(null);

  // ── Theme State ──
  const [base, setBase] = useState<BaseTheme>(event.theme?.baseTheme ?? "DARK");
  const [gradientFrom, setGradientFrom] = useState(event.theme?.gradientFrom ?? "#7c3aed");
  const [gradientTo, setGradientTo] = useState(event.theme?.gradientTo ?? "#1e40af");
  const [accent, setAccent] = useState(event.theme?.accentColor ?? "#a855f7");
  const [cardOpacity, setCardOpacity] = useState<number>(
    event.theme?.cardOpacity ??
      (event.theme?.baseTheme === "DARK" ? 0.5 : event.theme?.baseTheme === "SOFT" ? 0.85 : 0.8)
  );
  const [themePresetId, setThemePresetId] = useState<string | null>(
    event.theme?.appliedPresetId ?? null
  );
  const [themeSearch, setThemeSearch] = useState("");
  const [themeFilter, setThemeFilter] = useState<"all" | "seasonal" | "general" | "light" | "dark">(
    "all"
  );
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
  const [password, setPassword] = useState("");
  const [passwordDirty, setPasswordDirty] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  // Tracks when the host explicitly saved a password removal this session,
  // so the "SET" badge and placeholder update without a full page reload.
  const [passwordSavedAsNull, setPasswordSavedAsNull] = useState(false);
  const effectivePasswordHash = passwordSavedAsNull ? null : event.passwordHash;

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
  const [newFieldType, setNewFieldType] = useState<"TEXT" | "TEXTAREA" | "SELECT" | "CHECKBOX">(
    "TEXT"
  );
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
      const validSections = [
        "theme",
        "hosts",
        "rsvp",
        "questionnaire",
        "privacy",
        "reminders",
        "polls",
        "potluck",
      ];
      if (validSections.includes(section || "")) {
        return section as SettingsSection;
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

  const openSection = (section: SettingsSection) => {
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
    if (themeFilter === "light")
      result = result.filter((p) => p.base === "SOFT" || p.base === "BOLD");
    if (themeFilter === "dark") result = result.filter((p) => p.base === "DARK");
    if (themeSearch.trim()) {
      const q = themeSearch.toLowerCase();
      result = result.filter((p) => p.name.toLowerCase().includes(q) || p.emoji.includes(q));
    }
    return result;
  }, [sortedThemePresets, themeFilter, themeSearch]);

  // ── Theme Auto-Save ──
  const triggerSaveTheme = (
    newBase: BaseTheme,
    newFrom: string,
    newTo: string,
    newAccent: string,
    presetId?: string | null,
    newCardOpacity?: number
  ) => {
    setSaveStatus("SAVING");
    setErr(null);
    startTransition(async () => {
      try {
        await saveEventTheme(
          event.id,
          newBase,
          newFrom,
          newTo,
          newAccent,
          presetId !== undefined ? presetId : themePresetId,
          newCardOpacity !== undefined ? newCardOpacity : cardOpacity
        );
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
      plusOneAllowed:
        overrides.plusOneAllowed !== undefined ? overrides.plusOneAllowed : plusOneAllowed,
      plusOneMax: overrides.plusOneMax !== undefined ? overrides.plusOneMax : plusOneMax,
      plusOneNamesRequired:
        overrides.plusOneNamesRequired !== undefined
          ? overrides.plusOneNamesRequired
          : plusOneNamesRequired,
      guestSharingEnabled:
        overrides.guestSharingEnabled !== undefined
          ? overrides.guestSharingEnabled
          : guestSharingEnabled,
      guestsCanInvite:
        overrides.guestsCanInvite !== undefined ? overrides.guestsCanInvite : guestsCanInvite,
      approvalRequired:
        overrides.approvalRequired !== undefined ? overrides.approvalRequired : approvalRequired,
      maybeEnabled: overrides.maybeEnabled !== undefined ? overrides.maybeEnabled : maybeEnabled,
      capacity:
        overrides.capacity !== undefined
          ? overrides.capacity
          : capacity.trim()
            ? Number(capacity)
            : null,
      rsvpDeadline:
        overrides.rsvpDeadline !== undefined ? overrides.rsvpDeadline : rsvpDeadline || null,
      commentsEnabled:
        overrides.commentsEnabled !== undefined ? overrides.commentsEnabled : commentsEnabled,
      guestListVis: overrides.guestListVis !== undefined ? overrides.guestListVis : guestListVis,
      showTimestamps:
        overrides.showTimestamps !== undefined ? overrides.showTimestamps : showTimestamps,
      visibility: overrides.visibility !== undefined ? overrides.visibility : visibility,
      ...(overrides.password !== undefined
        ? { password: overrides.password }
        : passwordDirty
          ? { password: password.trim() || null }
          : {}),
      questionnaireEnabled:
        overrides.questionnaireEnabled !== undefined
          ? overrides.questionnaireEnabled
          : questionnaireEnabled,
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
      emailWeekBefore:
        overrides.emailWeekBefore !== undefined ? overrides.emailWeekBefore : emailWeekBefore,
      emailDayBefore:
        overrides.emailDayBefore !== undefined ? overrides.emailDayBefore : emailDayBefore,
      emailHoursBefore:
        overrides.emailHoursBefore !== undefined ? overrides.emailHoursBefore : emailHoursBefore,
      smsWeekBefore:
        overrides.smsWeekBefore !== undefined ? overrides.smsWeekBefore : smsWeekBefore,
      smsDayBefore: overrides.smsDayBefore !== undefined ? overrides.smsDayBefore : smsDayBefore,
      smsHoursBefore:
        overrides.smsHoursBefore !== undefined ? overrides.smsHoursBefore : smsHoursBefore,
      nudgeUnresponded:
        overrides.nudgeUnresponded !== undefined ? overrides.nudgeUnresponded : nudgeUnresponded,
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
        setCoHosts((prev) => [
          ...prev,
          {
            id: result.cohostId!,
            user: { id: result.cohostId!, name: result.name ?? null, email: result.email! },
          },
        ]);
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

  const handleUpdatePollSettings = (
    pollId: string,
    settings: {
      question?: string;
      multiChoice?: boolean;
      allowGuestsToAdd?: boolean;
      locked?: boolean;
      hideVoters?: boolean;
    }
  ) => {
    setSaveStatus("SAVING");
    startTransition(async () => {
      try {
        await updatePollSettings(pollId, settings);
        setPolls((prev) => prev.map((p) => (p.id === pollId ? { ...p, ...settings } : p)));
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
        const serialized =
          newFieldType === "SELECT" || newFieldType === "CHECKBOX"
            ? serializeOptionsForDb(newFieldOptions)
            : undefined;
        const result = await addRsvpField(event.id, {
          label: newFieldLabel.trim(),
          fieldType: newFieldType,
          required: newFieldRequired,
          options: serialized,
          order: fields.length,
        });
        if (result.success) {
          setFields((prev) => [
            ...prev,
            {
              id: result.id!,
              label: newFieldLabel.trim(),
              fieldType: newFieldType,
              required: newFieldRequired,
              options: serialized ?? null,
              order: prev.length,
            },
          ]);
          setLabelDrafts((prev) => ({ ...prev, [result.id!]: newFieldLabel.trim() }));
          setOptionsDrafts((prev) => ({
            ...prev,
            [result.id!]: formatOptionsForTextarea(serialized ?? null),
          }));
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
        setFields((prev) => prev.map((x) => (x.id === fieldId ? { ...x, fieldType } : x)));
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
        setFields((prev) => prev.map((x) => (x.id === fieldId ? { ...x, required } : x)));
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
        setFields((prev) => prev.map((x) => (x.id === fieldId ? { ...x, label } : x)));
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
        setFields((prev) => prev.map((x) => (x.id === fieldId ? { ...x, options } : x)));
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
  const t = resolveTheme(base, gradientFrom, gradientTo, accent, cardOpacity);

  const S = buildStyles(t);

  return (
    <div style={S.page}>
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
      <SettingsDecorations t={t} />

      {/* ── Global nav ── */}
      <AppNavLogo
        href="/dashboard"
        leading={sessionUser?.role === "ADMIN" ? <AdminHamburger /> : undefined}
        trailing={sessionUser ? <ProfileDropdown user={sessionUser} /> : undefined}
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 200,
          background: "rgba(15,15,20,0.9)",
          backdropFilter: "blur(14px)",
          WebkitBackdropFilter: "blur(14px)",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          color: "#ffffff",
          padding: "0 16px",
          height: "53px",
        }}
      />

      {/* ── Settings sub-nav ── */}
      <div style={S.header}>
        <button
          onClick={() => {
            if (activeSection) {
              closeSection();
            } else {
              window.location.href = `/e/${event.slug}`;
            }
          }}
          style={{
            display: "flex",
            alignItems: "center",
            color: t.textSecondary,
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: 0,
          }}
        >
          <ArrowLeft size={20} />
        </button>
        <h1
          style={{
            fontSize: "17px",
            fontWeight: 700,
            color: t.textPrimary,
            flex: 1,
            marginLeft: "12px",
          }}
        >
          {activeSection ? (
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ cursor: "pointer", opacity: 0.6 }} onClick={closeSection}>
                Settings
              </span>
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
                {activeSection === "emails" && "Emails"}
              </span>
            </div>
          ) : (
            "Event Settings"
          )}
        </h1>
        {saveStatus === "SAVING" && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              fontSize: "12px",
              color: t.textMuted,
            }}
          >
            <span
              style={{
                display: "inline-block",
                width: "12px",
                height: "12px",
                borderRadius: "50%",
                border: `2px solid ${t.accent}`,
                borderTopColor: "transparent",
                animation: "spin 0.6s linear infinite",
                boxSizing: "border-box",
              }}
            />
            Saving...
          </div>
        )}
      </div>

      {/* Floating toast notification for settings save status */}
      {(saveStatus === "SAVED" || saveStatus === "ERROR") && (
        <div
          style={{
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
            transition: "all 0.2s ease-in-out",
          }}
        >
          {saveStatus === "SAVED" ? <Check size={16} color="#22c55e" /> : <span>⚠️</span>}
          {saveStatus === "SAVED" ? "Changes saved" : "Error saving changes"}
        </div>
      )}

      <div style={S.container}>
        {activeSection === null && (
          <SettingsMenu
            isOwner={isOwner}
            openSection={openSection}
            t={t}
            emailEnabled={channelConfig.email}
          />
        )}

        {/* ── Theme ── */}
        {activeSection === "theme" && (
          <ThemePanel
            event={event}
            themePresets={themePresets}
            visibleThemePresets={visibleThemePresets}
            themeSearch={themeSearch}
            setThemeSearch={setThemeSearch}
            themeFilter={themeFilter}
            setThemeFilter={setThemeFilter}
            themeCustomizeOpen={themeCustomizeOpen}
            setThemeCustomizeOpen={setThemeCustomizeOpen}
            base={base}
            setBase={setBase}
            gradientFrom={gradientFrom}
            setGradientFrom={setGradientFrom}
            gradientTo={gradientTo}
            setGradientTo={setGradientTo}
            accent={accent}
            setAccent={setAccent}
            cardOpacity={cardOpacity}
            setCardOpacity={setCardOpacity}
            themePresetId={themePresetId}
            setThemePresetId={setThemePresetId}
            triggerSaveTheme={triggerSaveTheme}
            t={t}
          />
        )}

        {/* ── Hosts ── */}
        {activeSection === "hosts" && isOwner && (
          <HostsPanel
            event={event}
            coHosts={coHosts}
            cohostEmail={cohostEmail}
            setCohostEmail={setCohostEmail}
            cohostError={cohostError}
            handleAddCohost={handleAddCohost}
            handleRemoveCohost={handleRemoveCohost}
            isPending={isPending}
            t={t}
            S={S}
          />
        )}

        {/* ── RSVP Options ── */}
        {activeSection === "rsvp" && (
          <RsvpOptionsPanel
            plusOneAllowed={plusOneAllowed}
            setPlusOneAllowed={setPlusOneAllowed}
            plusOneMax={plusOneMax}
            setPlusOneMax={setPlusOneMax}
            plusOneNamesRequired={plusOneNamesRequired}
            setPlusOneNamesRequired={setPlusOneNamesRequired}
            approvalRequired={approvalRequired}
            setApprovalRequired={setApprovalRequired}
            maybeEnabled={maybeEnabled}
            setMaybeEnabled={setMaybeEnabled}
            showTimestamps={showTimestamps}
            setShowTimestamps={setShowTimestamps}
            capacity={capacity}
            setCapacity={setCapacity}
            rsvpDeadline={rsvpDeadline}
            setRsvpDeadline={setRsvpDeadline}
            triggerSaveSettings={triggerSaveSettings}
            t={t}
            S={S}
          />
        )}

        {/* ── Questionnaire ── */}
        {activeSection === "questionnaire" && (
          <QuestionnairePanel
            questionnaireEnabled={questionnaireEnabled}
            setQuestionnaireEnabled={setQuestionnaireEnabled}
            fields={fields}
            addingField={addingField}
            setAddingField={setAddingField}
            newFieldLabel={newFieldLabel}
            setNewFieldLabel={setNewFieldLabel}
            newFieldType={newFieldType}
            setNewFieldType={setNewFieldType}
            newFieldRequired={newFieldRequired}
            setNewFieldRequired={setNewFieldRequired}
            newFieldOptions={newFieldOptions}
            setNewFieldOptions={setNewFieldOptions}
            labelDrafts={labelDrafts}
            setLabelDrafts={setLabelDrafts}
            optionsDrafts={optionsDrafts}
            setOptionsDrafts={setOptionsDrafts}
            handleAddField={handleAddField}
            handleUpdateFieldType={handleUpdateFieldType}
            handleUpdateFieldRequired={handleUpdateFieldRequired}
            handleUpdateFieldLabel={handleUpdateFieldLabel}
            handleUpdateFieldOptions={handleUpdateFieldOptions}
            handleDeleteField={handleDeleteField}
            triggerSaveSettings={triggerSaveSettings}
            isPending={isPending}
            t={t}
            S={S}
          />
        )}

        {/* ── Display Options ── */}
        {activeSection === "privacy" && (
          <DisplayOptionsPanel
            commentsEnabled={commentsEnabled}
            setCommentsEnabled={setCommentsEnabled}
            guestSharingEnabled={guestSharingEnabled}
            setGuestSharingEnabled={setGuestSharingEnabled}
            guestListVis={guestListVis}
            setGuestListVis={setGuestListVis}
            visibility={visibility}
            setVisibility={setVisibility}
            guestsCanInvite={guestsCanInvite}
            setGuestsCanInvite={setGuestsCanInvite}
            password={password}
            setPassword={setPassword}
            passwordDirty={passwordDirty}
            setPasswordDirty={setPasswordDirty}
            showPassword={showPassword}
            setShowPassword={setShowPassword}
            setPasswordSavedAsNull={setPasswordSavedAsNull}
            effectivePasswordHash={effectivePasswordHash}
            triggerSaveSettings={triggerSaveSettings}
            t={t}
            S={S}
          />
        )}

        {/* ── Auto-Reminders ── */}
        {activeSection === "reminders" && (
          <RemindersPanel
            channelConfig={channelConfig}
            nudgeUnresponded={nudgeUnresponded}
            setNudgeUnresponded={setNudgeUnresponded}
            emailWeekBefore={emailWeekBefore}
            setEmailWeekBefore={setEmailWeekBefore}
            emailDayBefore={emailDayBefore}
            setEmailDayBefore={setEmailDayBefore}
            emailHoursBefore={emailHoursBefore}
            setEmailHoursBefore={setEmailHoursBefore}
            smsWeekBefore={smsWeekBefore}
            setSmsWeekBefore={setSmsWeekBefore}
            smsDayBefore={smsDayBefore}
            setSmsDayBefore={setSmsDayBefore}
            smsHoursBefore={smsHoursBefore}
            setSmsHoursBefore={setSmsHoursBefore}
            triggerSaveReminders={triggerSaveReminders}
            t={t}
          />
        )}

        {/* ── Emails ── */}
        {activeSection === "emails" && <EmailsPanel eventId={event.id} t={t} />}

        {/* ── Polls Sub-page ── */}
        {activeSection === "polls" && (
          <PollsPanel
            polls={polls}
            newPollQuestion={newPollQuestion}
            setNewPollQuestion={setNewPollQuestion}
            newPollOptions={newPollOptions}
            setNewPollOptions={setNewPollOptions}
            newPollMultiChoice={newPollMultiChoice}
            setNewPollMultiChoice={setNewPollMultiChoice}
            newPollAllowGuestsToAdd={newPollAllowGuestsToAdd}
            setNewPollAllowGuestsToAdd={setNewPollAllowGuestsToAdd}
            newPollHideVoters={newPollHideVoters}
            setNewPollHideVoters={setNewPollHideVoters}
            newPollOptionTexts={newPollOptionTexts}
            setNewPollOptionTexts={setNewPollOptionTexts}
            handleAddPoll={handleAddPoll}
            handleDeletePoll={handleDeletePoll}
            handleUpdatePollSettings={handleUpdatePollSettings}
            handleAddPollOption={handleAddPollOption}
            handleDeletePollOption={handleDeletePollOption}
            isPending={isPending}
            t={t}
            S={S}
          />
        )}

        {/* ── Potluck Sub-page ── */}
        {activeSection === "potluck" && (
          <PotluckPanel
            potluckItems={potluckItems}
            newPotluckLabel={newPotluckLabel}
            setNewPotluckLabel={setNewPotluckLabel}
            newPotluckQty={newPotluckQty}
            setNewPotluckQty={setNewPotluckQty}
            handleAddPotluckItem={handleAddPotluckItem}
            handleRemovePotluckItem={handleRemovePotluckItem}
            handleUnclaimItem={handleUnclaimItem}
            isPending={isPending}
            t={t}
            S={S}
          />
        )}

        {err && (
          <div
            style={{ color: "#f87171", fontSize: "13px", textAlign: "center", marginTop: "16px" }}
          >
            {err}
          </div>
        )}
      </div>
    </div>
  );
}
