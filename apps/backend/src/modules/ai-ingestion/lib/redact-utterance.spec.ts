import { redactUtterance } from './redact-utterance';

describe('redactUtterance', () => {
  it('removes emails, phone numbers and long identifiers', () => {
    const redacted = redactUtterance(
      'Sold 2 unga to John at john@example.com or 0712345678, ID 12345678',
    );
    expect(redacted).toBe(
      'Sold 2 unga to John at [email] or [phone], ID [number]',
    );
  });

  it('keeps ordinary quantities and grouped amounts', () => {
    expect(redactUtterance('sold 3 unga for KES 1,200')).toBe(
      'sold 3 unga for KES 1,200',
    );
  });

  it('removes URLs and international numbers', () => {
    expect(redactUtterance('see https://x.co/a call +254 712 345 678')).toBe(
      'see [url] call [phone]',
    );
  });

  it('collapses whitespace', () => {
    expect(redactUtterance('  sold   2   unga  ')).toBe('sold 2 unga');
  });
});
