import '@/styles/globals.css';

import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Inter, IBM_Plex_Mono } from 'next/font/google';

import { QueryProvider } from '@/components/providers/QueryProvider';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-ibmplexmono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Orbital Learning Hub',
  description:
    'Live International Space Station telemetry paired with narrative-rich learning modules.',
  metadataBase: new URL('https://orbital-learning-hub.example'),
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${plexMono.variable}`}>
      <body className="min-h-screen bg-slate-950 text-slate-100">
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}

