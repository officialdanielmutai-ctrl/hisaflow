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

    if (isInStandaloneMode()) return;
    if (localStorage.getItem('hide-install-prompt') === 'true') return;

    // Check if the notification prompt has been dismissed (prerequisite)
    const notifDismissed = localStorage.getItem('hide-push-prompt') === 'true';

    const tryShow = () => {
      if (localStorage.getItem('hide-push-prompt') !== 'true') return; // wait for notification prompt first

      // Read the globally captured install prompt (set by PwaRegistry before auth)
      const globalPrompt = (window as any).__pwaInstallPrompt;
      if (globalPrompt) {
        setInstallPrompt(globalPrompt);
      }

      // Always show the prompt — on Android/Desktop with no globalPrompt we show manual instructions
      // On iOS we always show the manual guide
      setIsVisible(true);
    };

    // If notification is already dismissed, show immediately
    if (notifDismissed) {
      tryShow();
    }

    // Listen for notification dismissal during this session
    const onNotifDismissed = () => tryShow();
    // Listen for the global install-ready event in case it fires after we mount
    const onInstallReady = () => {
      const globalPrompt = (window as any).__pwaInstallPrompt;
      if (globalPrompt) setInstallPrompt(globalPrompt);
      // If we're already visible, the button will now appear
      if (localStorage.getItem('hide-push-prompt') === 'true') setIsVisible(true);
    };

    window.addEventListener('notification-prompt-dismissed', onNotifDismissed);
    window.addEventListener('pwa-install-ready', onInstallReady);

    return () => {
      window.removeEventListener('notification-prompt-dismissed', onNotifDismissed);
      window.removeEventListener('pwa-install-ready', onInstallReady);
    };
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') {
      (window as any).__pwaInstallPrompt = null;
      setIsVisible(false);
    }
  };

  const handleDismiss = () => {
    localStorage.setItem('hide-install-prompt', 'true');
    setIsVisible(false);
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
                  Add HisaFlow to your home screen for quick, full-screen access.
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
              <>
                <ol className="text-xs text-[var(--color-text-secondary)] space-y-2 mt-1 mb-3">
                  <li className="flex gap-2 items-start">
                    <span className="font-bold text-emerald-500 shrink-0">1.</span>
                    Tap the <strong>Share</strong> <Share2 className="inline h-3 w-3 mb-0.5" /> button at the bottom of Safari
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
                <button onClick={handleDismiss} className="rounded-xl border border-[var(--color-border)] px-3 py-2 text-xs font-medium">
                  Done
                </button>
              </>
            )
          ) : installPrompt ? (
            // Android/Desktop with native prompt available — ONE-TAP install
            <>
              <p className="text-xs text-[var(--color-text-secondary)] mb-3">
                Install HisaFlow on your {platform === 'android' ? 'home screen' : 'desktop'} for a faster, app-like experience.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={handleInstall}
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white"
                >
                  <Download className="h-3.5 w-3.5" />
                  Install App
                </button>
                <button onClick={handleDismiss} className="rounded-xl border border-[var(--color-border)] px-3 py-2 text-xs font-medium">
                  Later
                </button>
              </div>
            </>
          ) : (
            // Android fallback — prompt not available, show manual guide
            <>
              <p className="text-xs text-[var(--color-text-secondary)] mb-3">
                Open Chrome's menu <strong>⋮</strong> and tap <strong>"Add to Home screen"</strong> to install HisaFlow.
              </p>
              <button onClick={handleDismiss} className="rounded-xl border border-[var(--color-border)] px-3 py-2 text-xs font-medium">
                Got it
              </button>
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
