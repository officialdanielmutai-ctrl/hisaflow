'use client';

import { useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useMyOrganization } from '@/hooks/useMyOrganization';
import { createTableOrder } from '@/services/table-orders.service';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface OpenTableSheetProps {
  children: React.ReactNode;
  onOpenSuccess: () => void;
}

export function OpenTableSheet({
  children,
  onOpenSuccess,
}: OpenTableSheetProps) {
  const { getToken } = useAuth();
  const { membership } = useMyOrganization();
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const orgId = membership?.organization.id;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError('');
      const token = await getToken();
      if (!token || !orgId) throw new Error('Not authenticated');

      await createTableOrder(
        { tableLabel: label.trim(), notes: notes.trim() || undefined },
        token,
        orgId,
      );

      setOpen(false);
      setLabel('');
      setNotes('');
      onOpenSuccess();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{children}</SheetTrigger>
      <SheetContent className="bg-[#FAFAFA]">
        <SheetHeader>
          <SheetTitle>Open New Table</SheetTitle>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="space-y-6 mt-6">
          {error && <div className="text-red-500 text-sm">{error}</div>}

          <div className="space-y-2">
            <Label htmlFor="table-label">Table Label</Label>
            <Input
              id="table-label"
              placeholder="e.g. Table 4"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="table-notes">Notes (Optional)</Label>
            <Input
              id="table-notes"
              placeholder="e.g. Near window"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <Button
            type="submit"
            className="w-full bg-[var(--color-accent)] hover:bg-[var(--color-accent)]/90 text-white"
            disabled={loading || !label.trim()}
          >
            {loading ? 'Opening...' : 'Open Table'}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
