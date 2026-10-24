import { OrganizationProvider } from '@/hooks/useMyOrganization'

export default function PaywallLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <OrganizationProvider>
      <div data-hf-app className="min-h-screen bg-[var(--color-bg-base)]">
        {children}
      </div>
    </OrganizationProvider>
  )
}
