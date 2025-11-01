export type TelemetrySource =
  | 'where-iss-at'
  | 'open-notify'
  | 'nasa-ephemeris'
  | 'sgp4-fallback';

export interface IssTelemetry {
  timestamp: string; // ISO 8601 string
  latitude: number;
  longitude: number;
  altitudeKm: number;
  velocityKps: number;
  visibility: 'daylight' | 'twilight' | 'night';
  footprintKm: number;
  source: TelemetrySource;
}

export interface TelemetryEnvelope {
  data: IssTelemetry;
  receivedAt: string;
  upstreamLatencyMs: number | null;
  cacheStatus: 'hit' | 'miss' | 'stale';
}

export interface TelemetryDrift {
  deltaAltitudeKm: number;
  deltaVelocityKps: number;
  deltaGreatCircleKm: number;
  referenceSource: TelemetrySource;
}

export interface TelemetryState {
  envelope: TelemetryEnvelope;
  drift?: TelemetryDrift;
}

export interface UpstreamResponse<T> {
  data: T | null;
  error?: string;
  fetchedAt: string;
  latencyMs?: number;
}

