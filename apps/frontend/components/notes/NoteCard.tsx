'use client';

import { Note, updateNote, deleteNote } from '@/services/notes.service';
import { format } from 'date-fns';
import { Calendar, Trash2, MoreVertical, Pin, PinOff } from 'lucide-react';
import { useState } from 'react';
import Checklist from './Checklist';
import { useAuth } from '@clerk/nextjs';

const importanceColors = {
  LOW: 'bg-gray-100 text-gray-700',
  MEDIUM: 'bg-blue-100 text-blue-700',
  HIGH: 'bg-orange-100 text-orange-700',
  CRITICAL: 'bg-red-100 text-red-700 font-bold',
};

const statusColors = {
  OPEN: 'bg-gray-100 text-gray-600',
  IN_PROGRESS: 'bg-purple-100 text-purple-700',
  COMPLETED: 'bg-green-100 text-green-700',
  ARCHIVED: 'bg-gray-200 text-gray-500',
};

export default function NoteCard({
  note,
  orgId,
  onUpdate,
}: {
  note: Note;
  orgId: string;
  onUpdate: () => void;
}) {
  const { getToken } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleTogglePin = async () => {
    setMenuOpen(false);
    const token = await getToken();
    if (token) {
      await updateNote(note.id, token, orgId, { isPinned: !note.isPinned });
      onUpdate();
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Delete this note?')) return;
    const token = await getToken();
    if (token) {
      await deleteNote(note.id, token, orgId);
      onUpdate();
    }
  };

  const handleStatusChange = async (newStatus: Note['status']) => {
    setMenuOpen(false);
    const token = await getToken();
    if (token) {
      await updateNote(note.id, token, orgId, { status: newStatus });
      onUpdate();
    }
  };

  return (
    <div className={`relative flex flex-col rounded-2xl border bg-white p-4 shadow-sm transition-all ${
      note.isPinned ? 'border-[var(--color-accent)] ring-1 ring-[var(--color-accent)]' : 'border-gray-200'
    }`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-gray-900">{note.title}</h3>
            {note.isPinned && <Pin className="h-4 w-4 text-[var(--color-accent)]" />}
          </div>
          <span className="text-xs text-gray-500">
            By {note.author.name} · {format(new Date(note.createdAt), 'MMM d, h:mm a')}
          </span>
        </div>

        <div className="relative">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <MoreVertical className="h-5 w-5" />
          </button>
          
          {menuOpen && (
            <div className="absolute right-0 top-full mt-1 w-48 z-10 rounded-xl border bg-white p-1 shadow-lg">
              <button
                onClick={handleTogglePin}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                {note.isPinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
                {note.isPinned ? 'Unpin' : 'Pin to top'}
              </button>
              <div className="my-1 h-px bg-gray-100" />
              <div className="px-3 py-1.5 text-xs font-semibold text-gray-500">Move to...</div>
              {(['OPEN', 'IN_PROGRESS', 'COMPLETED', 'ARCHIVED'] as Note['status'][]).map((st) => (
                st !== note.status && (
                  <button
                    key={st}
                    onClick={() => handleStatusChange(st)}
                    className="flex w-full items-center px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    {st.replace('_', ' ')}
                  </button>
                )
              ))}
              <div className="my-1 h-px bg-gray-100" />
              <button
                onClick={handleDelete}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-600 hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wider ${importanceColors[note.importance]}`}>
          {note.importance}
        </span>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wider ${statusColors[note.status]}`}>
          {note.status.replace('_', ' ')}
        </span>
        {note.dueDate && (
          <span className="flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
            <Calendar className="h-3 w-3" />
            {format(new Date(note.dueDate), 'MMM d')}
          </span>
        )}
      </div>

      {note.content && (
        <p className="mt-3 text-sm text-gray-600 whitespace-pre-wrap">{note.content}</p>
      )}

      {(note.checklistItems.length > 0 || note.status !== 'ARCHIVED') && (
        <Checklist
          items={note.checklistItems}
          noteId={note.id}
          orgId={orgId}
          onUpdate={onUpdate}
        />
      )}
    </div>
  );
}
