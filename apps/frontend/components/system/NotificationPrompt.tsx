'use client';

import { usePushNotifications } from '@/hooks/usePushNotifications';
import { BellRing, X } from 'lucide-react';
import { useState, useEffect } from 'react';

export default function NotificationPrompt() {
  const { isSupported, subscription, subscribe, isSubscribing, orgLoading, error } = usePushNotifications();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Only show if supported, not subscribed, and not dismissed
    const dismissed = localStorage.getItem('hide-push-prompt');
    if (isSupported && !subscription && dismissed !== 'true') {
      setIsVisible(true);
    } else {
      setIsVisible(false);
    }
  }, [isSupported, subscription]);

  const handleDismiss = () => {
    localStorage.setItem('hide-push-prompt', 'true');
    setIsVisible(false);
  };

  if (!isVisible) return null;

  const buttonDisabled = isSubscribing || orgLoading;
  const buttonLabel = isSubscribing
    ? 'Enabling...'
    : orgLoading
    ? 'Loading account...'
    : 'Enable Now';

  return (
    <div className="fixed bottom-20 left-4 right-4 z-40 max-w-sm mx-auto animate-in slide-in-from-bottom-5">
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-4 shadow-xl flex gap-4 items-start">
        <div className="rounded-full bg-blue-100 p-2 text-blue-600 mt-1 shrink-0">
          <BellRing className="h-5 w-5" />
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold mb-1">Enable App Notifications</h3>
          <p className="text-xs text-[var(--color-text-secondary)] mb-3">
            Get instant alerts for dead stock and daily financial insights right on your device.
          </p>

          {error && (
            <p className="text-xs text-red-500 mb-2 leading-tight">{error}</p>
          )}

          <div className="flex gap-2">
            <button
              onClick={subscribe}
              disabled={buttonDisabled}
              className="flex-1 rounded-xl bg-[var(--color-accent)] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
            >
              {buttonLabel}
            </button>
            <button
              onClick={handleDismiss}
              className="rounded-xl border border-[var(--color-border)] px-3 py-2 text-xs font-medium"
            >
              Maybe Later
            </button>
          </div>
        </div>

        <button onClick={handleDismiss} className="text-[var(--color-text-muted)] p-1 -m-1 shrink-0">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
