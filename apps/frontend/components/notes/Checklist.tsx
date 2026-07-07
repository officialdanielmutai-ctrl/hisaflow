'use client';

import { useState } from 'react';
import { CheckCircle2, Circle, Trash2, Plus } from 'lucide-react';
import { ChecklistItem, toggleChecklistItem, deleteChecklistItem, addChecklistItem } from '@/services/notes.service';
import { useAuth } from '@clerk/nextjs';

export default function Checklist({
  items,
  noteId,
  orgId,
  onUpdate,
}: {
  items: ChecklistItem[];
  noteId: string;
  orgId: string;
  onUpdate: () => void;
}) {
  const { getToken } = useAuth();
  const [newItemText, setNewItemText] = useState('');
  const [loading, setLoading] = useState<string | null>(null);

  const handleToggle = async (itemId: string) => {
    try {
      setLoading(itemId);
      const token = await getToken();
      if (token) {
        await toggleChecklistItem(itemId, token, orgId);
        onUpdate();
      }
    } finally {
      setLoading(null);
    }
  };

  const handleDelete = async (itemId: string) => {
    try {
      setLoading(itemId);
      const token = await getToken();
      if (token) {
        await deleteChecklistItem(itemId, token, orgId);
        onUpdate();
      }
    } finally {
      setLoading(null);
    }
  };

  const handleAdd = async () => {
    if (!newItemText.trim()) return;
    try {
      setLoading('add');
      const token = await getToken();
      if (token) {
        await addChecklistItem(noteId, newItemText.trim(), token, orgId);
        setNewItemText('');
        onUpdate();
      }
    } finally {
      setLoading(null);
    }
  };

  const progress = items.length
    ? Math.round((items.filter((i) => i.isCompleted).length / items.length) * 100)
    : 0;

  return (
    <div className="mt-4 flex flex-col gap-2">
      {items.length > 0 && (
        <div className="mb-2 flex items-center justify-between text-xs text-gray-500">
          <span>{progress}% completed</span>
          <div className="h-1.5 w-24 overflow-hidden rounded-full bg-gray-200">
            <div
              className="h-full bg-green-500 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {items.map((item) => (
        <div
          key={item.id}
          className={`flex items-center gap-3 rounded-lg border p-2 transition-colors ${
            item.isCompleted ? 'bg-gray-50 opacity-60' : 'bg-white'
          }`}
        >
          <button
            onClick={() => handleToggle(item.id)}
            disabled={loading === item.id}
            className="text-gray-400 hover:text-green-500 disabled:opacity-50"
          >
            {item.isCompleted ? (
              <CheckCircle2 className="h-5 w-5 text-green-500" />
            ) : (
              <Circle className="h-5 w-5" />
            )}
          </button>
          <span
            className={`flex-1 text-sm ${
              item.isCompleted ? 'line-through text-gray-500' : 'text-gray-800'
            }`}
          >
            {item.text}
          </span>
          <button
            onClick={() => handleDelete(item.id)}
            disabled={loading === item.id}
            className="text-gray-300 hover:text-red-500 disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ))}

      <div className="flex items-center gap-2 mt-1">
        <input
          type="text"
          value={newItemText}
          onChange={(e) => setNewItemText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          placeholder="Add an item..."
          className="flex-1 rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
        />
        <button
          onClick={handleAdd}
          disabled={loading === 'add' || !newItemText.trim()}
          className="rounded-lg bg-[var(--color-accent)] p-2 text-white disabled:opacity-50"
        >
          <Plus className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
