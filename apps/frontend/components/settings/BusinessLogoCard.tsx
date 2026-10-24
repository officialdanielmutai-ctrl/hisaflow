'use client'

import { useEffect, useState } from 'react'
import { useAuth, useUser } from '@clerk/nextjs'
import { useSWRConfig } from 'swr'
import { ImagePlus, Loader2, RotateCcw } from 'lucide-react'
import { useMyOrganization } from '@/hooks/useMyOrganization'
import { updateOrganizationBranding } from '@/services/organizations.service'
import { BusinessLogo } from '@/components/brand/BusinessLogo'

const ORG_MEMBERSHIPS_KEY = 'org-memberships'

export function BusinessLogoCard() {
  const { getToken } = useAuth()
  const { user } = useUser()
  const { membership } = useMyOrganization()
  const { mutate } = useSWRConfig()
  const org = membership?.organization
  const [logoUrl, setLogoUrl] = useState(org?.logoUrl ?? '')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLogoUrl(org?.logoUrl ?? '')
  }, [org?.id, org?.logoUrl])

  const save = async (nextValue: string | null) => {
    if (!org?.id) return
    setSaving(true)
    setError(null)
    setMessage(null)
    try {
      const token = await getToken()
      if (!token) throw new Error('Not authenticated')
      await updateOrganizationBranding(token, org.id, nextValue)
      await mutate(ORG_MEMBERSHIPS_KEY)
      setLogoUrl(nextValue ?? '')
      setMessage(
        nextValue ? 'Business logo updated.' : 'Using your email logo.'
      )
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not update the logo.'
      )
    } finally {
      setSaving(false)
    }
  }

  const email = user?.primaryEmailAddress?.emailAddress ?? null

  return (
    <div className="px-4 py-4">
      <div className="flex items-start gap-3">
        <BusinessLogo
          logoUrl={logoUrl}
          name={org?.name}
          email={email}
          size="lg"
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-[var(--color-text-primary)]">
            Business logo
          </p>
          <p className="mt-0.5 text-xs leading-snug text-[var(--color-text-secondary)]">
            Shown in the signed-in app shell. By default we use the logo from
            your email domain, or your business initials.
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <label className="sr-only" htmlFor="business-logo-url">
          Business logo image URL
        </label>
        <input
          id="business-logo-url"
          type="url"
          inputMode="url"
          value={logoUrl}
          onChange={(event) => setLogoUrl(event.target.value)}
          placeholder="https://example.com/logo.png"
          className="hf-control min-w-0 flex-1 px-3 text-sm"
        />
        <button
          type="button"
          onClick={() => void save(logoUrl.trim() || null)}
          disabled={saving}
          className="inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-[var(--hf-radius-md)] bg-[var(--hf-accent-default)] px-3 text-xs font-semibold text-[var(--hf-accent-foreground)] disabled:opacity-50"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ImagePlus className="h-4 w-4" />
          )}
          {saving ? 'Saving…' : 'Save logo'}
        </button>
        <button
          type="button"
          onClick={() => void save(null)}
          disabled={saving || !org?.logoUrl}
          className="inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-[var(--hf-radius-md)] border border-[var(--hf-border-subtle)] px-3 text-xs font-semibold text-[var(--hf-text-secondary)] disabled:opacity-50"
        >
          <RotateCcw className="h-4 w-4" />
          Use email logo
        </button>
      </div>

      {error && (
        <p
          role="alert"
          className="mt-2 text-xs font-medium text-[var(--hf-status-danger)]"
        >
          {error}
        </p>
      )}
      {message && !error && (
        <p
          aria-live="polite"
          className="mt-2 text-xs font-medium text-[var(--hf-status-success)]"
        >
          {message}
        </p>
      )}
    </div>
  )
}

export default BusinessLogoCard
