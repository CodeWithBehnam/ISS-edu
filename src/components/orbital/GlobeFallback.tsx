

import type { TelemetryState } from '@/lib/types/telemetry';

interface GlobeFallbackProps {
  telemetry: TelemetryState | null;
  busy: boolean;
}

export function GlobeFallback({ telemetry, busy }: GlobeFallbackProps) {
  const latitude = telemetry?.envelope.data.latitude ?? 0;
  const longitude = telemetry?.envelope.data.longitude ?? 0;

  return (
    <div className="flex h-[72vh] min-h-[360px] w-full flex-col items-center justify-center gap-6 bg-gradient-to-br from-sky-100 via-white to-cyan-100 md:h-[80vh] md:min-h-[420px]">
      <svg
        role="presentation"
        className="h-64 w-64 text-sky-400"
        viewBox="0 0 200 200"
        aria-hidden
      >
        <circle cx="100" cy="100" r="80" className="fill-white/90 drop-shadow" />
        <circle cx="100" cy="100" r="79" className="fill-none stroke-sky-300" strokeDasharray="4 8" />
        <line
          x1="100"
          y1="20"
          x2="100"
          y2="180"
          className="stroke-sky-200"
          strokeWidth="0.5"
        />
        <line
          x1="20"
          y1="100"
          x2="180"
          y2="100"
          className="stroke-sky-200"
          strokeWidth="0.5"
        />
        <circle cx={mapLongitude(longitude)} cy={mapLatitude(latitude)} r="6" className="fill-sky-500 drop-shadow-md" />
      </svg>

      <div className="text-center text-sm text-slate-600">
        <p>WebGL is unavailable; rendering simplified map view.</p>
        <p className="mt-2 font-mono text-xs text-slate-500">
          {busy ? 'Updating telemetry…' : `Lat ${latitude.toFixed(2)}, Lon ${longitude.toFixed(2)}`}
        </p>
      </div>
    </div>
  );
}

function mapLatitude(lat: number) {
  const normalised = 1 - (lat + 90) / 180;
  return 20 + normalised * 160;
}

function mapLongitude(lon: number) {
  const normalised = (lon + 180) / 360;
  return 20 + normalised * 160;
}
