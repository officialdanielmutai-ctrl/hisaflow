'use client';

import { useAuth } from '@clerk/nextjs';
import useSWR from 'swr';
import { useMyOrganization } from '@/hooks/useMyOrganization';
import { useRole } from '@/hooks/useRole';
import { getTableOrders, type TableOrder } from '@/services/table-orders.service';
import { TableOrdersView } from '@/components/restaurant/TableOrdersView';
import { OpenTableSheet } from '@/components/restaurant/OpenTableSheet';
import { Button } from '@/components/ui/button';

export default function TableOrdersPage() {
  const { getToken } = useAuth();
  const { membership } = useMyOrganization();
  const { isRestaurant } = useRole();
  const orgId = membership?.organization.id;

  const { data: orders, isLoading, error, mutate } = useSWR<TableOrder[]>(
    isRestaurant && orgId ? ['table-orders', orgId] : null,
    async () => {
      const token = await getToken();
      if (!token || !orgId) throw new Error('Not authenticated');
      return getTableOrders(token, orgId);
    },
  );

  if (!isRestaurant) {
    return (
      <div className="p-8 text-center text-red-500 font-semibold text-lg">
        Access Denied
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div
        className="flex items-center justify-between mb-6"
        data-walkthrough="feature-tables"
      >
        <h1 className="text-2xl font-bold">Table Orders</h1>
        <OpenTableSheet onOpenSuccess={() => mutate()}>
          <Button>New Order</Button>
        </OpenTableSheet>
      </div>

      {isLoading ? (
        <div className="text-center text-gray-500 py-12">Loading orders...</div>
      ) : error ? (
        <div className="text-center text-red-500 py-12">
          {error instanceof Error ? error.message : 'Failed to load table orders'}
        </div>
      ) : (
        <TableOrdersView orders={orders ?? []} onOrderUpdate={() => mutate()} />
      )}
    </div>
  );
}
