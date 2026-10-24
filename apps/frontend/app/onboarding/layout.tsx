import { OrganizationProvider } from '@/hooks/useMyOrganization'

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <OrganizationProvider>
      <div data-hf-app>{children}</div>
    </OrganizationProvider>
  )
}
