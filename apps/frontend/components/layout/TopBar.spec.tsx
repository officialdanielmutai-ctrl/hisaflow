import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

vi.mock('@clerk/nextjs', () => ({
  UserButton: () => <div data-testid="user-button" />,
}))

vi.mock('@/hooks/useAlerts', () => ({
  useAlerts: () => ({ data: [] }),
}))

vi.mock('@/hooks/useLabelOcrCapture', () => ({
  OCR_DRAFT_STORAGE_KEY: 'ocr-draft',
}))

vi.mock('@/hooks/useReceiptOcrCapture', () => ({
  RECEIPT_DRAFT_STORAGE_KEY: 'receipt-draft',
  RECEIPT_DRAFT_EVENT: 'receipt-draft-event',
}))

vi.mock('./SideMenu', () => ({ default: () => null }))
vi.mock('./OrgSwitcher', () => ({ OrgSwitcher: () => null }))
vi.mock('../system/BarcodeScannerSheet', () => ({ default: () => null }))
vi.mock('../system/ScanModeSheet', () => ({ default: () => null }))
vi.mock('../system/LabelCaptureSheet', () => ({ default: () => null }))
vi.mock('../system/ReceiptCaptureSheet', () => ({ default: () => null }))

import TopBar from './TopBar'

describe('TopBar theme entry point', () => {
  it('links directly to the Appearance theme picker on mobile and desktop', () => {
    render(<TopBar />)

    const link = screen.getByRole('link', { name: 'Appearance and theme' })
    expect(link).toHaveAttribute('href', '/settings/appearance')
    expect(link).toHaveAttribute('title', 'Appearance & theme')
  })
})
