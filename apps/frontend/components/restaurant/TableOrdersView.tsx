"use client";

import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clock, DollarSign, List, Utensils } from "lucide-react";

interface TableOrder {
  id: string;
  tableLabel: string;
  totalItems: number;
  totalAmount: number;
  openedAt: string;
}

export function TableOrdersView({ orders, onOrderUpdate }: { orders: TableOrder[], onOrderUpdate: () => void }) {
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const handleCloseOrder = async (id: string) => {
    try {
      setLoadingId(id);
      const res = await fetch(`/api/table-orders/${id}/close`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to close order");
      onOrderUpdate();
    } catch (err: any) {
      alert(err.message || "Failed to close order");
    } finally {
      setLoadingId(null);
    }
  };

  if (!orders || orders.length === 0) {
    return <div className="text-center text-gray-500 py-12">No active table orders.</div>;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {orders.map((order) => {
        const timeElapsed = new Date().getTime() - new Date(order.openedAt).getTime();
        const minutes = Math.floor(timeElapsed / 60000);

        return (
          <Card key={order.id} className="flex flex-col border-l-4 border-l-blue-500">
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
                <span className="flex items-center gap-1"><List className="w-4 h-4" /> Items</span>
                <span className="font-semibold">{order.totalItems}</span>
              </div>
              <div className="flex items-center justify-between text-sm text-gray-600">
                <span className="flex items-center gap-1"><DollarSign className="w-4 h-4" /> Total</span>
                <span className="font-semibold text-lg text-black dark:text-white">
                  ${Number(order.totalAmount || 0).toFixed(2)}
                </span>
              </div>
            </CardContent>
            <CardFooter>
              <Button 
                className="w-full bg-[var(--color-accent)] hover:bg-[var(--color-accent)]/90" 
                onClick={() => handleCloseOrder(order.id)}
                disabled={loadingId === order.id}
              >
                {loadingId === order.id ? "Closing..." : "Pay / Close"}
              </Button>
            </CardFooter>
          </Card>
        );
      })}
    </div>
  );
}
