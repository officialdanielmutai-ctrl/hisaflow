import { createHash } from 'node:crypto';

/**
 * Stable cache key for an uploaded image. Two identical photos (a retry, a
 * double-tap, the same receipt re-scanned) hash to the same key, so the second
 * one is served from memory instead of paying a second vision-model call.
 */
export function hashImage(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

interface CacheEntry<V> {
  value: V;
  expiresAt: number;
}

/**
 * Tiny bounded TTL cache. Deliberately in-process and in-memory: OCR results
 * are only useful for a short window and only to the instance that produced
 * them, so a distributed cache would be over-engineering. Entries are evicted
 * on read once expired and LRU-style once `maxEntries` is exceeded, so a busy
 * instance can never grow without bound.
 */
export class TtlCache<V> {
  private readonly entries = new Map<string, CacheEntry<V>>();

  constructor(
    private readonly ttlMs: number,
    private readonly maxEntries: number,
    private readonly now: () => number = Date.now,
  ) {}

  get(key: string): V | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= this.now()) {
      this.entries.delete(key);
      return undefined;
    }
    // Refresh recency so hot keys survive eviction.
    this.entries.delete(key);
    this.entries.set(key, entry);
    return entry.value;
  }

  set(key: string, value: V): void {
    if (this.entries.has(key)) this.entries.delete(key);
    this.entries.set(key, { value, expiresAt: this.now() + this.ttlMs });
    while (this.entries.size > this.maxEntries) {
      const oldest = this.entries.keys().next().value;
      if (oldest === undefined) break;
      this.entries.delete(oldest);
    }
  }

  clear(): void {
    this.entries.clear();
  }

  get size(): number {
    return this.entries.size;
  }
}
