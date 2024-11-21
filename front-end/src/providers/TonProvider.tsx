// src/providers/TonProvider.tsx
'use client';

import dynamic from 'next/dynamic';
import { PropsWithChildren } from 'react';

// Dynamically import TonConnectUIProvider with no SSR
const TonConnectUIProvider = dynamic(
  () => import('@tonconnect/ui-react').then(mod => mod.TonConnectUIProvider),
  { ssr: false }
);

const manifestUrl = process.env.NEXT_PUBLIC_MANIFEST_URL || '/tonconnect-manifest.json';

export function TonProvider({ children }: PropsWithChildren) {
  if (typeof window === 'undefined') {
    return <>{children}</>;
  }

  return (
    <TonConnectUIProvider manifestUrl={manifestUrl}>
      {children}
    </TonConnectUIProvider>
  );
}