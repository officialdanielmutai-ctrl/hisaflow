import { hashImage, TtlCache } from './ocr-cache';

describe('ocr-cache', () => {
  describe('hashImage', () => {
    it('is deterministic for identical bytes', () => {
      const a = hashImage(Buffer.from('receipt-bytes'));
      const b = hashImage(Buffer.from('receipt-bytes'));
      expect(a).toBe(b);
      expect(a).toMatch(/^[0-9a-f]{64}$/);
    });

    it('differs for different bytes', () => {
      expect(hashImage(Buffer.from('one'))).not.toBe(hashImage(Buffer.from('two')));
    });
  });

  describe('TtlCache', () => {
    it('returns a stored value before it expires', () => {
      let now = 1000;
      const cache = new TtlCache<string>(500, 10, () => now);
      cache.set('k', 'v');
      now = 1400;
      expect(cache.get('k')).toBe('v');
    });

    it('expires a value once its TTL passes', () => {
      let now = 1000;
      const cache = new TtlCache<string>(500, 10, () => now);
      cache.set('k', 'v');
      now = 1600;
      expect(cache.get('k')).toBeUndefined();
      expect(cache.size).toBe(0);
    });

    it('evicts the least-recently-used entry beyond maxEntries', () => {
      const cache = new TtlCache<number>(10_000, 2);
      cache.set('a', 1);
      cache.set('b', 2);
      // Touch "a" so "b" becomes the least recently used.
      expect(cache.get('a')).toBe(1);
      cache.set('c', 3);
      expect(cache.get('b')).toBeUndefined();
      expect(cache.get('a')).toBe(1);
      expect(cache.get('c')).toBe(3);
    });

    it('clear empties every entry', () => {
      const cache = new TtlCache<number>(10_000, 5);
      cache.set('a', 1);
      cache.set('b', 2);
      cache.clear();
      expect(cache.size).toBe(0);
    });
  });
});
