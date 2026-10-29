export const WALKTHROUGH_START_EVENT = 'hf-walkthrough:start'
export const WALKTHROUGH_SEEN_PREFIX = 'hf-walkthrough-seen:'

export type WalkthroughStorage = Pick<Storage, 'getItem' | 'setItem'>

export function walkthroughSeenKey(userId: string): string {
  return `${WALKTHROUGH_SEEN_PREFIX}${userId}`
}

export function hasSeenWalkthrough(
  storage: WalkthroughStorage | null,
  userId: string | null | undefined
): boolean {
  if (!storage || !userId) return false
  try {
    return storage.getItem(walkthroughSeenKey(userId)) === 'true'
  } catch {
    return false
  }
}

export function markWalkthroughSeen(
  storage: WalkthroughStorage | null,
  userId: string | null | undefined
): void {
  if (!storage || !userId) return
  try {
    storage.setItem(walkthroughSeenKey(userId), 'true')
  } catch {
    // Storage can be unavailable (private mode); the in-memory state still
    // prevents a repeat during this session.
  }
}

export function requestWalkthroughReplay(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(WALKTHROUGH_START_EVENT))
}
