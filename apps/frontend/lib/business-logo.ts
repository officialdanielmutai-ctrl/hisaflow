/**
 * Business-logo helpers. The signed-in shell prefers an explicit override,
 * then the logo published for the user's email domain, then a monogram.
 */

const PUBLIC_EMAIL_DOMAINS = new Set([
  'gmail.com',
  'googlemail.com',
  'yahoo.com',
  'yahoo.co.uk',
  'outlook.com',
  'hotmail.com',
  'live.com',
  'icloud.com',
  'me.com',
  'aol.com',
  'proton.me',
  'protonmail.com',
])

export function emailDomain(email: string | null | undefined): string | null {
  const value = email?.trim().toLowerCase()
  if (!value) return null
  const at = value.lastIndexOf('@')
  if (at < 1 || at === value.length - 1) return null
  const domain = value.slice(at + 1)
  return domain.includes('.') ? domain : null
}

export function resolveBusinessLogoSrc(
  logoUrl: string | null | undefined,
  email: string | null | undefined
): string | null {
  const override = logoUrl?.trim()
  if (override && /^https?:\/\//i.test(override)) return override

  const domain = emailDomain(email)
  if (!domain || PUBLIC_EMAIL_DOMAINS.has(domain)) return null

  return `https://www.google.com/s2/favicons?sz=128&domain=${encodeURIComponent(
    domain
  )}`
}

export function businessMonogram(name: string | null | undefined): string {
  const words = (name ?? '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)

  if (words.length === 0) return 'HF'

  const initials = words
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
  return (initials || words[0].slice(0, 2)).toUpperCase()
}
