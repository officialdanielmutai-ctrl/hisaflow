'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useMyOrganization } from '@/hooks/useMyOrganization';
import { Note, getNotes } from '@/services/notes.service';
import NoteCard from '@/components/notes/NoteCard';
import CreateNoteDialog from '@/components/notes/CreateNoteDialog';
import { Plus, ListTodo } from 'lucide-react';

export default function NotesPage() {
  const { getToken } = useAuth();
  const { membership } = useMyOrganization();
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [filter, setFilter] = useState<'ALL' | 'OPEN' | 'COMPLETED'>('ALL');

  const fetchNotes = useCallback(async () => {
    if (!membership?.organization.id) return;
    try {
      const token = await getToken();
      if (!token) return;
      
      const filters = filter !== 'ALL' ? { status: filter } : undefined;
      const data = await getNotes(token, membership.organization.id, filters);
      setNotes(data);
    } catch (error) {
      console.error('Failed to fetch notes:', error);
    } finally {
      setLoading(false);
    }
  }, [getToken, membership?.organization.id, filter]);

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  return (
    <div className="flex flex-col h-full animate-in fade-in slide-in-from-bottom-4 duration-500">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--color-text-primary)]">
            Schedule & Notes
          </h1>
          <p className="text-sm text-[var(--color-text-muted)]">
            Keep your team aligned and on track.
          </p>
        </div>
        <button
          onClick={() => setIsDialogOpen(true)}
          className="flex h-10 items-center gap-2 rounded-xl bg-[var(--color-accent)] px-4 font-semibold text-white shadow-sm hover:bg-[var(--color-accent-hover)]"
        >
          <Plus className="h-5 w-5" />
          <span className="hidden sm:inline">New Note</span>
        </button>
      </header>

      <div className="mb-6 flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {(['ALL', 'OPEN', 'COMPLETED'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
              filter === f
                ? 'bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)]'
                : 'bg-transparent text-[var(--color-text-muted)] hover:bg-[var(--color-bg-surface-hover)]'
            }`}
          >
            {f === 'ALL' ? 'All Notes' : f === 'OPEN' ? 'Active' : 'Completed'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex flex-1 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--color-accent)] border-t-transparent"></div>
        </div>
      ) : notes.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <div className="mb-4 rounded-full bg-[var(--color-bg-secondary)] p-4 text-[var(--color-accent)]">
            <ListTodo className="h-8 w-8" />
          </div>
          <h3 className="mb-1 text-lg font-semibold text-[var(--color-text-primary)]">
            No notes found
          </h3>
          <p className="max-w-xs text-sm text-[var(--color-text-muted)]">
            Create a note or use the AI to leave a memo for your team.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4 pb-12">
          {notes.map((note) => (
            <NoteCard
              key={note.id}
              note={note}
              orgId={membership!.organization.id}
              onUpdate={fetchNotes}
            />
          ))}
        </div>
      )}

      {membership && (
        <CreateNoteDialog
          isOpen={isDialogOpen}
          onClose={() => setIsDialogOpen(false)}
          orgId={membership.organization.id}
          onSuccess={fetchNotes}
        />
      )}
    </div>
  );
}
