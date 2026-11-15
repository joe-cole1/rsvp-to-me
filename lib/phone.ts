/** Shared identity normalization: remove presentation punctuation, preserve country codes. */
export function normalizePhone(value: string): string {
  return value.trim().replace(/[\s().-]/g, "");
}

/**
 * Match Twilio's international sender to legacy North American invitation forms.
 * Never merge accounts or infer a country for other national numbers.
 */
export function smsPhoneVariants(sender: string): string[] {
  const phone = normalizePhone(sender);
  if (!/^\+[1-9]\d{6,14}$/.test(phone)) return [];
  const variants = [phone];
  if (/^\+1\d{10}$/.test(phone)) variants.push(phone.slice(1), phone.slice(2));
  return variants;
}

export function matchesSmsPhone(stored: string | null, sender: string): boolean {
  return stored !== null && smsPhoneVariants(sender).includes(normalizePhone(stored));
}
