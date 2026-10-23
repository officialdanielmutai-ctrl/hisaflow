'use client';

import { usePushNotifications } from '@/hooks/usePushNotifications';
import {
  Bell,
  BellOff,
  CreditCard,
  Download,
  Loader2,
  Palette,
  Receipt,
  Smartphone,
  Users,
  Wifi,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { apiPost } from '@/lib/api-client';
import { useAuth } from '@clerk/nextjs';
import { useMyOrganization } from '@/hooks/useMyOrganization';
import { useRole } from '@/hooks/useRole';
import StaffManagementCard from '@/components/settings/StaffManagementCard';
import RouterSettingsCard from '@/components/settings/RouterSettingsCard';
import { SettingsActionRow, SettingsLinkRow } from '@/components/settings/SettingsRow';
import { SettingsGroup } from '@/components/settings/SettingsGroup';

export default function SettingsPage() {
  const { isSupported, subscription, subscribe, isSubscribing, orgLoading, error } = usePushNotifications();
  const { getToken } = useAuth();
  const { membership } = useMyOrganization();
  const { isOwner, isManager } = useRole();
  const canManageStaff = isOwner || isManager;
  const orgId = membership?.organization?.id ?? null;

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
    if (outcome === 'accepted') setInstallPrompt(null);
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
    <div className="mx-auto flex w-full max-w-lg flex-col gap-6 pb-24">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          Manage your business, device and preferences.
        </p>
      </header>

      {/* ── Appearance ──────────────────────────────────────────────────────── */}
      <SettingsGroup title="Appearance">
        <SettingsLinkRow
          href="/settings/appearance"
          icon={Palette}
          iconClassName="bg-[var(--color-accent)]/10 text-[var(--color-accent)]"
          title="Theme"
          description="Choose a named theme, or follow your device light/dark setting."
        />
      </SettingsGroup>

      {/* ── Business admin ──────────────────────────────────────────────────── */}
      {canManageStaff && (
        <SettingsGroup title="Business" description="Owner and manager tools.">
          <SettingsLinkRow
            href="/settings/tax"
            icon={Receipt}
            iconClassName="bg-amber-100 text-amber-600"
            title="Tax & eTIMS"
            description="Register your KRA PIN and track eTIMS approval."
          />
          <SettingsLinkRow
            href="/settings/billing"
            icon={CreditCard}
            iconClassName="bg-indigo-100 text-indigo-600"
            title="Billing & plan"
            description="Your subscription, seats and payment method."
          />
        </SettingsGroup>
      )}

      {/* ── Team & hardware ─────────────────────────────────────────────────── */}
      {canManageStaff && orgId && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 px-1">
            <Users className="h-4 w-4 text-[var(--color-text-muted)]" />
            <h2 className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
              Team
            </h2>
          </div>
          <StaffManagementCard orgId={orgId} isOwner={isOwner} />

          <div className="flex items-center gap-2 px-1 pt-2">
            <Wifi className="h-4 w-4 text-[var(--color-text-muted)]" />
            <h2 className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
              Hardware
            </h2>
          </div>
          <RouterSettingsCard orgId={orgId} isOwner={isOwner} />
        </div>
      )}

      {/* ── Notifications ───────────────────────────────────────────────────── */}
      <SettingsGroup title="Notifications">
        <SettingsActionRow
          icon={subscription ? Bell : BellOff}
          iconClassName={
            subscription
              ? 'bg-emerald-100 text-emerald-600'
              : 'bg-[var(--color-bg-elevated)] text-[var(--color-text-muted)]'
          }
          title={subscription ? 'Push notifications on' : 'Push notifications off'}
          description={
            isSupported
              ? subscription
                ? 'You will receive low-stock and summary alerts.'
                : 'Enable alerts on this device.'
              : 'Not supported on this browser or OS.'
          }
          trailing={
            !subscription && isSupported ? (
              <button
                onClick={subscribe}
                disabled={isSubscribing || orgLoading}
                className="shrink-0 rounded-lg bg-[var(--color-accent)] px-3 py-1.5 text-xs font-semibold text-white transition-opacity disabled:opacity-50"
              >
                {isSubscribing ? 'Enabling…' : orgLoading ? 'Loading…' : 'Enable'}
              </button>
            ) : (
              <span className="text-xs font-semibold text-[var(--color-text-muted)]">
                {subscription ? 'On' : '—'}
              </span>
            )
          }
        />

        {subscription && (
          <SettingsActionRow
            icon={Bell}
            title="Test notification"
            description="Send a test alert to this device."
            trailing={
              <button
                onClick={handleTestNotification}
                className="shrink-0 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-[var(--color-bg-elevated)]"
              >
                {testStatus === 'Sending...' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  'Send test'
                )}
              </button>
            }
          />
        )}

        {(error || testStatus) && (
          <div className="px-4 py-3 text-xs">
            {error && <p className="text-red-500">{error}</p>}
            {testStatus && testStatus !== 'Sending...' && (
              <p className={testStatus.startsWith('✅') ? 'text-emerald-600' : 'text-red-500'}>
                {testStatus}
              </p>
            )}
          </div>
        )}
      </SettingsGroup>

      {/* ── App ─────────────────────────────────────────────────────────────── */}
      <SettingsGroup title="App">
        <SettingsActionRow
          icon={Smartphone}
          iconClassName="bg-emerald-100 text-emerald-600"
          title="Install HisaFlow"
          description="Add the app to your home screen for offline access."
          trailing={
            installPrompt ? (
              <button
                onClick={handleInstall}
                className="flex shrink-0 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-emerald-700"
              >
                <Download className="h-4 w-4" />
                Install
              </button>
            ) : (
              <span className="text-xs text-[var(--color-text-muted)]">Installed</span>
            )
          }
        />
        {!installPrompt && (
          <div className="px-4 py-3 text-xs text-[var(--color-text-secondary)]">
            <p>To install manually:</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-5">
              <li>
                <strong>iOS (Safari):</strong> Share → Add to Home Screen.
              </li>
              <li>
                <strong>Android (Chrome):</strong> ⋮ menu → Install app.
              </li>
            </ul>
          </div>
        )}
      </SettingsGroup>
    </div>
  );
}
