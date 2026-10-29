import { describe, expect, it } from 'vitest'
import {
  WALKTHROUGH_SEEN_PREFIX,
  hasSeenWalkthrough,
  markWalkthroughSeen,
  walkthroughSeenKey,
} from './walkthrough'

function memoryStorage(): Storage {
  const values = new Map<string, string>()
  return {
    get length() {
      return values.size
    },
    clear: () => values.clear(),
    getItem: (key: string) => values.get(key) ?? null,
    key: (index: number) => [...values.keys()][index] ?? null,
    removeItem: (key: string) => values.delete(key),
    setItem: (key: string, value: string) => values.set(key, value),
  } as unknown as Storage
}

describe('walkthrough persistence', () => {
  it('keys the seen flag per user', () => {
    expect(walkthroughSeenKey('user_1')).toBe(
      `${WALKTHROUGH_SEEN_PREFIX}user_1`
    )
  })

  it('starts unseen and stays unseen until explicitly marked', () => {
    const storage = memoryStorage()
    expect(hasSeenWalkthrough(storage, 'user_1')).toBe(false)
    expect(hasSeenWalkthrough(storage, null)).toBe(false)

    markWalkthroughSeen(storage, 'user_1')
    expect(hasSeenWalkthrough(storage, 'user_1')).toBe(true)
    expect(hasSeenWalkthrough(storage, 'user_2')).toBe(false)
  })

  it('does not throw when storage is unavailable', () => {
    expect(hasSeenWalkthrough(null, 'user_1')).toBe(false)
    expect(() => markWalkthroughSeen(null, 'user_1')).not.toThrow()
  })
})
