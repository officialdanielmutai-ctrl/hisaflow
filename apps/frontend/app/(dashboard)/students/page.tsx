'use client';

import useSWR from 'swr';
import { useAuth } from '@clerk/nextjs';
import { useMyOrganization } from '@/hooks/useMyOrganization';
import Link from 'next/link';
import { AddStudentSheet } from '@/components/school/AddStudentSheet';
import { Users, GraduationCap, Search, ChevronRight } from 'lucide-react';
import { useState } from 'react';

interface Student {
  id: string;
  name: string;
  admissionNumber?: string | null;
  class?: { name: string; stream?: string | null } | null;
}

function avatarColor(name: string) {
  const palettes = [
    'bg-indigo-500', 'bg-teal-500', 'bg-orange-500', 'bg-purple-500',
    'bg-green-500', 'bg-rose-500', 'bg-blue-500', 'bg-amber-500',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return palettes[Math.abs(hash) % palettes.length];
}

export default function StudentsPage() {
  const { getToken } = useAuth();
  const { membership } = useMyOrganization();
  const orgId = membership?.organization.id;
  const [search, setSearch] = useState('');

  const { data: students, isLoading, mutate } = useSWR<Student[]>(
    orgId ? ['students', orgId] : null,
    async () => {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');
      const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'https://api.hisaflow.com';
      const res = await fetch(`${apiBase}/students`, {
        headers: { Authorization: `Bearer ${token}`, 'x-organization-id': orgId! },
      });
      if (!res.ok) throw new Error('Failed to load students');
      return res.json();
    },
  );

  const filtered = (students ?? []).filter(s =>
    !search.trim() ||
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.admissionNumber?.toLowerCase().includes(search.toLowerCase()) ||
    s.class?.name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="flex flex-col gap-6 pb-24">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-[var(--color-text-primary)]">Students</h1>
          <p className="text-sm text-[var(--color-text-secondary)] mt-0.5">Manage school enrollment</p>
        </div>
        <AddStudentSheet />
      </div>

      {/* Stats */}
      {!isLoading && students && (
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-full bg-[var(--color-bg-surface)] border border-[var(--color-border)] px-4 py-2">
            <Users className="h-4 w-4 text-[var(--color-primary)]" />
            <span className="text-sm font-bold text-[var(--color-text-primary)]">{students.length}</span>
            <span className="text-xs text-[var(--color-text-secondary)]">student{students.length !== 1 ? 's' : ''}</span>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--color-text-muted)]" />
        <input
          type="text"
          placeholder="Search by name, admission no., or class…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] pl-9 pr-4 py-2.5 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 transition"
        />
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex flex-col gap-3">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="h-16 w-full rounded-2xl bg-[var(--color-bg-surface)] border border-[var(--color-border)] animate-pulse" />
          ))}
        </div>
      )}

      {/* Empty */}
      {!isLoading && (!students || students.length === 0) && (
        <div className="flex flex-col items-center justify-center py-16 border-2 border-dashed border-[var(--color-border)] rounded-2xl bg-[var(--color-bg-surface)]">
          <div className="h-16 w-16 rounded-full bg-indigo-100 flex items-center justify-center mb-4">
            <GraduationCap className="h-8 w-8 text-indigo-500" />
          </div>
          <h3 className="text-base font-bold text-[var(--color-text-primary)] mb-1">No students yet</h3>
          <p className="text-sm text-[var(--color-text-secondary)] mb-4">Enroll your first student to get started</p>
          <AddStudentSheet />
        </div>
      )}

      {/* No search results */}
      {!isLoading && students && students.length > 0 && filtered.length === 0 && (
        <div className="text-center py-10 text-[var(--color-text-secondary)] text-sm">
          No students match "<span className="font-semibold">{search}</span>"
        </div>
      )}

      {/* Student list */}
      {!isLoading && filtered.length > 0 && (
        <div className="flex flex-col gap-2">
          {filtered.map(student => {
            const initials = student.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
            const bgColor = avatarColor(student.name);
            return (
              <Link
                key={student.id}
                href={`/students/${student.id}`}
                className="flex items-center gap-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-4 shadow-sm hover:shadow-md hover:bg-[var(--color-bg-base)] transition-all group"
              >
                {/* Avatar */}
                <div className={`h-11 w-11 rounded-full ${bgColor} flex items-center justify-center shrink-0 text-white font-bold text-sm`}>
                  {initials}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-[var(--color-text-primary)] truncate">{student.name}</p>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    {student.admissionNumber && (
                      <span className="text-xs text-[var(--color-text-secondary)]">#{student.admissionNumber}</span>
                    )}
                    {student.class && (
                      <>
                        {student.admissionNumber && <span className="text-[var(--color-text-muted)] text-xs">·</span>}
                        <span className="text-xs font-semibold text-[var(--color-primary)] bg-indigo-50 px-2 py-0.5 rounded-full">
                          {student.class.name}{student.class.stream ? ` ${student.class.stream}` : ''}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* Arrow */}
                <ChevronRight className="h-4 w-4 text-[var(--color-text-muted)] group-hover:text-[var(--color-primary)] transition-colors shrink-0" />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
