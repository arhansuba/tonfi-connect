// src/components/TonProvider.tsx
'use client';

import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';
import { PropsWithChildren } from 'react';

// Dynamically import TonConnectUIProvider with no SSR
const TonConnectUIProvider = dynamic(
  () => import('@tonconnect/ui-react').then(mod => mod.TonConnectUIProvider),
  { 
    ssr: false,
    loading: () => <Skeleton className="h-full w-full" />
  }
);

const manifestUrl = process.env.NEXT_PUBLIC_MANIFEST_URL || '/tonconnect-manifest.json';

export function TonProvider({ children }: PropsWithChildren) {
  // Ensure this check is correctly handling SSR
  if (typeof window === 'undefined') {
    return <>{children}</>;
  }

  return (
    <TonConnectUIProvider manifestUrl={manifestUrl}>
      {children}
    </TonConnectUIProvider>
  );
}