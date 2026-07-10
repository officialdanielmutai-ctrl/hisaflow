'use client';

import { Note, updateNote, deleteNote } from '@/services/notes.service';
import { format } from 'date-fns';
import { Calendar, Trash2, MoreVertical, Pin, PinOff, Edit2, Save, X } from 'lucide-react';
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
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(note.title);
  const [editContent, setEditContent] = useState(note.content || '');
  const [editImportance, setEditImportance] = useState(note.importance);
  const [editDueDate, setEditDueDate] = useState(note.dueDate ? new Date(note.dueDate).toISOString().slice(0, 10) : '');
  const [saving, setSaving] = useState(false);

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

  const handleSaveEdit = async () => {
    if (!editTitle.trim()) return;
    setSaving(true);
    const token = await getToken();
    if (token) {
      await updateNote(note.id, token, orgId, {
        title: editTitle.trim(),
        content: editContent.trim() || undefined,
        importance: editImportance,
        dueDate: editDueDate ? new Date(editDueDate).toISOString() : undefined,
      });
      setIsEditing(false);
      onUpdate();
    }
    setSaving(false);
  };

  return (
    <div className={`relative flex flex-col rounded-2xl border bg-white p-4 shadow-sm transition-all ${
      note.isPinned ? 'border-[var(--color-accent)] ring-1 ring-[var(--color-accent)]' : 'border-gray-200'
    }`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1 w-full min-w-0">
          <div className="flex items-center gap-2">
            {isEditing ? (
              <input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="w-full font-semibold text-gray-900 border-b border-gray-300 focus:outline-none focus:border-[var(--color-accent)] py-0.5"
                placeholder="Note Title"
              />
            ) : (
              <>
                <h3 className="font-semibold text-gray-900 truncate">{note.title}</h3>
                {note.isPinned && <Pin className="h-4 w-4 shrink-0 text-[var(--color-accent)]" />}
              </>
            )}
          </div>
          <span className="text-xs text-gray-500">
            By {note.author.name} · {format(new Date(note.createdAt), 'MMM d, h:mm a')}
          </span>
        </div>

        {!isEditing && (
          <div className="relative shrink-0">
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            >
              <MoreVertical className="h-5 w-5" />
            </button>
            
            {menuOpen && (
              <div className="absolute right-0 top-full mt-1 w-48 z-10 rounded-xl border bg-white p-1 shadow-lg">
                <button
                  onClick={() => { setIsEditing(true); setMenuOpen(false); }}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  <Edit2 className="h-4 w-4" />
                  Edit Content
                </button>
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
        )}
      </div>

      {!isEditing && (
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
      )}

      {isEditing ? (
        <div className="mt-3 space-y-3">
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="mb-1 block text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Importance</label>
              <select
                value={editImportance}
                onChange={(e) => setEditImportance(e.target.value as Note['importance'])}
                className="w-full rounded-xl border border-gray-300 p-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="CRITICAL">Critical</option>
              </select>
            </div>
            <div className="flex-1">
              <label className="mb-1 block text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Due Date</label>
              <input
                type="date"
                value={editDueDate}
                onChange={(e) => setEditDueDate(e.target.value)}
                className="w-full rounded-xl border border-gray-300 p-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
              />
            </div>
          </div>
          <textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            className="w-full rounded-xl border border-gray-300 p-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] resize-y min-h-[100px]"
            placeholder="Write your note here..."
          />
          <div className="flex justify-end gap-2">
            <button
              onClick={() => {
                setEditTitle(note.title);
                setEditContent(note.content || '');
                setEditImportance(note.importance);
                setEditDueDate(note.dueDate ? new Date(note.dueDate).toISOString().slice(0, 10) : '');
                setIsEditing(false);
              }}
              disabled={saving}
              className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-100 transition-colors"
            >
              <X className="h-3.5 w-3.5" /> Cancel
            </button>
            <button
              onClick={handleSaveEdit}
              disabled={saving || !editTitle.trim()}
              className="flex items-center gap-1 rounded-lg bg-[var(--color-accent)] px-3 py-1.5 text-xs font-semibold text-white shadow hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              <Save className="h-3.5 w-3.5" /> {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      ) : (
        note.content && (
          <p className="mt-3 text-sm text-gray-600 whitespace-pre-wrap">{note.content}</p>
        )
      )}

      {!isEditing && (note.checklistItems.length > 0 || note.status !== 'ARCHIVED') && (
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
