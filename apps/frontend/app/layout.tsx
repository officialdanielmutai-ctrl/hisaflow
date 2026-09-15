import './globals.css'
import { Inter } from 'next/font/google'
import type { Metadata, Viewport } from 'next'
import { ClerkProvider } from '@clerk/nextjs'

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' })

export const metadata: Metadata = {
  title: 'HisaFlow',
  description: 'Intelligent Inventory and Financial Management',
  manifest: '/manifest.json?v=7',
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

export const viewport: Viewport = {
  themeColor: '#1F7A5A',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ClerkProvider>
      <html lang="en" className={inter.variable}>
        <head>
          {/* This runs SYNCHRONOUSLY before any React hydration.
              It captures beforeinstallprompt (which fires very early) and
              registers the service worker immediately — both stored globally
              so any component can use them at any time. */}
          <script
            dangerouslySetInnerHTML={{
              __html: `
                (function() {
                  // Capture install prompt as soon as it fires
                  window.addEventListener('beforeinstallprompt', function(e) {
                    e.preventDefault();
                    window.__pwaInstallPrompt = e;
                    window.dispatchEvent(new Event('pwa-install-ready'));
                    console.log('[PWA] beforeinstallprompt captured (inline script)');
                  });
                  // In development, ensure stale service worker and caches are flushed
                  if ('serviceWorker' in navigator) {
                    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
                      navigator.serviceWorker.getRegistrations().then(function(regs) {
                        for (var i = 0; i < regs.length; i++) {
                          regs[i].unregister();
                        }
                      });
                      if ('caches' in window) {
                        caches.keys().then(function(names) {
                          for (var i = 0; i < names.length; i++) {
                            caches.delete(names[i]);
                          }
                        });
                      }
                    } else {
                      window.addEventListener('load', function() {
                        navigator.serviceWorker.register('/sw.js').then(function(reg) {
                          console.log('[PWA] SW registered:', reg.scope);
                        }).catch(function(err) {
                          console.error('[PWA] SW registration failed:', err);
                        });
                      });
                    }
                  }
                })();
              `,
            }}
          />
        </head>
        <body>
          {children}
        </body>
      </html>
    </ClerkProvider>
  )
}
