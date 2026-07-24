'use client';

import { SWRConfig } from 'swr';

export default function SWRProvider({ children }: { children: React.ReactNode }) {
  return (
    <SWRConfig
      value={{
        // ── Global Performance Settings ──────────────────────────────
        // keepPreviousData: true is the magic bullet for white screens.
        // It ensures that when SWR keys change (e.g., navigating pages), 
        // the previous data is kept on screen until the new data arrives, 
        // preventing the UI from flashing back to loading skeletons.
        keepPreviousData: true,
        
        // Prevent aggressive refetching that causes flashes
        revalidateOnFocus: false,
        
        // If a component mounts and asks for data we fetched <30s ago, 
        // just use the cache. Don't hit the network again.
        dedupingInterval: 30000,
      }}
    >
      {children}
    </SWRConfig>
  );
}
