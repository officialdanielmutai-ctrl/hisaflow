import './globals.css'
import { Inter } from 'next/font/google'
import type { Metadata } from 'next'
import { ClerkProvider } from '@clerk/nextjs'

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' })

export const metadata: Metadata = {
  title: 'Hisaflow',
  description: 'Operational intelligence for East African businesses',
  manifest: '/manifest.json',
  themeColor: '#1F7A5A',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Hisaflow',
  },
  other: {
    'mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-status-bar-style': 'default',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ClerkProvider>
      <html lang="en" className={inter.variable}>
        <body>{children}</body>
      </html>
    </ClerkProvider>
  )
}
