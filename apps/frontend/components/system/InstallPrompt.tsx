'use client';

import { Download, Share2, X } from 'lucide-react';
import { useState, useEffect } from 'react';

type Platform = 'android' | 'ios' | 'desktop' | null;

function detectPlatform(): Platform {
  if (typeof navigator === 'undefined') return null;
  const ua = navigator.userAgent;
  if (/iphone|ipad|ipod/i.test(ua)) return 'ios';
  if (/android/i.test(ua)) return 'android';
  return 'desktop';
}

function isInStandaloneMode(): boolean {
  return (
    (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
    ('standalone' in window.navigator && (window.navigator as any).standalone === true)
  );
}

export default function InstallPrompt() {
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [platform, setPlatform] = useState<Platform>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  useEffect(() => {
    const p = detectPlatform();
    setPlatform(p);

    // Don't show if already installed
    if (isInStandaloneMode()) return;

    const dismissed = localStorage.getItem('hide-install-prompt');
    if (dismissed === 'true') return;

    // Android/Desktop: capture the browser's install event
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e);
      setIsVisible(true);
    };
    window.addEventListener('beforeinstallprompt', handler);

    // iOS: show manual guide since iOS doesn't fire beforeinstallprompt
    if (p === 'ios') {
      setIsVisible(true);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsVisible(false);
      setInstallPrompt(null);
    }
  };

  const handleDismiss = () => {
    localStorage.setItem('hide-install-prompt', 'true');
    setIsVisible(false);
    setShowIOSGuide(false);
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-36 left-4 right-4 z-40 max-w-sm mx-auto animate-in slide-in-from-bottom-5">
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-4 shadow-xl flex gap-4 items-start">
        <div className="rounded-full bg-emerald-100 p-2 text-emerald-600 mt-1 shrink-0">
          <Download className="h-5 w-5" />
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold mb-1">Install HisaFlow</h3>

          {platform === 'ios' ? (
            !showIOSGuide ? (
              <>
                <p className="text-xs text-[var(--color-text-secondary)] mb-3">
                  Add HisaFlow to your iPhone home screen for quick, full-screen access.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowIOSGuide(true)}
                    className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white"
                  >
                    <Share2 className="h-3.5 w-3.5" />
                    How to Install
                  </button>
                  <button onClick={handleDismiss} className="rounded-xl border border-[var(--color-border)] px-3 py-2 text-xs font-medium">
                    Later
                  </button>
                </div>
              </>
            ) : (
              <ol className="text-xs text-[var(--color-text-secondary)] space-y-2 mt-1">
                <li className="flex gap-2 items-start">
                  <span className="font-bold text-emerald-500 shrink-0">1.</span>
                  Tap the <strong>Share</strong> button <Share2 className="inline h-3 w-3 mb-0.5" /> at the bottom of Safari
                </li>
                <li className="flex gap-2 items-start">
                  <span className="font-bold text-emerald-500 shrink-0">2.</span>
                  Scroll down and tap <strong>"Add to Home Screen"</strong>
                </li>
                <li className="flex gap-2 items-start">
                  <span className="font-bold text-emerald-500 shrink-0">3.</span>
                  Tap <strong>"Add"</strong> in the top-right corner
                </li>
              </ol>
            )
          ) : (
            <>
              <p className="text-xs text-[var(--color-text-secondary)] mb-3">
                Add HisaFlow to your {platform === 'android' ? 'home screen' : 'desktop'} for a faster, app-like experience.
              </p>
              <div className="flex gap-2">
                {installPrompt ? (
                  <button
                    onClick={handleInstall}
                    className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Install App
                  </button>
                ) : (
                  <p className="text-xs text-[var(--color-text-secondary)] italic">
                    Use your browser's menu to install this app.
                  </p>
                )}
                <button onClick={handleDismiss} className="rounded-xl border border-[var(--color-border)] px-3 py-2 text-xs font-medium">
                  Later
                </button>
              </div>
            </>
          )}
        </div>

        <button onClick={handleDismiss} className="text-[var(--color-text-muted)] p-1 -m-1 shrink-0">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
