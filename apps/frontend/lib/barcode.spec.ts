import { describe, it, expect } from 'vitest';
import {
  hasValidGtinChecksum,
  isValidBarcode,
  requiredConfirmations,
  supportedNativeFormats,
  CHECKSUM_CONFIRMATIONS,
  UNCERTAIN_CONFIRMATIONS,
} from './barcode';

describe('barcode validation', () => {
  it('accepts real GTIN check digits and rejects corrupted ones', () => {
    expect(hasValidGtinChecksum('4006381333931')).toBe(true); // EAN-13
    expect(hasValidGtinChecksum('96385074')).toBe(true); // EAN-8
    expect(hasValidGtinChecksum('036000291452')).toBe(true); // UPC-A
    expect(hasValidGtinChecksum('4006381333932')).toBe(false);
  });

  it('gates on length but lets non-numeric payloads through', () => {
    expect(isValidBarcode('123')).toBe(false);
    expect(isValidBarcode('4006381333931')).toBe(true);
    expect(isValidBarcode('4006381333932')).toBe(false);
    expect(isValidBarcode('ABC-123-XYZ')).toBe(true);
    expect(isValidBarcode('1234567890')).toBe(true);
  });

  it('requires fewer frames for a checksum-valid GTIN', () => {
    expect(requiredConfirmations('4006381333931')).toBe(CHECKSUM_CONFIRMATIONS);
    expect(requiredConfirmations('1234567890')).toBe(UNCERTAIN_CONFIRMATIONS);
    expect(requiredConfirmations('ABC-123-XYZ')).toBe(UNCERTAIN_CONFIRMATIONS);
  });

  it('intersects the requested formats with what the browser supports', () => {
    expect(supportedNativeFormats(['ean_13', 'qr_code'])).toEqual(['qr_code', 'ean_13']);
    expect(supportedNativeFormats(['unknown_format'])).toBeUndefined();
  });
});
