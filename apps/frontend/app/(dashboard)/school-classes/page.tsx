'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { useAuth } from '@clerk/nextjs';
import { useMyOrganization } from '@/hooks/useMyOrganization';
import { AddClassSheet } from '@/components/school/AddClassSheet';
import Link from 'next/link';
import { BookOpen, Users, ChevronRight, GraduationCap } from 'lucide-react';

interface SchoolClass {
  id: string;
  name: string;
  stream?: string | null;
  notes?: string | null;
  _count?: { students: number };
}

function classColorIndex(name: string) {
  const colors = [
    { bg: 'bg-indigo-100', text: 'text-indigo-600', icon: 'text-indigo-500' },
    { bg: 'bg-teal-100', text: 'text-teal-600', icon: 'text-teal-500' },
    { bg: 'bg-orange-100', text: 'text-orange-600', icon: 'text-orange-500' },
    { bg: 'bg-purple-100', text: 'text-purple-600', icon: 'text-purple-500' },
    { bg: 'bg-green-100', text: 'text-green-600', icon: 'text-green-500' },
    { bg: 'bg-rose-100', text: 'text-rose-600', icon: 'text-rose-500' },
    { bg: 'bg-blue-100', text: 'text-blue-600', icon: 'text-blue-500' },
    { bg: 'bg-amber-100', text: 'text-amber-600', icon: 'text-amber-500' },
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

export default function SchoolClassesPage() {
  const { getToken } = useAuth();
  const { membership } = useMyOrganization();
  const orgId = membership?.organization.id;

  const { data: classes, isLoading, mutate } = useSWR<SchoolClass[]>(
    orgId ? ['school-classes', orgId] : null,
    async () => {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');
      const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'https://api.hisaflow.com';
      const res = await fetch(`${apiBase}/school-classes`, {
        headers: { Authorization: `Bearer ${token}`, 'x-org-id': orgId! },
      });
      if (!res.ok) throw new Error('Failed to load classes');
      return res.json();
    },
  );

  return (
    <div className="flex flex-col gap-6 pb-24">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-[var(--color-text-primary)]">School Classes</h1>
          <p className="text-sm text-[var(--color-text-secondary)] mt-0.5">Manage your classes and streams</p>
        </div>
        <AddClassSheet />
      </div>

      {/* Stats row */}
      {!isLoading && classes && (
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-full bg-[var(--color-bg-surface)] border border-[var(--color-border)] px-4 py-2">
            <BookOpen className="h-4 w-4 text-[var(--color-primary)]" />
            <span className="text-sm font-bold text-[var(--color-text-primary)]">{classes.length}</span>
            <span className="text-xs text-[var(--color-text-secondary)]">class{classes.length !== 1 ? 'es' : ''}</span>
          </div>
          <div className="flex items-center gap-2 rounded-full bg-[var(--color-bg-surface)] border border-[var(--color-border)] px-4 py-2">
            <Users className="h-4 w-4 text-indigo-500" />
            <span className="text-sm font-bold text-[var(--color-text-primary)]">
              {classes.reduce((s, c) => s + (c._count?.students ?? 0), 0)}
            </span>
            <span className="text-xs text-[var(--color-text-secondary)]">students</span>
          </div>
        </div>
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="grid grid-cols-1 gap-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-24 w-full rounded-2xl bg-[var(--color-bg-surface)] border border-[var(--color-border)] animate-pulse" />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && (!classes || classes.length === 0) && (
        <div className="flex flex-col items-center justify-center py-16 border-2 border-dashed border-[var(--color-border)] rounded-2xl bg-[var(--color-bg-surface)]">
          <div className="h-16 w-16 rounded-full bg-indigo-100 flex items-center justify-center mb-4">
            <GraduationCap className="h-8 w-8 text-indigo-500" />
          </div>
          <h3 className="text-base font-bold text-[var(--color-text-primary)] mb-1">No classes yet</h3>
          <p className="text-sm text-[var(--color-text-secondary)] mb-4">Add your first class to get started</p>
          <AddClassSheet />
        </div>
      )}

      {/* Class cards */}
      {!isLoading && classes && classes.length > 0 && (
        <div className="flex flex-col gap-3">
          {classes.map(cls => {
            const colors = classColorIndex(cls.name);
            const studentCount = cls._count?.students ?? 0;
            return (
              <div
                key={cls.id}
                className="flex items-center gap-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-4 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className={`h-12 w-12 rounded-xl ${colors.bg} flex items-center justify-center shrink-0`}>
                  <BookOpen className={`h-6 w-6 ${colors.icon}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <h3 className="text-sm font-bold text-[var(--color-text-primary)]">{cls.name}</h3>
                    {cls.stream && (
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${colors.bg} ${colors.text}`}>
                        {cls.stream}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 mt-1">
                    <Users className="h-3.5 w-3.5 text-[var(--color-text-secondary)]" />
                    <span className="text-xs text-[var(--color-text-secondary)]">{studentCount} student{studentCount !== 1 ? 's' : ''}</span>
                  </div>
                  {cls.notes && (
                    <p className="text-xs text-[var(--color-text-muted)] mt-1 truncate">{cls.notes}</p>
                  )}
                </div>
                <Link href={`/students?classId=${cls.id}`} className={`flex h-8 w-8 items-center justify-center rounded-full ${colors.bg} shrink-0 hover:opacity-80 transition-opacity`}>
                  <ChevronRight className={`h-4 w-4 ${colors.icon}`} />
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
