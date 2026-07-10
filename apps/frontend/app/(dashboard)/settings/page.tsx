'use client';

import { usePushNotifications } from '@/hooks/usePushNotifications';
import { Bell, BellOff, Download, Smartphone, Users, Copy, RefreshCw, Check } from 'lucide-react';
import { useState, useEffect } from 'react';
import { apiPost } from '@/lib/api-client';
import { useAuth } from '@clerk/nextjs';
import { useMyOrganization } from '@/hooks/useMyOrganization';
import { useRole } from '@/hooks/useRole';
import {
  getMyInviteCode,
  regenerateInviteCode,
  getStaffMembers,
  type StaffMember,
} from '@/services/organizations.service';

export default function SettingsPage() {
  const { isSupported, subscription, subscribe, isSubscribing, orgLoading, error } = usePushNotifications();
  const { getToken } = useAuth();
  const { membership } = useMyOrganization();
  const { isOwner, isManager } = useRole();
  const canManageStaff = isOwner || isManager;

  const [testStatus, setTestStatus] = useState('');
  const [installPrompt, setInstallPrompt] = useState<any>(null);

  // Invite code state
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [codeLoading, setCodeLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [staffLoading, setStaffLoading] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  // Load invite code and staff for owners/managers
  useEffect(() => {
    if (!canManageStaff) return;
    const fetchData = async () => {
      const token = await getToken();
      if (!token) return;
      setCodeLoading(true);
      setStaffLoading(true);
      try {
        const [codeData, staffData] = await Promise.all([
          getMyInviteCode(token),
          getStaffMembers(token),
        ]);
        setInviteCode(codeData.inviteCode);
        setStaffMembers(staffData);
      } catch (e) {
        console.error('Failed to load org data', e);
      } finally {
        setCodeLoading(false);
        setStaffLoading(false);
      }
    };
    fetchData();
  }, [canManageStaff, getToken]);

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

  const handleCopyCode = () => {
    if (!inviteCode) return;
    navigator.clipboard.writeText(inviteCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleRegenerateCode = async () => {
    if (!confirm('Regenerating will invalidate the current code. Staff who haven\'t joined yet will need the new code. Continue?')) return;
    const token = await getToken();
    if (!token) return;
    setCodeLoading(true);
    try {
      const data = await regenerateInviteCode(token);
      setInviteCode(data.inviteCode);
    } catch (e) {
      console.error('Failed to regenerate code', e);
    } finally {
      setCodeLoading(false);
    }
  };

  const roleColors: Record<string, string> = {
    OWNER: 'bg-purple-100 text-purple-700',
    MANAGER: 'bg-blue-100 text-blue-700',
    STAFF: 'bg-gray-100 text-gray-600',
  };

  return (
    <div className="space-y-6 pb-24">
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">App Settings</h1>
        <p className="text-[var(--color-text-secondary)] text-sm mt-1">
          Manage your device preferences and notifications.
        </p>
      </header>

      {/* ── Staff Invite Code (owners/managers only) ───────────────────── */}
      {canManageStaff && (
        <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="rounded-full bg-violet-100 p-2 text-violet-600">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-semibold">Staff Invite Code</h2>
              <p className="text-xs text-[var(--color-text-secondary)]">
                Share this code with your staff to let them join your business
              </p>
            </div>
          </div>

          {codeLoading ? (
            <div className="h-16 animate-pulse rounded-xl bg-[var(--color-bg-base)]" />
          ) : inviteCode ? (
            <div className="space-y-3">
              {/* Code display */}
              <div className="flex items-center justify-between gap-3 rounded-xl bg-[var(--color-bg-base)] border border-[var(--color-border)] px-4 py-3">
                <span className="font-mono text-2xl font-bold tracking-[0.3em] text-[var(--color-accent)]">
                  {inviteCode}
                </span>
                <button
                  onClick={handleCopyCode}
                  className="flex items-center gap-1.5 rounded-lg bg-[var(--color-accent)] px-3 py-2 text-xs font-semibold text-white hover:opacity-90 transition-opacity"
                >
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>

              <p className="text-xs text-[var(--color-text-secondary)]">
                Staff enter this code on the "Join a business" screen when they first sign in.
              </p>

              <button
                onClick={handleRegenerateCode}
                disabled={codeLoading}
                className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)] hover:text-red-500 transition-colors"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Regenerate code
              </button>
            </div>
          ) : (
            <p className="text-sm text-[var(--color-text-secondary)]">Could not load invite code.</p>
          )}

          {/* Staff member list */}
          {!staffLoading && staffMembers.length > 0 && (
            <div className="mt-5">
              <p className="text-xs font-semibold text-[var(--color-text-secondary)] mb-2">
                Team Members ({staffMembers.length})
              </p>
              <div className="space-y-2">
                {staffMembers.map((member) => (
                  <div
                    key={member.userId}
                    className="flex items-center justify-between rounded-xl bg-[var(--color-bg-base)] px-3 py-2.5 border border-[var(--color-border)]"
                  >
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">{member.name ?? 'Unnamed'}</span>
                      {member.email && (
                        <span className="text-xs text-[var(--color-text-secondary)]">{member.email}</span>
                      )}
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${roleColors[member.role]}`}>
                      {member.role}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* ── Push Notifications ─────────────────────────────────────────────── */}
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

      {/* ── Install App ─────────────────────────────────────────────────────── */}
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
