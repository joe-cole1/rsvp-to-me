// ── Helpers ────────────────────────────────────────────────────────────────────

export const formatOptionsForTextarea = (optionsStr: string | null): string => {
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

export const serializeOptionsForDb = (optionsStr: string): string => {
  const list = optionsStr
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  return JSON.stringify(list);
};
