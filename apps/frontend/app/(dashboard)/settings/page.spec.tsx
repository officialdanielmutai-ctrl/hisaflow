import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'

const { state } = vi.hoisted(() => ({
  state: {
    isOwner: true,
    isManager: false,
    isIsp: true,
    businessType: 'ISP',
  },
}))

vi.mock('@clerk/nextjs', () => ({
  useAuth: () => ({ getToken: vi.fn() }),
}))

vi.mock('@/hooks/useMyOrganization', () => ({
  useMyOrganization: () => ({
    membership: {
      id: 'membership-1',
      role: 'OWNER',
      organization: {
        id: 'org-1',
        name: 'Hisaflow Test',
        businessType: state.businessType,
        currency: 'KES',
        country: 'KE',
        logoUrl: null,
      },
    },
  }),
}))

vi.mock('@/hooks/useRole', () => ({
  useRole: () => ({
    isOwner: state.isOwner,
    isManager: state.isManager,
    isIsp: state.isIsp,
    canManageStaff: state.isOwner || state.isManager,
  }),
}))

vi.mock('@/hooks/usePushNotifications', () => ({
  usePushNotifications: () => ({
    isSupported: true,
    subscription: null,
    subscribe: vi.fn(),
    isSubscribing: false,
    orgLoading: false,
    error: null,
  }),
}))

vi.mock('@/components/providers/ThemeProvider', () => ({
  useTheme: () => ({ preference: 'ivory', themeId: 'ivory' }),
}))

vi.mock('@hisaflow/theme', () => ({
  themeForId: () => ({ name: 'Ivory' }),
}))

vi.mock('@/components/settings/SettingsGroup', () => ({
  SettingsGroup: ({
    title,
    children,
  }: {
    title?: string
    children: ReactNode
  }) => <section aria-label={title}>{children}</section>,
}))

vi.mock('@/components/settings/SettingsRow', () => ({
  SettingsLinkRow: ({ title }: { title: string }) => <div>{title}</div>,
  SettingsActionRow: ({
    title,
    description,
  }: {
    title: string
    description?: string
  }) => (
    <div>
      {title} {description}
    </div>
  ),
}))

vi.mock('@/components/settings/StaffManagementCard', () => ({
  default: () => <div data-testid="staff-management-card" />,
}))

vi.mock('@/components/settings/RouterSettingsCard', () => ({
  default: () => <div data-testid="router-settings-card">MikroTik Routers</div>,
}))

vi.mock('@/components/settings/BusinessLogoCard', () => ({
  default: () => <div data-testid="business-logo-card" />,
}))

import SettingsPage from './page'

describe('Settings page vertical gating', () => {
  beforeEach(() => {
    state.isOwner = true
    state.isManager = false
    state.isIsp = true
    state.businessType = 'ISP'
  })

  it('shows MikroTik hardware settings and business logo for an ISP', () => {
    render(<SettingsPage />)

    expect(screen.getByTestId('router-settings-card')).toBeInTheDocument()
    expect(screen.getByText('Hardware')).toBeInTheDocument()
    expect(screen.getByTestId('business-logo-card')).toBeInTheDocument()
  })

  it('hides MikroTik hardware settings outside the ISP vertical', () => {
    state.isIsp = false
    state.businessType = 'DUKA'

    render(<SettingsPage />)

    expect(screen.queryByTestId('router-settings-card')).not.toBeInTheDocument()
    expect(screen.queryByText('Hardware')).not.toBeInTheDocument()
    expect(screen.getByTestId('business-logo-card')).toBeInTheDocument()
  })

  it('keeps branding and hardware owner/manager-only', () => {
    state.isOwner = false
    state.isManager = false

    render(<SettingsPage />)

    expect(screen.queryByTestId('business-logo-card')).not.toBeInTheDocument()
    expect(screen.queryByTestId('router-settings-card')).not.toBeInTheDocument()
  })
})
