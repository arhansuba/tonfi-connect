// src/components/TonClientWrapper.tsx
'use client';

import { useTonConnectUI } from '@tonconnect/ui-react';
import { PropsWithChildren, useEffect, useState } from 'react';

export function TonClientWrapper({ children }: PropsWithChildren) {
  const [mounted, setMounted] = useState(false);
  const [tonConnectUI] = useTonConnectUI();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="h-screen w-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
      </div>
    );
  }

  return <>{children}</>;
}