import { describe, expect, it } from 'vitest'
import {
  BUSINESS_LOGO_MAX_DATA_URL_LENGTH,
  BUSINESS_LOGO_MAX_FILE_BYTES,
  businessMonogram,
  emailDomain,
  fileToBusinessLogoDataUrl,
  isBusinessLogoDataUrl,
  resolveBusinessLogoSrc,
} from './business-logo'

describe('business logo helpers', () => {
  it('prefers a valid explicit logo URL', () => {
    expect(
      resolveBusinessLogoSrc(
        'https://cdn.example.com/logo.png',
        'owner@acme.co.ke'
      )
    ).toBe('https://cdn.example.com/logo.png')
  })

  it('accepts a persisted image data URL as the logo override', () => {
    const dataUrl = 'data:image/webp;base64,AAAA'

    expect(isBusinessLogoDataUrl(dataUrl)).toBe(true)
    expect(resolveBusinessLogoSrc(dataUrl, 'owner@acme.co.ke')).toBe(dataUrl)
    expect(
      resolveBusinessLogoSrc(
        `data:image/png;base64,${'A'.repeat(
          BUSINESS_LOGO_MAX_DATA_URL_LENGTH
        )}`,
        'owner@acme.co.ke'
      )
    ).toBe(
      'https://www.google.com/s2/favicons?sz=128&domain=acme.co.ke'
    )
  })

  it('rejects non-image data URLs', () => {
    expect(isBusinessLogoDataUrl('data:text/html;base64,AAAA')).toBe(false)
    expect(isBusinessLogoDataUrl('data:image/svg+xml;base64,AAAA')).toBe(false)
    expect(isBusinessLogoDataUrl('javascript:alert(1)')).toBe(false)
  })

  it('validates device files before reading them', async () => {
    await expect(
      fileToBusinessLogoDataUrl({
        type: 'text/plain',
        size: 10,
      } as unknown as File)
    ).rejects.toThrow('Choose a PNG, JPG, or WebP image.')

    await expect(
      fileToBusinessLogoDataUrl({
        type: 'image/png',
        size: BUSINESS_LOGO_MAX_FILE_BYTES + 1,
      } as unknown as File)
    ).rejects.toThrow('Choose an image smaller than 5 MB.')
  })

  it('uses the email domain logo for business addresses', () => {
    expect(resolveBusinessLogoSrc(null, 'owner@acmekenya.co.ke')).toBe(
      'https://www.google.com/s2/favicons?sz=128&domain=acmekenya.co.ke'
    )
  })

  it('does not leak public email providers to the favicon service', () => {
    expect(resolveBusinessLogoSrc(null, 'owner@gmail.com')).toBeNull()
    expect(resolveBusinessLogoSrc(null, 'owner@outlook.com')).toBeNull()
  })

  it('extracts domains and rejects malformed emails', () => {
    expect(emailDomain(' Owner@Acme.co.ke ')).toBe('acme.co.ke')
    expect(emailDomain('nope')).toBeNull()
    expect(emailDomain('a@localhost')).toBeNull()
    expect(emailDomain(null)).toBeNull()
  })

  it('builds readable monograms', () => {
    expect(businessMonogram('Acacia Guest House')).toBe('AG')
    expect(businessMonogram('Mama Njeri Duka')).toBe('MN')
    expect(businessMonogram('  ')).toBe('HF')
    expect(businessMonogram('@')).toBe('HF')
  })
})
