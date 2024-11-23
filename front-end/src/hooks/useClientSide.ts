// src/hooks/useClientSide.ts
'use client';

import { useEffect, useState } from 'react';

export function useClientSide() {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  return isClient;
}