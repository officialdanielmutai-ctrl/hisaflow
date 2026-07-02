'use client';

import { usePushNotifications } from '@/hooks/usePushNotifications';
import { Bell, BellOff, Download, Smartphone } from 'lucide-react';
import { useState, useEffect } from 'react';
import { apiPost } from '@/lib/api-client';
import { useAuth } from '@clerk/nextjs';
import { useMyOrganization } from '@/hooks/useMyOrganization';

export default function SettingsPage() {
  const { isSupported, subscription, subscribe, isSubscribing, orgLoading, error } = usePushNotifications();
  const { getToken } = useAuth();
  const { membership } = useMyOrganization();
  const [testStatus, setTestStatus] = useState('');
  const [installPrompt, setInstallPrompt] = useState<any>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') {
      setInstallPrompt(null);
    }
  };

  const handleTestNotification = async () => {
    setTestStatus('Sending...');
    try {
      const token = await getToken();
      if (!token || !membership?.organization.id) throw new Error('Not authenticated');
      await apiPost('/notifications/test', token, membership.organization.id, {});
      setTestStatus('✅ Notification sent! Check your device\'s notification tray.');
      setTimeout(() => setTestStatus(''), 6000);
    } catch (e: any) {
      setTestStatus('❌ Error: ' + e.message);
      setTimeout(() => setTestStatus(''), 4000);
    }
  };

  return (
    <div className="space-y-6 pb-24">
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">App Settings</h1>
        <p className="text-[var(--color-text-secondary)] text-sm mt-1">
          Manage your device preferences and notifications.
        </p>
      </header>

      <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="rounded-full bg-blue-100 p-2 text-blue-600">
            <Bell className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-semibold">Push Notifications</h2>
            <p className="text-xs text-[var(--color-text-secondary)]">
              {isSupported ? 'Supported on this device' : 'Not supported on this browser/OS'}
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between p-3 bg-[var(--color-bg-base)] rounded-xl border border-[var(--color-border)]">
            <div className="flex items-center gap-2">
              {subscription ? (
                <Bell className="h-4 w-4 text-emerald-500" />
              ) : (
                <BellOff className="h-4 w-4 text-red-500" />
              )}
              <span className="text-sm font-medium">
                Status: {subscription ? 'Subscribed' : 'Not Subscribed'}
              </span>
            </div>
            
            {!subscription && isSupported && (
              <button
                onClick={subscribe}
                disabled={isSubscribing || orgLoading}
                className="bg-[var(--color-accent)] text-white px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50"
              >
                {isSubscribing ? 'Enabling...' : orgLoading ? 'Loading...' : 'Enable Now'}
              </button>
            )}
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}
          {testStatus && <p className="text-xs text-emerald-600 font-medium">{testStatus}</p>}

          {subscription && (
            <button
              onClick={handleTestNotification}
              className="w-full border border-[var(--color-border)] px-4 py-2 rounded-xl text-sm font-medium hover:bg-[var(--color-bg-base)] transition-colors"
            >
              Test Notification System
            </button>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="rounded-full bg-emerald-100 p-2 text-emerald-600">
            <Smartphone className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-semibold">Install App (PWA)</h2>
            <p className="text-xs text-[var(--color-text-secondary)]">
              Add HisaFlow to your home screen
            </p>
          </div>
        </div>

        <div className="p-4 bg-[var(--color-bg-base)] rounded-xl border border-[var(--color-border)]">
          {installPrompt ? (
            <div className="flex items-center justify-between">
              <span className="text-sm text-[var(--color-text-secondary)]">Ready to install</span>
              <button
                onClick={handleInstall}
                className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-emerald-700"
              >
                <Download className="h-4 w-4" />
                Install Now
              </button>
            </div>
          ) : (
            <div className="text-sm text-[var(--color-text-secondary)]">
              <p>App is already installed, or your browser handles installation differently.</p>
              <ul className="list-disc pl-5 mt-2 text-xs space-y-1">
                <li><strong>iOS (Safari):</strong> Tap the Share button at the bottom, then "Add to Home Screen".</li>
                <li><strong>Android (Chrome):</strong> Tap the 3 dots menu, then "Install App".</li>
              </ul>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
