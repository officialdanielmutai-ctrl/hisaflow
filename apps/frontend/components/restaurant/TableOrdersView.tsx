'use client';

import { useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useMyOrganization } from '@/hooks/useMyOrganization';
import { closeTableOrder, type TableOrder } from '@/services/table-orders.service';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Clock, List, Utensils } from 'lucide-react';
import { AddTableItemSheet } from '@/components/restaurant/AddTableItemSheet';

export function TableOrdersView({
  orders,
  onOrderUpdate,
}: {
  orders: TableOrder[];
  onOrderUpdate: () => void;
}) {
  const { getToken } = useAuth();
  const { membership } = useMyOrganization();
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const orgId = membership?.organization.id;

  const handleCloseOrder = async (id: string) => {
    try {
      setLoadingId(id);
      setError('');
      const token = await getToken();
      if (!token || !orgId) throw new Error('Not authenticated');
      await closeTableOrder(id, token, orgId);
      onOrderUpdate();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to close order');
    } finally {
      setLoadingId(null);
    }
  };

  if (!orders || orders.length === 0) {
    return (
      <div className="text-center text-gray-500 py-12">No active table orders.</div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-600">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {orders.map((order) => {
          const timeElapsed =
            new Date().getTime() - new Date(order.openedAt).getTime();
          const minutes = Math.floor(timeElapsed / 60000);
          const items = order.items ?? [];
          const totalItems = items.reduce(
            (sum, item) => sum + Number(item.quantity),
            0,
          );
          const totalAmount = items.reduce(
            (sum, item) =>
              sum + Number(item.quantity) * Number(item.unitPrice),
            0,
          );

          return (
            <Card
              key={order.id}
              className="flex flex-col border-l-4 border-l-blue-500"
            >
              <CardHeader className="pb-2">
                <CardTitle className="flex justify-between items-center text-lg">
                  <div className="flex items-center gap-2">
                    <Utensils className="w-5 h-5 text-gray-500" />
                    {order.tableLabel}
                  </div>
                  <span className="text-sm font-normal text-gray-500 flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    {minutes > 0 ? `${minutes}m` : 'Just now'}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1 pb-4">
                <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
                  <span className="flex items-center gap-1">
                    <List className="w-4 h-4" /> Items
                  </span>
                  <span className="font-semibold">{totalItems}</span>
                </div>
                {items.length > 0 && (
                  <ul className="mb-2 space-y-1 text-xs text-gray-500">
                    {items.map((item) => (
                      <li key={item.id} className="flex justify-between gap-2">
                        <span className="truncate">
                          {item.item?.name ?? 'Item'} × {Number(item.quantity)}
                        </span>
                        <span className="shrink-0">
                          KES{' '}
                          {(
                            Number(item.quantity) * Number(item.unitPrice)
                          ).toLocaleString()}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="flex items-center justify-between text-sm text-gray-600">
                  <span>Total</span>
                  <span className="font-semibold text-lg text-black dark:text-white">
                    KES {totalAmount.toLocaleString()}
                  </span>
                </div>
              </CardContent>
              <CardFooter className="flex gap-2">
                <AddTableItemSheet orderId={order.id} onSuccess={onOrderUpdate}>
                  <Button variant="outline" className="flex-1">
                    Add item
                  </Button>
                </AddTableItemSheet>
                <Button
                  className="flex-1 bg-[var(--color-accent)] hover:bg-[var(--color-accent)]/90"
                  onClick={() => handleCloseOrder(order.id)}
                  disabled={loadingId === order.id}
                >
                  {loadingId === order.id ? 'Closing...' : 'Pay / Close'}
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
