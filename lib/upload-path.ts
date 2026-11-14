// Shared by server validation and defensive rendering of historical rows.
const UPLOAD_PATH =
  /^\/api\/uploads\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(?:jpg|png|gif|webp)$/i;
export function safeUploadPath(value: unknown): string | null {
  return typeof value === "string" && UPLOAD_PATH.test(value) ? value : null;
}
