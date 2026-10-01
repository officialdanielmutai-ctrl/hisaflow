import { OrganizationProvider } from '@/hooks/useMyOrganization';

export default function PaywallLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <OrganizationProvider>
      <div className="min-h-screen bg-[var(--color-bg-base)]">{children}</div>
    </OrganizationProvider>
  );
}
