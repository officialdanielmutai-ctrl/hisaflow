import './globals.css'
import { Inter } from 'next/font/google'
import type { Metadata } from 'next'
import { ClerkProvider } from '@clerk/nextjs'

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' })

export const metadata: Metadata = {
  title: 'HisaFlow',
  description: 'Intelligent Inventory and Financial Management',
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
    shortcut: '/icons/icon-192.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'HisaFlow',
  },
  other: {
    'mobile-web-app-capable': 'yes',
    'msapplication-TileImage': '/icons/icon-192.png',
    'msapplication-TileColor': '#1F7A5A',
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
