'use client';

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import type { DailyFinancialPoint } from '@/services/finance.service';

interface RevenueChartProps {
  data: DailyFinancialPoint[];
  currency?: string;
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-KE', { month: 'short', day: 'numeric' });
}

function formatKES(value: number) {
  return `KES ${value.toLocaleString('en-KE', { maximumFractionDigits: 0 })}`;
}

export default function RevenueChart({ data, currency = 'KES' }: RevenueChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-40 text-sm text-[var(--color-text-secondary)]">
        No transaction data yet. Sales will appear here once recorded.
      </div>
    );
  }

  const chartData = data.map((d) => ({
    ...d,
    date: formatDate(d.date),
  }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
          width={36}
        />
        <Tooltip
          formatter={(value: any, name: any) => [
            formatKES(Number(value)),
            name === 'revenue' ? 'Revenue' : name === 'profit' ? 'Profit' : 'COGS',
          ]}
          contentStyle={{
            borderRadius: 12,
            border: '1px solid var(--color-border)',
            background: 'var(--color-bg-surface)',
            fontSize: 12,
          }}
        />
        <Legend
          iconType="circle"
          iconSize={8}
          formatter={(v) =>
            v === 'revenue' ? 'Revenue' : v === 'profit' ? 'Profit' : 'Cost'
          }
          wrapperStyle={{ fontSize: 11 }}
        />
        <Line
          type="monotone"
          dataKey="revenue"
          stroke="#6366f1"
          strokeWidth={2.5}
          dot={false}
          activeDot={{ r: 4 }}
        />
        <Line
          type="monotone"
          dataKey="profit"
          stroke="#22c55e"
          strokeWidth={2.5}
          dot={false}
          activeDot={{ r: 4 }}
        />
        <Line
          type="monotone"
          dataKey="cogs"
          stroke="#f97316"
          strokeWidth={1.5}
          dot={false}
          strokeDasharray="4 3"
          activeDot={{ r: 3 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
