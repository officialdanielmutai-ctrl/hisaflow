import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

const { updateBranding, mutate, fileToDataUrl } = vi.hoisted(() => ({
  updateBranding: vi.fn(async () => ({ id: 'org-1', logoUrl: null })),
  mutate: vi.fn(async () => undefined),
  fileToDataUrl: vi.fn(async () => 'data:image/webp;base64,AAAA'),
}))

vi.mock('@clerk/nextjs', () => ({
  useAuth: () => ({ getToken: vi.fn(async () => 'token-1') }),
  useUser: () => ({
    user: { primaryEmailAddress: { emailAddress: 'owner@acme.co.ke' } },
  }),
}))

vi.mock('swr', () => ({
  useSWRConfig: () => ({ mutate }),
}))

vi.mock('@/hooks/useMyOrganization', () => ({
  useMyOrganization: () => ({
    membership: {
      organization: {
        id: 'org-1',
        name: 'Acme',
        logoUrl: null,
      },
    },
  }),
}))

vi.mock('@/services/organizations.service', () => ({
  updateOrganizationBranding: updateBranding,
}))

vi.mock('@/lib/business-logo', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/business-logo')>()
  return {
    ...actual,
    fileToBusinessLogoDataUrl: fileToDataUrl,
  }
})

vi.mock('@/components/brand/BusinessLogo', () => ({
  BusinessLogo: () => <div data-testid="business-logo-preview" />,
}))

import { BusinessLogoCard } from './BusinessLogoCard'

describe('BusinessLogoCard', () => {
  beforeEach(() => {
    updateBranding.mockClear()
    mutate.mockClear()
    fileToDataUrl.mockClear()
  })

  it('uploads a device image and persists the compressed data URL', async () => {
    render(<BusinessLogoCard />)

    const file = new File(['logo'], 'logo.png', { type: 'image/png' })
    fireEvent.change(screen.getByLabelText('Upload business logo image'), {
      target: { files: [file] },
    })

    await waitFor(() => {
      expect(fileToDataUrl).toHaveBeenCalledWith(file)
      expect(updateBranding).toHaveBeenCalledWith(
        'token-1',
        'org-1',
        'data:image/webp;base64,AAAA'
      )
      expect(mutate).toHaveBeenCalledWith('org-memberships')
    })
    expect(screen.getByText('Business logo updated.')).toBeInTheDocument()
  })

  it('still saves a pasted image URL', async () => {
    render(<BusinessLogoCard />)

    fireEvent.change(screen.getByLabelText('Business logo image URL'), {
      target: { value: 'https://cdn.example.com/logo.png' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save URL' }))

    await waitFor(() => {
      expect(updateBranding).toHaveBeenCalledWith(
        'token-1',
        'org-1',
        'https://cdn.example.com/logo.png'
      )
    })
  })
})
