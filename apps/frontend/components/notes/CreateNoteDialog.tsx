'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { createNote, NoteImportance } from '@/services/notes.service';
import { useAuth } from '@clerk/nextjs';

export default function CreateNoteDialog({
  isOpen,
  onClose,
  orgId,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  orgId: string;
  onSuccess: () => void;
}) {
  const { getToken } = useAuth();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [importance, setImportance] = useState<NoteImportance>('MEDIUM');
  const [dueDate, setDueDate] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setLoading(true);
    try {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');

      await createNote(token, orgId, {
        title: title.trim(),
        content: content.trim() || undefined,
        importance,
        dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
      });

      setTitle('');
      setContent('');
      setImportance('MEDIUM');
      setDueDate('');
      onSuccess();
      onClose();
    } catch (err) {
      console.error(err);
      alert('Failed to create note');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold">New Note</h2>
          <button onClick={onClose} className="rounded-full p-2 text-gray-400 hover:bg-gray-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Title</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-xl border p-3 focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
              placeholder="e.g. Server maintenance tomorrow"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Details (optional)</label>
            <textarea
              rows={3}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full rounded-xl border p-3 focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
              placeholder="Any additional info..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Importance</label>
              <select
                value={importance}
                onChange={(e) => setImportance(e.target.value as NoteImportance)}
                className="w-full rounded-xl border p-3 focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] bg-white"
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="CRITICAL">Critical</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Due Date (optional)</label>
              <input
                type="datetime-local"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full rounded-xl border p-3 focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] bg-white"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !title.trim()}
            className="mt-2 h-12 w-full rounded-xl bg-[var(--color-accent)] font-semibold text-white disabled:opacity-50"
          >
            {loading ? 'Creating...' : 'Create Note'}
          </button>
        </form>
      </div>
    </div>
  );
}
