'use client'

import { useEffect, useState } from 'react'
import { useUser } from '@clerk/nextjs'
import { businessMonogram, resolveBusinessLogoSrc } from '@/lib/business-logo'
import { cn } from '@/lib/utils'

const SIZES = {
  sm: 'h-8 w-8 text-[11px]',
  md: 'h-10 w-10 text-sm',
  lg: 'h-12 w-12 text-base',
} as const

/**
 * The organisation's identity in the signed-in shell. An explicit logo URL
 * wins; otherwise a business email domain supplies the image; otherwise the
 * organisation's initials are shown. Image failures fall back to initials too.
 */
export function BusinessLogo({
  logoUrl,
  name,
  email,
  size = 'md',
  className,
}: {
  logoUrl?: string | null
  name?: string | null
  email?: string | null
  size?: keyof typeof SIZES
  className?: string
}) {
  const { user } = useUser()
  const resolvedEmail = email ?? user?.primaryEmailAddress?.emailAddress
  const src = resolveBusinessLogoSrc(logoUrl, resolvedEmail)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    setFailed(false)
  }, [src])

  const label = name?.trim() || 'Business'

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center overflow-hidden rounded-[var(--hf-radius-lg)] border border-[var(--hf-border-subtle)] bg-[var(--hf-accent-default)] font-black text-[var(--hf-accent-foreground)] shadow-[var(--hf-shadow-card)]',
        SIZES[size],
        className
      )}
      aria-label={`${label} logo`}
    >
      {src && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element -- remote, theme-independent business logos
        <img
          src={src}
          alt=""
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
          referrerPolicy="no-referrer"
        />
      ) : (
        <span aria-hidden="true">{businessMonogram(label)}</span>
      )}
    </span>
  )
}

export default BusinessLogo
