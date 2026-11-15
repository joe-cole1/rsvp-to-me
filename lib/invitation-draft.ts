import { normalizePhone } from "./phone";
/** Pure invitation syntax shared by the draft editor and server validation. */
export interface InvitationRecipient {
  contact: string;
  name?: string;
}

export interface InvitationDraftEntry extends InvitationRecipient {
  /** UTF-16 offsets into the original text, including surrounding whitespace. */
  start: number;
  end: number;
}

export type InvitationDraftIssueCode =
  | "textTooLong"
  | "tooManyRecipients"
  | "unmatchedQuote"
  | "invalidName"
  | "invalidContact"
  | "invalidMailbox"
  | "missingDelimiter";

export interface InvitationDraftIssue {
  code: InvitationDraftIssueCode;
  start: number;
  end: number;
  /** A replacement for this issue's complete [start, end) range; never auto-applied. */
  suggestedReplacement?: string;
}

export interface InvitationDraft {
  entries: InvitationDraftEntry[];
  issues: InvitationDraftIssue[];
  /** Nonempty source tokens, including invalid and duplicate tokens. */
  rawCount: number;
}

export const MAX_INVITATION_TEXT = 100_000;
export const MAX_INVITATION_RECIPIENTS = 200;

const CONTROL = /[\u0000-\u001f\u007f-\u009f]/;
const EMAIL = /^[^\s@<>(),;:"\\]+@[^\s@<>(),;:"\\]+\.[^\s@<>(),;:"\\]+$/;

/** Shared contact identity without importing server dependencies. */
export function normalizeInvitationContact(value: string): string | null {
  const contact = value.trim();
  if (CONTROL.test(contact)) return null;
  if (contact.includes("@")) {
    return contact.length <= 254 && EMAIL.test(contact) ? contact.toLowerCase() : null;
  }
  if (contact.length > 40 || !/^\+?[0-9\s().-]+$/.test(contact)) return null;
  const normalized = normalizePhone(contact);
  return /^\+?\d{7,40}$/.test(normalized) ? normalized : null;
}

/** Null means invalid; email case and phone punctuation never create new identities. */
export function invitationContactKey(value: string): string | null {
  return normalizeInvitationContact(value);
}

export function isValidInvitationName(name: string): boolean {
  return name.trim().length > 0 && name.trim().length <= 100 && !CONTROL.test(name);
}

/** Always quotes names, making commas, angle brackets, and quotes unambiguous. */
export function formatInvitationRecipient(recipient: InvitationRecipient): string {
  const contact = normalizeInvitationContact(recipient.contact);
  if (!contact) throw new Error("Invalid invitation contact");
  if (recipient.name === undefined) return contact;
  if (!isValidInvitationName(recipient.name)) throw new Error("Invalid invitation name");
  const name = recipient.name.trim().replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return `"${name}" <${contact}>`;
}

function decodeName(source: string): string | null {
  if (!source.startsWith('"')) return source.includes('"') ? null : source;
  let name = "";
  for (let i = 1; i < source.length; i++) {
    const char = source[i];
    if (char === "\\") {
      const next = source[++i];
      if (next !== '"' && next !== "\\") return null;
      name += next;
    } else if (char === '"') {
      if (source[i + 1] === '"') {
        name += '"';
        i++;
      } else {
        return i === source.length - 1 ? name : null;
      }
    } else name += char;
  }
  return null;
}

/** Candidate boundaries only; every piece is still independently validated. */
function splitMailboxCandidates(token: string): string[] {
  const pieces: string[] = [];
  let start = 0;
  let quoted = false;
  let opened = false;
  for (let i = 0; i < token.length; i++) {
    const char = token[i];
    if (quoted && char === "\\") {
      i++;
      continue;
    }
    if (char === '"') {
      if (quoted && token[i + 1] === '"') {
        i++;
        continue;
      }
      quoted = !quoted;
      continue;
    }
    if (quoted) continue;
    if (char === "<") opened = true;
    if (char === ">" && opened) {
      opened = false;
      const end = i + 1;
      while (i + 1 < token.length && /\s/.test(token[i + 1])) i++;
      if (i + 1 > end && i + 1 < token.length) {
        pieces.push(token.slice(start, end));
        start = i + 1;
      }
    }
  }
  pieces.push(token.slice(start));
  return pieces;
}

function parseToken(
  raw: string,
  start: number,
  end: number
): {
  entry?: InvitationDraftEntry;
  issue?: InvitationDraftIssue;
} {
  const token = raw.trim();
  const issue = (code: InvitationDraftIssueCode, suggestedReplacement?: string) => ({
    issue: {
      code,
      start,
      end,
      ...(suggestedReplacement === undefined ? {} : { suggestedReplacement }),
    },
  });
  // Only suggest a delimiter when every whitespace-separated piece is a valid email.
  const pieces = token.split(/\s+/);
  if (
    pieces.length > 1 &&
    pieces.every((part) => part.includes("@") && normalizeInvitationContact(part))
  ) {
    return issue("missingDelimiter", pieces.join(", "));
  }
  const mailboxes = splitMailboxCandidates(token);
  if (mailboxes.length > 1 && mailboxes.every((part) => parseToken(part, 0, part.length).entry)) {
    return issue("missingDelimiter", mailboxes.join(", "));
  }
  let quoted = false;
  let opening = -1;
  let closing = -1;
  let malformedAngles = false;
  for (let i = 0; i < token.length; i++) {
    const char = token[i];
    if (quoted && char === "\\") {
      i++;
      continue;
    }
    if (char === '"') {
      if (quoted && token[i + 1] === '"') {
        i++;
        continue;
      }
      quoted = !quoted;
    } else if (!quoted && char === "<") {
      if (opening !== -1 || closing !== -1) malformedAngles = true;
      opening = i;
    } else if (!quoted && char === ">") {
      if (opening === -1 || closing !== -1) malformedAngles = true;
      closing = i;
    }
  }
  if (quoted) {
    const angle = token.lastIndexOf("<");
    const suggested =
      token.startsWith('"') &&
      angle > 1 &&
      token.indexOf("<") === angle &&
      token.indexOf(">") === token.length - 1 &&
      token.endsWith(">") &&
      normalizeInvitationContact(token.slice(angle + 1, -1))
        ? token.slice(0, angle).trimEnd() + '" ' + token.slice(angle)
        : undefined;
    return issue("unmatchedQuote", suggested);
  }
  if (malformedAngles) return issue("invalidMailbox");
  let name: string | undefined;
  let contactSource = token;
  if (opening !== -1 || closing !== -1) {
    if (opening > 0 && closing === -1 && normalizeInvitationContact(token.slice(opening + 1))) {
      return issue("invalidMailbox", token + ">");
    }
    if (opening <= 0 || closing !== token.length - 1) return issue("invalidMailbox");
    const decoded = decodeName(token.slice(0, opening).trim());
    if (decoded === null || !isValidInvitationName(decoded)) return issue("invalidName");
    name = decoded.trim();
    contactSource = token.slice(opening + 1, closing).trim();
  }
  const contact = normalizeInvitationContact(contactSource);
  if (!contact) return issue("invalidContact");
  return { entry: { contact, ...(name === undefined ? {} : { name }), start, end } };
}

export function parseInvitationDraft(text: string): InvitationDraft {
  if (text.length > MAX_INVITATION_TEXT) {
    return {
      entries: [],
      issues: [{ code: "textTooLong", start: 0, end: text.length }],
      rawCount: 0,
    };
  }
  const spans: { start: number; end: number }[] = [];
  let start = 0;
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted && char === "\\") {
      i++;
      continue;
    }
    if (char === '"') {
      if (quoted && text[i + 1] === '"') {
        i++;
        continue;
      }
      quoted = !quoted;
    }
    if (!quoted && (char === "," || char === "\n" || char === "\r")) {
      if (text.slice(start, i).trim()) spans.push({ start, end: i });
      start = i + 1;
    }
  }
  if (text.slice(start).trim()) spans.push({ start, end: text.length });
  if (spans.length > MAX_INVITATION_RECIPIENTS) {
    return {
      entries: [],
      issues: [{ code: "tooManyRecipients", start: 0, end: text.length }],
      rawCount: spans.length,
    };
  }
  const entries: InvitationDraftEntry[] = [];
  const issues: InvitationDraftIssue[] = [];
  for (const span of spans) {
    const parsed = parseToken(text.slice(span.start, span.end), span.start, span.end);
    if (parsed.entry) entries.push(parsed.entry);
    if (parsed.issue) issues.push(parsed.issue);
  }
  return { entries, issues, rawCount: spans.length };
}
