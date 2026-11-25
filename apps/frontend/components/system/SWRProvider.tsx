'use client';

import { SWRConfig } from 'swr';

export default function SWRProvider({ children }: { children: React.ReactNode }) {
  return (
    <SWRConfig
      value={{
        // Never leave stale numbers from a previous range or organisation on
        // screen while a new query loads (hisaflow-data-integrity-brief.md §4.3).
        keepPreviousData: false,
        revalidateOnFocus: false,
        dedupingInterval: 15000,
      }}
    >
      {children}
    </SWRConfig>
  );
}
