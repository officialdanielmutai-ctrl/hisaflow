'use client';

import { useState, useCallback, useEffect } from 'react';
import { Users, Trash2, RefreshCw, Copy, Check, ChevronDown, ChevronUp, ShieldAlert } from 'lucide-react';
import { useAuth } from '@clerk/nextjs';
import {
  getMyInviteCode,
  regenerateInviteCode,
  getStaffMembers,
  removeStaffMember,
  updateStaffPermissions,
  type StaffMember,
} from '@/services/organizations.service';
import { ALL_PERMISSIONS, type AppPermissionKey } from '@/hooks/useRole';

const PERMISSION_LABELS: Record<string, string> = {
  canViewAnalytics: 'View Analytics',
  canAddInventory: 'Add Inventory',
  canEditInventory: 'Edit Inventory',
  canLogTransactions: 'Log Transactions',
  canViewFinance: 'View Finance',
};

const ROLE_COLORS: Record<string, string> = {
  OWNER: 'bg-purple-100 text-purple-700',
  MANAGER: 'bg-blue-100 text-blue-700',
  STAFF: 'bg-gray-100 text-gray-600',
};

interface Props {
  orgId: string;
  isOwner: boolean;
}

export default function StaffManagementCard({ orgId, isOwner }: Props) {
  const { getToken } = useAuth();

  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [initialLoaded, setInitialLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [pendingPermissions, setPendingPermissions] = useState<Record<string, { granted: string[]; revoked: string[] }>>({});
  const [savingUserId, setSavingUserId] = useState<string | null>(null);
  const [removingUserId, setRemovingUserId] = useState<string | null>(null);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    const token = await getToken();
    if (!token) return;
    setLoading(true);
    setLoadError(null);
    try {
      const [codeData, membersData] = await Promise.all([
        getMyInviteCode(token, orgId),
        getStaffMembers(token, orgId),
      ]);
      setInviteCode(codeData.inviteCode);
      setStaffMembers(membersData);
      setInitialLoaded(true);
    } catch (e: any) {
      setLoadError(e.message ?? 'Failed to load team data');
    } finally {
      setLoading(false);
    }
  }, [getToken, orgId]);

  // Load on mount — must be in useEffect, not render body
  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCopy = () => {
    if (!inviteCode) return;
    navigator.clipboard.writeText(inviteCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleRegenerate = async () => {
    if (!confirm('Regenerating will invalidate the current code. Staff who haven\'t joined yet will need the new code. Continue?')) return;
    const token = await getToken();
    if (!token) return;
    setLoading(true);
    try {
      const data = await regenerateInviteCode(token, orgId);
      setInviteCode(data.inviteCode);
    } finally {
      setLoading(false);
    }
  };

  // Build pending permission state for a member on first expand
  const handleExpand = (member: StaffMember) => {
    const id = member.userId;
    if (expandedUserId === id) {
      setExpandedUserId(null);
      return;
    }
    setExpandedUserId(id);
    if (!pendingPermissions[id]) {
      setPendingPermissions((prev) => ({
        ...prev,
        [id]: {
          granted: [...member.grantedPermissions],
          revoked: [...member.revokedPermissions],
        },
      }));
    }
  };

  const togglePermission = (userId: string, perm: string, effectivePerms: string[]) => {
    setPendingPermissions((prev) => {
      const current = prev[userId] ?? { granted: [], revoked: [] };
      const isCurrentlyOn = effectivePerms.includes(perm);

      if (isCurrentlyOn) {
        // Turning OFF: add to revoked, remove from granted
        return {
          ...prev,
          [userId]: {
            granted: current.granted.filter((p) => p !== perm),
            revoked: current.revoked.includes(perm) ? current.revoked : [...current.revoked, perm],
          },
        };
      } else {
        // Turning ON: add to granted, remove from revoked
        return {
          ...prev,
          [userId]: {
            granted: current.granted.includes(perm) ? current.granted : [...current.granted, perm],
            revoked: current.revoked.filter((p) => p !== perm),
          },
        };
      }
    });
  };

  const savePermissions = async (userId: string) => {
    const token = await getToken();
    if (!token) return;
    const perms = pendingPermissions[userId];
    if (!perms) return;
    setSavingUserId(userId);
    try {
      const updated = await updateStaffPermissions(token, orgId, userId, perms.granted, perms.revoked);
      setStaffMembers((prev) =>
        prev.map((m) => (m.userId === userId ? { ...m, ...updated } : m)),
      );
    } catch (e: any) {
      alert(`Failed to update permissions: ${e.message}`);
    } finally {
      setSavingUserId(null);
    }
  };

  const handleRemove = async (member: StaffMember) => {
    if (confirmRemoveId !== member.userId) {
      setConfirmRemoveId(member.userId);
      return;
    }
    const token = await getToken();
    if (!token) return;
    setRemovingUserId(member.userId);
    setConfirmRemoveId(null);
    try {
      await removeStaffMember(token, orgId, member.userId);
      setStaffMembers((prev) => prev.filter((m) => m.userId !== member.userId));
      if (expandedUserId === member.userId) setExpandedUserId(null);
    } catch (e: any) {
      alert(`Failed to remove staff member: ${e.message}`);
    } finally {
      setRemovingUserId(null);
    }
  };

  return (
    <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-5">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="rounded-full bg-violet-100 p-2 text-violet-600">
          <Users className="h-5 w-5" />
        </div>
        <div>
          <h2 className="font-semibold">Team Management</h2>
          <p className="text-xs text-[var(--color-text-secondary)]">
            {isOwner ? 'Manage staff permissions and access' : 'View your team members'}
          </p>
        </div>
      </div>

      {loadError && (
        <p className="text-sm text-red-500 mb-4">{loadError}</p>
      )}

      {/* Invite Code — owners/managers only */}
      {isOwner && (
        <div className="mb-5">
          <p className="text-xs font-semibold text-[var(--color-text-secondary)] mb-2 uppercase tracking-wider">Staff Invite Code</p>
          {loading && !inviteCode ? (
            <div className="h-14 animate-pulse rounded-xl bg-[var(--color-bg-base)]" />
          ) : inviteCode ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3 rounded-xl bg-[var(--color-bg-base)] border border-[var(--color-border)] px-4 py-3">
                <span className="font-mono text-2xl font-bold tracking-[0.3em] text-[var(--color-accent)]">
                  {inviteCode}
                </span>
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1.5 rounded-lg bg-[var(--color-accent)] px-3 py-2 text-xs font-semibold text-white hover:opacity-90 transition-opacity"
                >
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <button
                onClick={handleRegenerate}
                disabled={loading}
                className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)] hover:text-red-500 transition-colors"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Regenerate code
              </button>
            </div>
          ) : null}
        </div>
      )}

      {/* Team member list */}
      <div>
        <p className="text-xs font-semibold text-[var(--color-text-secondary)] mb-2 uppercase tracking-wider">
          Team Members {staffMembers.length > 0 && `(${staffMembers.length})`}
        </p>

        {loading && staffMembers.length === 0 ? (
          <div className="space-y-2">
            {[1, 2].map((i) => (
              <div key={i} className="h-14 animate-pulse rounded-xl bg-[var(--color-bg-base)]" />
            ))}
          </div>
        ) : staffMembers.length === 0 ? (
          <p className="text-sm text-[var(--color-text-secondary)]">No team members yet.</p>
        ) : (
          <div className="space-y-2">
            {staffMembers.map((member) => {
              const isExpanded = expandedUserId === member.userId;
              const pending = pendingPermissions[member.userId];
              const isRemoving = removingUserId === member.userId;
              const isSaving = savingUserId === member.userId;
              const isConfirmingRemove = confirmRemoveId === member.userId;
              const isNonOwner = member.role !== 'OWNER';

              return (
                <div
                  key={member.userId}
                  className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-base)] overflow-hidden"
                >
                  {/* Member row */}
                  <div className="flex items-center justify-between px-3 py-2.5">
                    <div className="flex flex-col min-w-0">
                      <span className="text-sm font-medium truncate">{member.name ?? 'Unnamed'}</span>
                      {member.email && (
                        <span className="text-xs text-[var(--color-text-secondary)] truncate">{member.email}</span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${ROLE_COLORS[member.role]}`}>
                        {member.role}
                      </span>

                      {/* Expand permissions — owners only for non-owner members */}
                      {isOwner && isNonOwner && (
                        <button
                          onClick={() => handleExpand(member)}
                          className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition-colors ${
                            isExpanded
                              ? 'bg-[var(--color-accent)] text-white'
                              : 'bg-[var(--color-bg-surface)] border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]'
                          }`}
                          title="Manage permissions and access"
                        >
                          <span className="hidden sm:inline">Manage</span>
                          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Expanded permission panel */}
                  {isExpanded && isOwner && isNonOwner && pending && (
                    <div className="border-t border-[var(--color-border)] px-3 py-3 space-y-3">
                      <p className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">Permissions</p>

                      <div className="space-y-2">
                        {ALL_PERMISSIONS.map((perm) => {
                          const isOn = member.effectivePermissions.includes(perm);
                          return (
                            <div key={perm} className="flex items-center justify-between">
                              <span className="text-sm">{PERMISSION_LABELS[perm] ?? perm}</span>
                              <button
                                onClick={() => togglePermission(member.userId, perm, member.effectivePermissions)}
                                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                                  isOn ? 'bg-[var(--color-accent)]' : 'bg-gray-200'
                                }`}
                              >
                                <span
                                  className={`inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform ${
                                    isOn ? 'translate-x-4' : 'translate-x-0.5'
                                  }`}
                                />
                              </button>
                            </div>
                          );
                        })}
                      </div>

                      <div className="flex items-center gap-2 pt-1">
                        <button
                          onClick={() => savePermissions(member.userId)}
                          disabled={isSaving}
                          className="flex-1 h-9 rounded-xl bg-[var(--color-accent)] text-white text-sm font-semibold disabled:opacity-50"
                        >
                          {isSaving ? 'Saving…' : 'Save Permissions'}
                        </button>

                        {/* Remove staff */}
                        <button
                          onClick={() => handleRemove(member)}
                          disabled={isRemoving}
                          className={`flex items-center gap-1.5 h-9 px-3 rounded-xl text-sm font-semibold border transition-colors ${
                            isConfirmingRemove
                              ? 'border-red-500 bg-red-500 text-white'
                              : 'border-[var(--color-border)] text-red-500 hover:bg-red-50'
                          }`}
                          title={isConfirmingRemove ? 'Click again to confirm removal' : 'Remove staff member'}
                        >
                          {isRemoving ? (
                            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <>
                              <ShieldAlert className="h-3.5 w-3.5" />
                              {isConfirmingRemove ? 'Confirm Remove' : 'Remove'}
                            </>
                          )}
                        </button>
                      </div>

                      {isConfirmingRemove && (
                        <p className="text-xs text-red-500">
                          This will immediately log them out and remove their access. Their previous work remains visible. They can rejoin with a new invite code.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
