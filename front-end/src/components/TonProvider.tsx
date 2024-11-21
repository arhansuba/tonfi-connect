// src/components/TonProvider.tsx
'use client';

import { TonConnectUIProvider } from '@tonconnect/ui-react';
import { PropsWithChildren } from 'react';
import { useClientSide } from '@/hooks/useClientSide';

const manifestUrl = process.env.NEXT_PUBLIC_MANIFEST_URL || '/tonconnect-manifest.json';

export function TonProvider({ children }: PropsWithChildren) {
  const isClient = useClientSide();

  if (!isClient) {
    return <>{children}</>;
  }

  return (
    <TonConnectUIProvider manifestUrl={manifestUrl}>
      {children}
    </TonConnectUIProvider>
  );
}