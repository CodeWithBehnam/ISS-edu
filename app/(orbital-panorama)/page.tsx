import { Suspense } from 'react';

import { OrbitalPanorama } from '@/components/orbital/OrbitalPanorama';

export default function OrbitalPanoramaPage() {
  return (
    <main className="flex min-h-screen flex-col">
      <Suspense fallback={<div className="p-8 text-slate-300">Loading orbital panorama…</div>}>
        <OrbitalPanorama />
      </Suspense>
    </main>
  );
}

