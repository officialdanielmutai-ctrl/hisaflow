'use client';

import AiIngestionPanel from '@/components/system/AiIngestionPanel';
import { useRouter } from 'next/navigation';

export default function AiPage() {
  const router = useRouter();

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">AI Ingestion</h1>
      <p className="text-sm text-[var(--color-text-secondary)]">
        Describe what happened and AI will extract the actions.
      </p>
      <AiIngestionPanel onCompleted={() => router.push('/inventory')} />
    </div>
  );
}
