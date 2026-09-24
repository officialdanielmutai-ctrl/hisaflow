import type { Metadata } from 'next';
import { ClerkProvider } from '@clerk/nextjs';
import { AdminShell } from '@/components/admin-shell';
import './globals.css';

export const metadata: Metadata = {
  title: 'HisaFlow Control Center — Internal Admin Panel',
  description: 'Enterprise operations, account control, and provider orchestration for HisaFlow.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      <html lang="en" className="dark">
        <body className="min-h-screen bg-slate-950 text-slate-100 font-sans">
          <AdminShell>{children}</AdminShell>
        </body>
      </html>
    </ClerkProvider>
  );
}
