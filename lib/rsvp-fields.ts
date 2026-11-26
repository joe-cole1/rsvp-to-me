/** Parse options configured on a SELECT or CHECKBOX questionnaire field. */
export function parseRsvpFieldOptions(optionsStr: string | null | undefined): string[] {
  if (!optionsStr) return [];
  try {
    const parsed = JSON.parse(optionsStr);
    if (Array.isArray(parsed)) {
      return parsed.map(String);
    }
  } catch {
    // Fall back to newline splitting
  }
  return optionsStr
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}
