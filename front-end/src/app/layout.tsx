// src/app/layout.tsx
import '@/app/globals.css';
import type { Metadata } from 'next';
import { TonWrapper } from '@/components/TonWrapper';

export const metadata: Metadata = {
  title: 'TONFi',
  description: 'TON DeFi Platform',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <TonWrapper>
          {children}
        </TonWrapper>
      </body>
    </html>
  );
}