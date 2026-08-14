"use client";

import { useEffect, useState } from "react";
import { TableOrdersView } from "@/components/restaurant/TableOrdersView";
import { OpenTableSheet } from "@/components/restaurant/OpenTableSheet";
import { Button } from "@/components/ui/button";
import { useRole } from "@/hooks/useRole"; // Assumed path

export default function TableOrdersPage() {
  const { isRestaurant } = useRole();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/table-orders");
      if (!res.ok) throw new Error("Failed to fetch table orders");
      const data = await res.json();
      setOrders(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isRestaurant) {
      fetchOrders();
    }
  }, [isRestaurant]);

  if (!isRestaurant) {
    return <div className="p-8 text-center text-red-500 font-semibold text-lg">Access Denied</div>;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Table Orders</h1>
        <OpenTableSheet onOpenSuccess={fetchOrders}>
          <Button>New Order</Button>
        </OpenTableSheet>
      </div>

      {loading ? (
        <div className="text-center text-gray-500 py-12">Loading orders...</div>
      ) : error ? (
        <div className="text-center text-red-500 py-12">{error}</div>
      ) : (
        <TableOrdersView orders={orders} onOrderUpdate={fetchOrders} />
      )}
    </div>
  );
}
