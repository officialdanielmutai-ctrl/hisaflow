import { OrganizationProvider } from '@/hooks/useMyOrganization';

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <OrganizationProvider>{children}</OrganizationProvider>;
}
