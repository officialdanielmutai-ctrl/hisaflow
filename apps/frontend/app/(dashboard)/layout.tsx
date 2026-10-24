import BottomNav from '@/components/layout/BottomNav'
import TopBar from '@/components/layout/TopBar'
import DesktopSidebar from '@/components/layout/DesktopSidebar'
import ImpersonationBanner from '@/components/layout/ImpersonationBanner'
import OrgGate from '@/components/system/OrgGate'
import NotificationPrompt from '@/components/system/NotificationPrompt'
import InstallPrompt from '@/components/system/InstallPrompt'
import BillingStatusBanner from '@/components/paywall/BillingStatusBanner'
import { OrganizationProvider } from '@/hooks/useMyOrganization'
import { WorkspaceProvider } from '@/hooks/useWorkspace'
import { WorkspaceBackdrop } from '@/components/workspace/WorkspaceBackdrop'
import SWRProvider from '@/components/system/SWRProvider'
import { DateRangeProvider } from '@/components/providers/DateRangeProvider'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <OrganizationProvider>
      <SWRProvider>
        <DateRangeProvider>
          <WorkspaceProvider>
            <ImpersonationBanner />
            <div
              data-hf-app
              className="min-h-screen bg-[var(--color-bg-base)] flex flex-col lg:pl-16 transition-[padding] duration-200"
            >
              <DesktopSidebar />
              <TopBar />
              <main className="w-full max-w-lg lg:max-w-none mx-auto lg:mx-0 px-4 sm:px-6 lg:px-8 2xl:px-10 pt-20 lg:pt-22 pb-20 lg:pb-10 flex-1">
                <WorkspaceBackdrop>
                  <BillingStatusBanner />
                  <OrgGate>{children}</OrgGate>
                </WorkspaceBackdrop>
              </main>
              <BottomNav />
              <NotificationPrompt />
              <InstallPrompt />
            </div>
          </WorkspaceProvider>
        </DateRangeProvider>
      </SWRProvider>
    </OrganizationProvider>
  )
}
