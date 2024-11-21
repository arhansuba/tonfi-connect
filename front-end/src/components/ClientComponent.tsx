// src/components/ClientComponent.tsx
'use client';

import { Skeleton } from '../../components/ui/skeleton';
import { useEffect, useState } from 'react';

export function ClientComponent({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <Skeleton className="h-full w-full" />;
  }

  return <>{children}</>;
}