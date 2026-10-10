/**
 * Best-effort redaction for assistant turn capture (overhaul Duty 2).
 *
 * Removes structured personal identifiers before an utterance is stored for
 * the golden set. It is intentionally conservative: it also removes any
 * standalone 7+ digit run (ID numbers, account numbers, unformatted long
 * values), which may cost some numeric signal but keeps the sample safe.
 *
 * Known limitation: free-text **names** are not reliably detectable with
 * regular expressions and are not removed here. Samples must be reviewed (or
 * run through a model-based redactor) before being promoted into the golden
 * set. This is recorded in the Phase A note.
 */
export const CAPTURE_CONSENT_VERSION = '2026-10-11-v1';

const URL = /\bhttps?:\/\/\S+/gi;
const EMAIL = /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g;
// Kenyan mobile formats (+2547…, 2547…, 07…, 01…) and generic international.
const KE_PHONE = /(?:\+?254|0)(?:7|1)\d{8}\b/g;
const INTL_PHONE = /\+\d[\d\s-]{7,}\d/g;
const LONG_DIGITS = /\b\d{7,}\b/g;

export function redactUtterance(text: string): string {
  return text
    .replace(URL, '[url]')
    .replace(EMAIL, '[email]')
    .replace(KE_PHONE, '[phone]')
    .replace(INTL_PHONE, '[phone]')
    .replace(LONG_DIGITS, '[number]')
    .replace(/\s+/g, ' ')
    .trim();
}
