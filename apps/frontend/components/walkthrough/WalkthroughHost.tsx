'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useUser } from '@clerk/nextjs'
import { usePathname } from 'next/navigation'
import { useMyOrganization } from '@/hooks/useMyOrganization'
import { useRole } from '@/hooks/useRole'
import {
  WALKTHROUGH_START_EVENT,
  hasSeenWalkthrough,
  markWalkthroughSeen,
} from '@/lib/walkthrough'
import {
  FeatureWalkthrough,
  buildWalkthroughSteps,
} from './FeatureWalkthrough'

function browserStorage(): Storage | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage
  } catch {
    return null
  }
}

/**
 * Auto-starts the feature tour once per user on their first dashboard visit.
 * Skip and completion both persist the seen flag. Settings dispatches
 * `WALKTHROUGH_START_EVENT` to replay it at any time.
 */
export function WalkthroughHost() {
  const { user, isLoaded } = useUser()
  const { loading } = useMyOrganization()
  const { businessType } = useRole()
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const autoChecked = useRef(false)
  const userId = user?.id ?? null
  const steps = useMemo(
    () => buildWalkthroughSteps(businessType),
    [businessType]
  )

  useEffect(() => {
    if (!isLoaded || loading || autoChecked.current || !userId) return
    if (pathname !== '/dashboard') return

    autoChecked.current = true
    const storage = browserStorage()
    if (hasSeenWalkthrough(storage, userId)) return

    const timer = window.setTimeout(() => {
      // Mark as seen as soon as it auto-opens: refreshing without interacting
      // must not replay the tour in a later session.
      markWalkthroughSeen(storage, userId)
      setOpen(true)
    }, 900)
    return () => window.clearTimeout(timer)
  }, [isLoaded, loading, pathname, userId])

  useEffect(() => {
    const replay = () => setOpen(true)
    window.addEventListener(WALKTHROUGH_START_EVENT, replay)
    return () => window.removeEventListener(WALKTHROUGH_START_EVENT, replay)
  }, [])

  const finish = useCallback(() => {
    markWalkthroughSeen(browserStorage(), userId)
    setOpen(false)
  }, [userId])

  return (
    <FeatureWalkthrough
      open={open}
      steps={steps}
      onSkip={finish}
      onComplete={finish}
    />
  )
}
