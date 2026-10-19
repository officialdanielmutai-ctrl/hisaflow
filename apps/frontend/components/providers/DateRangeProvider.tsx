'use client';

import React, { createContext, useContext, useState, useMemo, useCallback } from 'react';

export type DateRangePreset = 'today' | '7d' | '30d' | 'month' | 'year';

export interface DateRangeState {
  preset: DateRangePreset;
  label: string;
  startDate: Date;
  endDate: Date;
}

interface DateRangeContextValue extends DateRangeState {
  setPreset: (preset: DateRangePreset) => void;
  setCustomRange: (start: Date, end: Date) => void;
}

const DateRangeContext = createContext<DateRangeContextValue | null>(null);

function calculateRange(preset: DateRangePreset): { startDate: Date; endDate: Date; label: string } {
  const end = new Date();
  const start = new Date();

  switch (preset) {
    case 'today':
      start.setHours(0, 0, 0, 0);
      return { startDate: start, endDate: end, label: 'Today' };
    case '7d':
      start.setDate(end.getDate() - 7);
      start.setHours(0, 0, 0, 0);
      return { startDate: start, endDate: end, label: 'Last 7 Days' };
    case '30d':
      start.setDate(end.getDate() - 30);
      start.setHours(0, 0, 0, 0);
      return { startDate: start, endDate: end, label: 'Last 30 Days' };
    case 'month':
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      return {
        startDate: start,
        endDate: end,
        label: start.toLocaleDateString('en-KE', { month: 'short', year: 'numeric' }),
      };
    case 'year':
      start.setMonth(0, 1);
      start.setHours(0, 0, 0, 0);
      return {
        startDate: start,
        endDate: end,
        label: `${start.getFullYear()}`,
      };
    default:
      return { startDate: start, endDate: end, label: 'Today' };
  }
}

export function DateRangeProvider({ children }: { children: React.ReactNode }) {
  const [preset, setPresetState] = useState<DateRangePreset>('today');
  const [customRange, setCustomRangeState] = useState<{ startDate: Date; endDate: Date; label: string } | null>(null);

  const currentRange = useMemo(() => {
    if (customRange) return customRange;
    return calculateRange(preset);
  }, [preset, customRange]);

  const setPreset = useCallback((nextPreset: DateRangePreset) => {
    setCustomRangeState(null);
    setPresetState(nextPreset);
  }, []);

  const setCustomRange = useCallback((startDate: Date, endDate: Date) => {
    const startStr = startDate.toLocaleDateString('en-KE', { day: 'numeric', month: 'short' });
    const endStr = endDate.toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' });
    setCustomRangeState({
      startDate,
      endDate,
      label: `${startStr} - ${endStr}`,
    });
  }, []);

  const value = useMemo<DateRangeContextValue>(
    () => ({
      preset,
      label: currentRange.label,
      startDate: currentRange.startDate,
      endDate: currentRange.endDate,
      setPreset,
      setCustomRange,
    }),
    [preset, currentRange, setPreset, setCustomRange],
  );

  return <DateRangeContext.Provider value={value}>{children}</DateRangeContext.Provider>;
}

export function useDateRange(): DateRangeContextValue {
  const ctx = useContext(DateRangeContext);
  if (!ctx) {
    // Graceful fallback if used outside provider
    const fallback = calculateRange('today');
    return {
      preset: 'today',
      label: fallback.label,
      startDate: fallback.startDate,
      endDate: fallback.endDate,
      setPreset: () => {},
      setCustomRange: () => {},
    };
  }
  return ctx;
}
