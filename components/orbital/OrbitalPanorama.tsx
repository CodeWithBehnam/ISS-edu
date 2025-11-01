'use client';

import { Suspense } from 'react';

import { GlobeExperience } from './GlobeExperience';
import { GlobeFallback } from './GlobeFallback';
import { TelemetryPanel } from '../ui/TelemetryPanel';
import { useDeviceCapability } from '@/lib/hooks/useDeviceCapability';
import { useTelemetryQuery } from '@/lib/hooks/useTelemetryQuery';

export function OrbitalPanorama() {
  const capability = useDeviceCapability();
  const { data, isLoading, error, refetch } = useTelemetryQuery();

  return (
    <section className="flex flex-1 flex-col gap-4 p-6 md:flex-row">
      <div className="relative flex-1 overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/50 shadow-xl">
        {capability === 'webgl' ? (
          <Suspense fallback={<div className="p-6">Initialising WebGL renderer…</div>}>
            <GlobeExperience telemetry={data ?? null} busy={isLoading} />
          </Suspense>
        ) : (
          <GlobeFallback telemetry={data ?? null} busy={isLoading} />
        )}
        {error ? (
          <div className="absolute inset-x-0 bottom-0 bg-red-950/90 p-4 text-sm text-red-200">
            <p className="font-mono">Telemetry error: {error.message}</p>
            <button
              onClick={() => void refetch()}
              className="mt-2 rounded bg-red-500 px-3 py-1 text-sm text-white hover:bg-red-400"
            >
              Retry
            </button>
          </div>
        ) : null}
      </div>
      <aside className="w-full max-w-md space-y-4">
        <header>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-50">
            Orbital Panorama
          </h1>
          <p className="mt-2 text-sm text-slate-300">
            Live International Space Station telemetry with atmospheric rendering, ground track overlays, and inclusive controls for educators and enthusiasts alike.
          </p>
        </header>
        <TelemetryPanel telemetry={data ?? null} busy={isLoading} capability={capability} />
      </aside>
    </section>
  );
}

