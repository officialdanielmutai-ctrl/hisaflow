'use client';

import { Download, X } from 'lucide-react';
import { useState, useEffect } from 'react';

export default function InstallPrompt() {
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e);
      const dismissed = localStorage.getItem('hide-install-prompt');
      if (dismissed !== 'true') {
        setIsVisible(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handler);

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
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-36 left-4 right-4 z-40 max-w-sm mx-auto animate-in slide-in-from-bottom-5">
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-4 shadow-xl flex gap-4 items-start">
        <div className="rounded-full bg-emerald-100 p-2 text-emerald-600 mt-1">
          <Download className="h-5 w-5" />
        </div>
        
        <div className="flex-1">
          <h3 className="text-sm font-bold mb-1">Install HisaFlow</h3>
          <p className="text-xs text-[var(--color-text-secondary)] mb-3">
            Add HisaFlow to your home screen for quick access and full-screen experience.
          </p>
          
          <div className="flex gap-2">
            <button
              onClick={handleInstall}
              className="flex-1 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white"
            >
              Install App
            </button>
            <button
              onClick={handleDismiss}
              className="rounded-xl border border-[var(--color-border)] px-3 py-2 text-xs font-medium"
            >
              Maybe Later
            </button>
          </div>
        </div>
        
        <button onClick={handleDismiss} className="text-[var(--color-text-muted)] p-1 -m-1">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
