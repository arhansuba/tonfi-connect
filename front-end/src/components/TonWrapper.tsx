// src/components/TonWrapper.tsx
'use client';

import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';

const TonConnectUIProvider = dynamic(
  () => import('@tonconnect/ui-react').then((mod) => mod.TonConnectUIProvider),
  { 
    ssr: false,
    loading: () => <Skeleton className="h-full w-full" />
  }
);

export function TonWrapper({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <Skeleton className="h-full w-full" />;
  }

  return (
    <TonConnectUIProvider>
      {children}
    </TonConnectUIProvider>
  );
}