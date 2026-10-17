/**
 * Barcode validation and scan-tuning helpers.
 *
 * The scanner used to wait for the same code in five consecutive frames before
 * looking it up, which made a successful scan feel slow. GTIN codes (EAN-8,
 * UPC-A, EAN-13, GTIN-14) carry a check digit, so a single read can be trusted
 * almost as much as five — we only need a short streak to rule out a misread.
 * Codes without a checksum (Code 128, QR payloads) keep a longer streak.
 */

/** Formats we ask the native BarcodeDetector for, intersected with support. */
export const BARCODE_FORMATS = [
  'qr_code',
  'ean_13',
  'ean_8',
  'upc_a',
  'upc_e',
  'code_128',
  'code_39',
  'itf',
] as const;

/** Repeated-frame requirement for codes we cannot checksum. */
export const UNCERTAIN_CONFIRMATIONS = 3;
/** Repeated-frame requirement for a checksum-valid GTIN. */
export const CHECKSUM_CONFIRMATIONS = 2;

/** How long to wait between detection attempts. */
export const DETECTION_INTERVAL_MS = 90;

/**
 * Upper bound for the camera stream we ask for. Phones happily hand back
 * 1920×1080 or larger when only an `ideal` is given; decoding that is slower
 * and hotter for no accuracy gain, so the stream is capped here.
 */
export const SCAN_STREAM_WIDTH = 1280;
export const SCAN_STREAM_HEIGHT = 720;

export const MIN_BARCODE_LENGTH = 6;

/**
 * Time to wait after a detection pass. The detector itself is asynchronous and
 * can take tens of milliseconds, so subtract that from the interval instead of
 * always sleeping the full delay on top of it.
 */
export function timeUntilNextDetection(elapsedMs: number): number {
  return Math.max(0, DETECTION_INTERVAL_MS - elapsedMs);
}

/**
 * Validates a numeric GTIN by its check digit. Accepts the payload *without*
 * a trailing check digit stripped, i.e. the full 8/12/13/14-digit code.
 */
export function hasValidGtinChecksum(digits: string): boolean {
  if (!/^\d{8}$|^\d{12}$|^\d{13}$|^\d{14}$/.test(digits)) return false;

  const check = Number(digits[digits.length - 1]);
  const body = digits.slice(0, -1);

  let sum = 0;
  for (let i = 0; i < body.length; i += 1) {
    const digit = Number(body[body.length - 1 - i]);
    sum += digit * (i % 2 === 0 ? 3 : 1);
  }

  return (10 - (sum % 10)) % 10 === check;
}

/** True when a raw decode is long enough and, if numeric, checksum-valid. */
export function isValidBarcode(raw: string): boolean {
  const code = raw.trim();
  if (code.length < MIN_BARCODE_LENGTH) return false;
  if (!/^\d+$/.test(code)) return true;
  if (/^\d{8}$|^\d{12}$|^\d{13}$|^\d{14}$/.test(code)) return hasValidGtinChecksum(code);
  return true;
}

/** Frames the same code must be seen in before it is accepted. */
export function requiredConfirmations(raw: string): number {
  const code = raw.trim();
  return hasValidGtinChecksum(code) ? CHECKSUM_CONFIRMATIONS : UNCERTAIN_CONFIRMATIONS;
}

/** The subset of `BARCODE_FORMATS` the browser's native detector supports. */
export function supportedNativeFormats(available: readonly string[]): string[] | undefined {
  const supported = BARCODE_FORMATS.filter((format) => available.includes(format));
  return supported.length > 0 ? supported : undefined;
}
