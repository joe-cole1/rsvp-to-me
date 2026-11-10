// CSSOM may serialize a numeric ratio as "1.77778 / 1" or as "16 / 9".
// Compare its value, including the denominator, rather than its formatting.
export function aspectRatio(value: string): number {
  const parts = value.trim().split("/");
  const numerator = Number(parts[0]);
  const denominator = parts.length === 2 ? Number(parts[1]) : 1;
  if (
    parts.length > 2 ||
    !Number.isFinite(numerator) ||
    !Number.isFinite(denominator) ||
    numerator <= 0 ||
    denominator <= 0
  ) {
    throw new Error(`Expected a positive numeric CSS aspect ratio; received ${value}`);
  }
  return numerator / denominator;
}

// Normalize declarations through the same CSS parser without resolving rem or
// viewport units into pixels. Their responsive units are part of the contract.
export function cssValue(property: string, value: string, ownerDocument: Document): string {
  const style = ownerDocument.createElement("div").style;
  style.setProperty(property, value);
  const normalized = style.getPropertyValue(property);
  if (!normalized) throw new Error(`Invalid expected CSS declaration: ${property}: ${value}`);
  return normalized;
}
