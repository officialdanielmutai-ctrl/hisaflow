import { describe, expect, it } from 'vitest'
import {
  businessMonogram,
  emailDomain,
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
