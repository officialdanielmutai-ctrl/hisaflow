'use client';

import * as React from 'react';
import { ChevronsUpDown, Check, Building2 } from 'lucide-react';
import { useMyOrganization } from '@/hooks/useMyOrganization';

// Map business type to a readable label
function businessLabel(type: string | null | undefined): string {
  if (!type) return 'Workspace';
  const map: Record<string, string> = {
    DUKA: 'Duka',
    MINI_MART: 'Mini Mart',
    WHOLESALER: 'Wholesaler',
    CHEMIST: 'Chemist',
    RESTAURANT: 'Restaurant',
    SCHOOL: 'School',
    GUEST_HOUSE: 'Guest House',
    ISP: 'ISP',
  };
  return map[type] ?? type.toLowerCase().replace(/_/g, ' ');
}

export function OrgSwitcher() {
  const { membership, allMemberships, setActiveOrgId } = useMyOrganization();
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  // Close on outside click
  React.useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  if (!membership) return null;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex flex-col items-start focus:outline-none group"
        aria-label="Switch organization"
      >
        <span className="flex items-center gap-1">
          <span className="text-sm font-bold text-[var(--color-text-primary)] truncate max-w-[140px]">
            {membership.organization.name}
          </span>
          {allMemberships.length > 1 && (
            <ChevronsUpDown className="h-3.5 w-3.5 text-[var(--color-text-muted)] flex-shrink-0 group-hover:text-[var(--color-text-primary)] transition-colors" />
          )}
        </span>
        <span className="text-xs font-medium text-[var(--color-text-muted)]">
          {businessLabel(membership.organization.businessType)} Workspace
        </span>
      </button>

      {open && allMemberships.length > 1 && (
        <div className="absolute left-0 top-full mt-2 z-50 w-64 rounded-2xl border border-[var(--color-border)] bg-white shadow-lg overflow-hidden">
          <div className="px-3 py-2 border-b border-[var(--color-border)]">
            <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
              Your Workspaces
            </p>
          </div>
          <div className="max-h-72 overflow-y-auto py-1">
            {allMemberships.map(m => {
              const isActive = m.organization.id === membership.organization.id;
              return (
                <button
                  key={m.organization.id}
                  onClick={() => {
                    setOpen(false);
                    if (!isActive) setActiveOrgId(m.organization.id);
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-[var(--color-bg-secondary)] transition-colors ${
                    isActive ? 'bg-[#1F7A5A]/5' : ''
                  }`}
                >
                  <div className="h-8 w-8 rounded-xl bg-[var(--color-bg-muted)] flex items-center justify-center flex-shrink-0">
                    <Building2 className="h-4 w-4 text-[var(--color-text-secondary)]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[var(--color-text-primary)] truncate">
                      {m.organization.name}
                    </p>
                    <p className="text-xs text-[var(--color-text-muted)] truncate">
                      {businessLabel(m.organization.businessType)}
                    </p>
                  </div>
                  {isActive && (
                    <Check className="h-4 w-4 text-[#1F7A5A] flex-shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
