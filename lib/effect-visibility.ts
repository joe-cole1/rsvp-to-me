import { useSyncExternalStore } from "react";

const HIDE_EFFECTS_KEY = "rsvp:hide-effects";
const EFFECTS_VISIBILITY_EVENT = "rsvp:effects-visibility-change";
let inMemoryEffectsHidden = false;

function getSnapshot() {
  if (typeof window === "undefined") return false;

  try {
    const hidden = window.localStorage.getItem(HIDE_EFFECTS_KEY) === "1";
    inMemoryEffectsHidden = hidden;
    return hidden;
  } catch {
    return inMemoryEffectsHidden;
  }
}

function subscribe(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(EFFECTS_VISIBILITY_EVENT, onStoreChange);

  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(EFFECTS_VISIBILITY_EVENT, onStoreChange);
  };
}

export function useEffectsHidden() {
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}

export function setEffectsHidden(hidden: boolean) {
  inMemoryEffectsHidden = hidden;

  try {
    window.localStorage.setItem(HIDE_EFFECTS_KEY, hidden ? "1" : "0");
  } catch {
    // Storage can be unavailable in private browsing; keep this visit interactive.
  }

  window.dispatchEvent(new Event(EFFECTS_VISIBILITY_EVENT));
}
