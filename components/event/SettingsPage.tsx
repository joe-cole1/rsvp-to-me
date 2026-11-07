"use client";

import { useTranslations } from "next-intl";

import { useState, useTransition, useEffect, useMemo } from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { InlineAlert, Toast } from "@/components/ui/Feedback";
import { type BaseTheme, resolveTheme, getSortedPresets, getDefaultCardOpacity } from "@/lib/theme";
import { resolveEffectConfig } from "@/lib/effects";
import type { LibraryIconSummary } from "@/lib/effect-catalog-shared";
import {
  effectStateToFields,
  initialEffectState,
  type EffectEditorState,
} from "./settings-page/effect-state";
import {
  saveEventSettings,
  saveEventTheme,
  addCoHost,
  removeCoHost,
  updateCoHostDisplayName,
  cancelCoHostInvitation,
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
  RsvpFieldEntry,
  SessionUser,
  SettingsOverrides,
  SettingsSection,
  ThemeExtrasOverrides,
} from "./settings-page/types";
import { formatOptionsForTextarea, serializeOptionsForDb } from "./settings-page/helpers";
import { buildStyles } from "./settings-page/styles";
import { EventAtmosphere } from "./EventAtmosphere";
import { SettingsMenu } from "./settings-page/SettingsMenu";
import { ThemePanel } from "./settings-page/ThemePanel";
import { HostsPanel } from "./settings-page/HostsPanel";
import { RsvpOptionsPanel } from "./settings-page/RsvpOptionsPanel";
import { QuestionnairePanel } from "./settings-page/QuestionnairePanel";
import { DisplayOptionsPanel } from "./settings-page/DisplayOptionsPanel";
import { DangerZonePanel } from "./settings-page/DangerZonePanel";
import { ReminderSchedule } from "@/components/notifications/ReminderSchedule";
import type { SaveReport } from "@/components/notifications/NotificationPreferences";
import { PollsPanel } from "./settings-page/PollsPanel";
import { PotluckPanel } from "./settings-page/PotluckPanel";
import { EmailsPanel } from "./settings-page/EmailsPanel";
import { useCaptcha } from "@/components/ui/CaptchaProvider";
import { guestRsvpDisplayFields } from "@/lib/guestRsvpDisplay";

export type { SessionUser } from "./settings-page/types";

export function SettingsPage({
  event,
  isOwner,
  themePresets = [],
  sessionUser = null,
  channelConfig = { email: true, sms: true },
  initialLibraryIcons = [],
}: {
  event: EventInput;
  isOwner: boolean;
  themePresets?: DbThemePreset[];
  sessionUser?: SessionUser | null;
  channelConfig?: { email: boolean; sms: boolean };
  /** Server-resolved summaries of the stored custom effect's icons (#825) */
  initialLibraryIcons?: LibraryIconSummary[];
}) {
  const translate = useTranslations("Ui.Event.SettingsPage");
  const common = useTranslations("Ui.Common");

  const [isPending, startTransition] = useTransition();
  const { runWithCaptcha } = useCaptcha();
  const [saveStatus, setSaveStatus] = useState<"IDLE" | "SAVING" | "SAVED" | "ERROR">("IDLE");
  const [err, setErr] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<SettingsSection | null>(null);

  // ── Theme State ──
  const [base, setBase] = useState<BaseTheme>(event.theme?.baseTheme ?? "DARK");
  const [gradientFrom, setGradientFrom] = useState(event.theme?.gradientFrom ?? "#7c3aed");
  const [gradientTo, setGradientTo] = useState(event.theme?.gradientTo ?? "#1e40af");
  const [accent, setAccent] = useState(event.theme?.accentColor ?? "#a855f7");
  const [cardOpacity, setCardOpacity] = useState<number>(
    event.theme?.cardOpacity ?? getDefaultCardOpacity(event.theme?.baseTheme)
  );
  const [themePresetId, setThemePresetId] = useState<string | null>(
    event.theme?.appliedPresetId ?? null
  );
  const [fontId, setFontId] = useState<string | null>(event.theme?.fontId ?? null);
  // #825: one object for every effect field, so each save sends all of them.
  const [effect, setEffect] = useState<EffectEditorState>(() => initialEffectState(event.theme));
  // Summaries for library icons this editor knows: the stored mixture, plus
  // anything picked from search results. Only these few labels reach the client.
  const [libraryIcons, setLibraryIcons] = useState<Record<string, LibraryIconSummary>>(() =>
    Object.fromEntries(initialLibraryIcons.map((icon) => [icon.id, icon]))
  );
  const rememberLibraryIcons = (icons: LibraryIconSummary[]) =>
    setLibraryIcons((known) => ({
      ...known,
      ...Object.fromEntries(icons.map((icon) => [icon.id, icon])),
    }));
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
  const [allowEditAfterDeadline, setAllowEditAfterDeadline] = useState(
    event.allowEditAfterDeadline
  );
  const [hostDisplayName, setHostDisplayName] = useState(event.hostDisplayName || "");
  const [hostAlertEmail, setHostAlertEmail] = useState(event.hostAlertEmail);
  const [hostAlertSms, setHostAlertSms] = useState(event.hostAlertSms);

  // ── Display & Privacy State ──
  const [commentsEnabled, setCommentsEnabled] = useState(event.commentsEnabled);
  const [guestSharingEnabled, setGuestSharingEnabled] = useState(event.guestSharingEnabled);
  const [guestListVis, setGuestListVis] = useState(event.guestListVis);
  const [guestRsvpDisplay, setGuestRsvpDisplay] = useState(() => guestRsvpDisplayFields(event));
  const [showTimestamps, setShowTimestamps] = useState(event.showTimestamps);
  const [visibility, setVisibility] = useState(event.visibility);
  const [password, setPassword] = useState("");
  const [passwordDirty, setPasswordDirty] = useState(false);
  // Tracks when the host explicitly saved a password removal this session,
  // so the "SET" badge and placeholder update without a full page reload.
  const [passwordSavedAsNull, setPasswordSavedAsNull] = useState(false);
  const effectivePasswordHash = passwordSavedAsNull ? null : event.passwordHash;

  // Notification editors save each switch immediately; reuse the page's save indicator.
  const reportNotificationStatus: SaveReport = (state, message) => {
    setSaveStatus(state);
    setErr(state === "ERROR" ? (message ?? translate("failedSaveSettings")) : null);
  };

  // ── Co-hosts State ──
  const [coHosts, setCoHosts] = useState<CoHostEntry[]>(event.coHosts);
  const [pendingInvitations, setPendingInvitations] = useState<{ id: string; email: string }[]>(
    event.coHostInvitations || []
  );
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
    newCardOpacity?: number,
    extras?: ThemeExtrasOverrides
  ) => {
    setSaveStatus("SAVING");
    setErr(null);
    startTransition(async () => {
      try {
        await runWithCaptcha("event_theme", (token) =>
          saveEventTheme(
            event.id,
            newBase,
            newFrom,
            newTo,
            newAccent,
            presetId !== undefined ? presetId : themePresetId,
            newCardOpacity !== undefined ? newCardOpacity : cardOpacity,
            {
              fontId: extras?.fontId !== undefined ? extras.fontId : fontId,
              // Always the complete effect, so a color or font save can never
              // drop a custom mixture or an explicit movement.
              ...effectStateToFields(extras?.effect ?? effect),
            },
            token
          )
        );
        setSaveStatus("SAVED");
      } catch {
        setSaveStatus("ERROR");
        setErr(translate("failedSaveThemeSettings"));
      }
    });
  };

  // ── Settings Auto-Save ──
  const triggerSaveSettings = (overrides: SettingsOverrides) => {
    setSaveStatus("SAVING");
    setErr(null);
    const data = {
      ...guestRsvpDisplayFields({ ...guestRsvpDisplay, ...overrides }),
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
      allowEditAfterDeadline:
        overrides.allowEditAfterDeadline !== undefined
          ? overrides.allowEditAfterDeadline
          : allowEditAfterDeadline,
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
      hostDisplayName:
        overrides.hostDisplayName !== undefined
          ? overrides.hostDisplayName
          : hostDisplayName || null,
      hostAlertEmail:
        overrides.hostAlertEmail !== undefined ? overrides.hostAlertEmail : hostAlertEmail,
      hostAlertSms: overrides.hostAlertSms !== undefined ? overrides.hostAlertSms : hostAlertSms,
    };
    startTransition(async () => {
      try {
        const res = await runWithCaptcha("event_settings", (token) =>
          saveEventSettings(event.id, data, token)
        );
        if (res && !res.success) {
          setSaveStatus("ERROR");
          setErr(res.error ?? translate("failedSaveSettings"));
        } else {
          setSaveStatus("SAVED");
        }
      } catch {
        setSaveStatus("ERROR");
        setErr(translate("failedSaveSettings"));
      }
    });
  };

  // ── Co-hosts Actions ──
  const handleAddCohost = () => {
    setSaveStatus("SAVING");
    setCohostError(null);
    startTransition(async () => {
      try {
        const result = await runWithCaptcha("cohost_manage", (token) =>
          addCoHost(event.id, cohostEmail.trim(), token)
        );
        if (!result.success) {
          setCohostError(result.error ?? translate("errorAddingCoHost"));
          setSaveStatus("ERROR");
          return;
        }
        setPendingInvitations((prev) => [
          ...prev,
          {
            id: result.invitationId!,
            email: result.email!,
          },
        ]);
        setCohostEmail("");
        setSaveStatus("SAVED");
      } catch {
        setCohostError(translate("unexpectedErrorOccurred"));
        setSaveStatus("ERROR");
      }
    });
  };

  const handleCancelInvitation = (invitationId: string) => {
    setSaveStatus("SAVING");
    startTransition(async () => {
      try {
        await cancelCoHostInvitation(invitationId);
        setPendingInvitations((prev) => prev.filter((i) => i.id !== invitationId));
        setSaveStatus("SAVED");
      } catch {
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

  const handleUpdateCohostDisplayName = (cohostRecordId: string, displayName: string | null) => {
    setSaveStatus("SAVING");
    startTransition(async () => {
      try {
        await runWithCaptcha("cohost_manage", (token) =>
          updateCoHostDisplayName(cohostRecordId, displayName, token)
        );
        setCoHosts((prev) =>
          prev.map((c) => (c.id === cohostRecordId ? { ...c, displayName } : c))
        );
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
        const result = await runWithCaptcha("poll_manage", (token) =>
          createPoll(
            event.id,
            question,
            opts,
            newPollMultiChoice,
            newPollAllowGuestsToAdd,
            newPollHideVoters,
            token
          )
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
        await runWithCaptcha("poll_manage", (token) => updatePollSettings(pollId, settings, token));
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
        const result = await runWithCaptcha("poll_option", (token) =>
          addPollOption(pollId, optionText, "Host", undefined, token)
        );
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
        const result = await runWithCaptcha("potluck_manage", (token) =>
          addPotluckItem(event.id, label, qty, token)
        );
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
        const result = await runWithCaptcha("rsvp_field", (token) =>
          addRsvpField(
            event.id,
            {
              label: newFieldLabel.trim(),
              fieldType: newFieldType,
              required: newFieldRequired,
              options: serialized,
              order: fields.length,
            },
            token
          )
        );
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
        await runWithCaptcha("rsvp_field", (token) =>
          updateRsvpField(fieldId, { fieldType }, token)
        );
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
        await runWithCaptcha("rsvp_field", (token) =>
          updateRsvpField(fieldId, { required }, token)
        );
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
        await runWithCaptcha("rsvp_field", (token) => updateRsvpField(fieldId, { label }, token));
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
        await runWithCaptcha("rsvp_field", (token) => updateRsvpField(fieldId, { options }, token));
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
  const t = resolveTheme(base, gradientFrom, gradientTo, accent, cardOpacity, fontId);

  const activeEffect = useMemo(
    () => resolveEffectConfig(effectStateToFields(effect), Object.values(libraryIcons)),
    [effect, libraryIcons]
  );

  const S = buildStyles(t);

  return (
    <div style={S.page}>
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
      <EventAtmosphere theme={t} effect={activeEffect} />

      {/* ── Global nav ── */}

      {/* ── Settings sub-nav ── */}
      <div style={S.header}>
        <Button
          theme={t}
          variant="icon"
          aria-label={common("back")}
          onClick={() => {
            if (activeSection) {
              closeSection();
            } else {
              window.location.href = `/e/${event.slug}`;
            }
          }}
        >
          <ArrowLeft size={20} aria-hidden="true" />
        </Button>
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
              <Button theme={t} variant="link" type="button" onClick={closeSection}>
                {translate("settings")}
              </Button>
              <span style={{ opacity: 0.4 }}>/</span>
              <span>
                {activeSection === "theme" && translate("theme")}
                {activeSection === "hosts" && translate("hosts")}
                {activeSection === "rsvp" && translate("rsvpOptions")}
                {activeSection === "questionnaire" && translate("questionnaire")}
                {activeSection === "polls" && translate("polls")}
                {activeSection === "potluck" && translate("potluck")}
                {activeSection === "privacy" && translate("displayOptions")}
                {activeSection === "reminders" && translate("autoReminders")}
                {activeSection === "emails" && translate("emails")}
              </span>
            </div>
          ) : (
            translate("eventSettings")
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
            {translate("saving")}
          </div>
        )}
      </div>

      {/* Floating toast notification for settings save status */}
      <Toast
        theme={t}
        toast={
          saveStatus === "SAVED"
            ? { tone: "success", message: translate("changesSaved") }
            : saveStatus === "ERROR"
              ? { tone: "error", message: translate("errorSavingChanges") }
              : null
        }
      />

      <div style={S.container}>
        {activeSection === null && (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <SettingsMenu
              isOwner={isOwner}
              openSection={openSection}
              t={t}
              emailEnabled={channelConfig.email}
            />
            {isOwner && <DangerZonePanel eventId={event.id} t={t} />}
          </div>
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
            fontId={fontId}
            setFontId={setFontId}
            effect={effect}
            setEffect={setEffect}
            libraryIcons={libraryIcons}
            rememberLibraryIcons={rememberLibraryIcons}
            triggerSaveTheme={triggerSaveTheme}
            t={t}
          />
        )}

        {/* ── Hosts ── */}
        {activeSection === "hosts" && (
          <HostsPanel
            event={event}
            coHosts={coHosts}
            cohostEmail={cohostEmail}
            setCohostEmail={setCohostEmail}
            cohostError={cohostError}
            handleAddCohost={handleAddCohost}
            handleRemoveCohost={handleRemoveCohost}
            hostDisplayName={hostDisplayName}
            setHostDisplayName={setHostDisplayName}
            triggerSaveSettings={triggerSaveSettings}
            handleUpdateCohostDisplayName={handleUpdateCohostDisplayName}
            isPending={isPending}
            t={t}
            S={S}
            pendingInvitations={pendingInvitations}
            handleCancelInvitation={handleCancelInvitation}
            isOwner={isOwner}
            sessionUser={sessionUser}
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
            allowEditAfterDeadline={allowEditAfterDeadline}
            setAllowEditAfterDeadline={setAllowEditAfterDeadline}
            hostAlertEmail={hostAlertEmail}
            setHostAlertEmail={setHostAlertEmail}
            hostAlertSms={hostAlertSms}
            setHostAlertSms={setHostAlertSms}
            channelConfig={channelConfig}
            triggerSaveSettings={triggerSaveSettings}
            eventId={event.id}
            onNotificationStatus={reportNotificationStatus}
            t={t}
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
            guestRsvpDisplay={guestRsvpDisplay}
            onGuestRsvpDisplayChange={(update) => {
              setGuestRsvpDisplay((previous) => ({ ...previous, ...update }));
              triggerSaveSettings(update);
            }}
            visibility={visibility}
            setVisibility={setVisibility}
            guestsCanInvite={guestsCanInvite}
            setGuestsCanInvite={setGuestsCanInvite}
            password={password}
            setPassword={setPassword}
            passwordDirty={passwordDirty}
            setPasswordDirty={setPasswordDirty}
            setPasswordSavedAsNull={setPasswordSavedAsNull}
            effectivePasswordHash={effectivePasswordHash}
            triggerSaveSettings={triggerSaveSettings}
            t={t}
          />
        )}

        {/* ── Auto-Reminders ── */}
        {activeSection === "reminders" && (
          <ReminderSchedule eventId={event.id} theme={t} onStatus={reportNotificationStatus} />
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
          />
        )}

        {err && (
          <InlineAlert theme={t} style={{ marginTop: "16px" }}>
            {err}
          </InlineAlert>
        )}
      </div>
    </div>
  );
}
