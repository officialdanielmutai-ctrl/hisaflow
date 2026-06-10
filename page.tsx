'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@clerk/nextjs'
import { apiPost } from '@/lib/api-client'

export default function OnboardingPage() {
  const [businessName, setBusinessName] = useState('')
  const [businessType, setBusinessType] = useState('DUKA')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { getToken } = useAuth()
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const token = await getToken()
      if (!token) throw new Error('Not authenticated')
      await apiPost('/organizations', token, 'onboarding', {
        name: businessName,
        businessType,
      })
      router.push('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create organization')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--color-bg-base)] p-4">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold text-[var(--color-text-primary)] mb-2">
          Set up your business
        </h1>
        <p className="text-sm text-[var(--color-text-secondary)] mb-6">
          Tell us about your business to get started.
        </p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="text-sm font-medium text-[var(--color-text-primary)] block mb-1">
              Business name
            </label>
            <input
              type="text"
              value={businessName}
              onChange={e => setBusinessName(e.target.value)}
              required
              placeholder="e.g. Mama Njeri Duka"
              className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] px-4 py-3 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-[var(--color-text-primary)] block mb-1">
              Business type
            </label>
            <select
              value={businessType}
              onChange={e => setBusinessType(e.target.value)}
              className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] px-4 py-3 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
            >
              <option value="DUKA">Duka</option>
              <option value="MINI_MART">Mini Mart</option>
              <option value="CHEMIST">Chemist</option>
              <option value="RESTAURANT">Restaurant</option>
              <option value="SCHOOL">School</option>
              <option value="WHOLESALER">Wholesaler</option>
            </select>
          </div>
          {error && (
            <p className="text-sm text-[var(--color-status-critical)]">{error}</p>
          )}
          <button
            type="submit"
            disabled={loading || !businessName.trim()}
            className="w-full rounded-xl bg-[var(--color-accent)] px-4 py-3 text-sm font-semibold text-white disabled:opacity-50 hover:bg-[var(--color-accent-hover)] transition-colors"
          >
            {loading ? 'Setting up...' : 'Get started'}
          </button>
        </form>
      </div>
    </main>
  )
}
