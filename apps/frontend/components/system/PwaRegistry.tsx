'use client';

import { useEffect } from 'react';

export default function PwaRegistry() {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Register service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => console.log('[PWA] Service Worker registered:', reg.scope))
        .catch((err) => console.error('[PWA] Service Worker registration failed:', err));
    }

    // Capture beforeinstallprompt GLOBALLY so it's never missed.
    // InstallPrompt lives inside the authenticated dashboard and mounts late —
    // by then the event has already fired. We store it on window so any component
    // can pick it up at any point.
    const handler = (e: Event) => {
      e.preventDefault();
      console.log('[PWA] beforeinstallprompt captured globally');
      (window as any).__pwaInstallPrompt = e;
      // Also dispatch a custom event so InstallPrompt can react if it's already mounted
      window.dispatchEvent(new Event('pwa-install-ready'));
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  return null;
}
