/**
 * Business-logo helpers. The signed-in shell prefers an explicit override,
 * then the logo published for the user's email domain, then a monogram.
 */

export const BUSINESS_LOGO_ACCEPTED_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
] as const

/** Keep the stored data URL small enough for the API JSON body limit. */
export const BUSINESS_LOGO_MAX_DATA_URL_LENGTH = 80_000
export const BUSINESS_LOGO_MAX_FILE_BYTES = 5 * 1024 * 1024

const DATA_LOGO_RE = /^data:image\/(?:png|jpe?g|webp);base64,[a-z0-9+/]+={0,2}$/i

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

export function isBusinessLogoDataUrl(value: string | null | undefined) {
  const candidate = value?.trim() ?? ''
  return (
    candidate.length > 0 &&
    candidate.length <= BUSINESS_LOGO_MAX_DATA_URL_LENGTH &&
    DATA_LOGO_RE.test(candidate)
  )
}

export function resolveBusinessLogoSrc(
  logoUrl: string | null | undefined,
  email: string | null | undefined
): string | null {
  const override = logoUrl?.trim()
  if (
    override &&
    (/^https?:\/\//i.test(override) || isBusinessLogoDataUrl(override))
  ) {
    return override
  }

  const domain = emailDomain(email)
  if (!domain || PUBLIC_EMAIL_DOMAINS.has(domain)) return null

  return `https://www.google.com/s2/favicons?sz=128&domain=${encodeURIComponent(
    domain
  )}`
}

/**
 * Reads a device image, crops it to a square and downsizes it for the 48px
 * shell mark. We keep the result as a data URL so the existing branding API
 * can persist it without introducing a separate file-storage dependency.
 */
export async function fileToBusinessLogoDataUrl(file: File): Promise<string> {
  if (
    !BUSINESS_LOGO_ACCEPTED_TYPES.includes(
      file.type as (typeof BUSINESS_LOGO_ACCEPTED_TYPES)[number]
    )
  ) {
    throw new Error('Choose a PNG, JPG, or WebP image.')
  }
  if (file.size > BUSINESS_LOGO_MAX_FILE_BYTES) {
    throw new Error('Choose an image smaller than 5 MB.')
  }
  if (typeof document === 'undefined') {
    throw new Error('Image upload is not available here.')
  }

  const source = await readFileAsDataUrl(file)
  const image = await loadImage(source)
  const attempts = [
    { size: 256, quality: 0.82 },
    { size: 224, quality: 0.78 },
    { size: 192, quality: 0.72 },
    { size: 160, quality: 0.68 },
  ]

  for (const attempt of attempts) {
    const result = renderSquareLogo(image, attempt.size, attempt.quality)
    if (result.length <= BUSINESS_LOGO_MAX_DATA_URL_LENGTH) return result
  }

  throw new Error('That image is too detailed. Choose a simpler logo.')
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Could not read that image.'))
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result)
      else reject(new Error('Could not read that image.'))
    }
    reader.readAsDataURL(file)
  })
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onerror = () => reject(new Error('Could not read that image.'))
    image.onload = () => resolve(image)
    image.src = src
  })
}

function renderSquareLogo(
  image: HTMLImageElement,
  size: number,
  quality: number
): string {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const context = canvas.getContext('2d')
  if (!context) {
    throw new Error('Could not process the image on this device.')
  }

  const scale = Math.max(size / image.width, size / image.height)
  const width = image.width * scale
  const height = image.height * scale
  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'
  context.drawImage(
    image,
    (size - width) / 2,
    (size - height) / 2,
    width,
    height
  )
  return canvas.toDataURL('image/webp', quality)
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
