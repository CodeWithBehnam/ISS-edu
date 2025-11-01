'use client';

import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import type { DeviceCapability } from '@/lib/hooks/useDeviceCapability';
import type { TelemetryState } from '@/lib/types/telemetry';

dayjs.extend(relativeTime);

interface TelemetryPanelProps {
  telemetry: TelemetryState | null;
  busy: boolean;
  capability: DeviceCapability;
}

export function TelemetryPanel({ telemetry, busy, capability }: TelemetryPanelProps) {
  if (!telemetry) {
    return (
      <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6 shadow-inner">
        <p className="text-slate-300">Awaiting telemetry…</p>
      </div>
    );
  }

  const {
    envelope: { data, receivedAt, cacheStatus },
    drift,
  } = telemetry;

  const hasValidDrift = drift != null && 
    drift.deltaAltitudeKm != null &&
    drift.deltaVelocityKps != null &&
    drift.deltaGreatCircleKm != null &&
    typeof drift.deltaAltitudeKm === 'number' &&
    typeof drift.deltaVelocityKps === 'number' &&
    typeof drift.deltaGreatCircleKm === 'number' &&
    !Number.isNaN(drift.deltaAltitudeKm) &&
    !Number.isNaN(drift.deltaVelocityKps) &&
    !Number.isNaN(drift.deltaGreatCircleKm);

  return (
    <div className="space-y-4 rounded-3xl border border-slate-800 bg-slate-900/60 p-6 shadow-inner">
      <div className="flex items-center justify-between text-xs text-slate-400">
        <span>{busy ? 'Refreshing' : 'Live'} via {data.source}</span>
        <span>{dayjs(receivedAt).fromNow()}</span>
      </div>

      <dl className="grid grid-cols-2 gap-4 text-sm">
        <Stat label="Latitude" value={`${data.latitude.toFixed(2)}°`} />
        <Stat label="Longitude" value={`${data.longitude.toFixed(2)}°`} />
        <Stat label="Altitude" value={Number.isNaN(data.altitudeKm) ? 'N/A' : `${data.altitudeKm.toFixed(1)} km`} />
        <Stat label="Velocity" value={Number.isNaN(data.velocityKps) ? 'N/A' : `${data.velocityKps.toFixed(2)} km/s`} />
        <Stat label="Footprint" value={Number.isNaN(data.footprintKm) ? 'N/A' : `${data.footprintKm.toFixed(0)} km`} />
        <Stat label="Visibility" value={data.visibility} />
      </dl>

      {hasValidDrift ? (
        <div className="rounded-2xl border border-amber-400/40 bg-amber-500/10 p-4 text-xs text-amber-200">
          <p className="font-semibold text-amber-100">Drift monitor</p>
          <p className="mt-2 font-mono">
            Δ altitude {drift!.deltaAltitudeKm.toFixed(2)} km · Δ velocity {drift!.deltaVelocityKps.toFixed(3)} km/s
          </p>
          <p className="font-mono">Δ ground track {drift!.deltaGreatCircleKm.toFixed(2)} km vs {drift!.referenceSource}</p>
        </div>
      ) : null}

      <div className="rounded-2xl bg-slate-800/70 p-4 text-xs text-slate-300">
        <p>Rendering mode: {capability === 'webgl' ? '3D WebGL scene' : '2D canvas fallback'}.</p>
        <p className="mt-1 text-slate-400">Cache status: {cacheStatus}</p>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-800/60 p-3">
      <dt className="text-xs uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="mt-1 font-mono text-base text-slate-100">{value}</dd>
    </div>
  );
}

