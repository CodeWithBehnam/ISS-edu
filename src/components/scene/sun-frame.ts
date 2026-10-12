import type { LiveTelemetry } from '@/lib/api/iss-telemetry';
import { sunDirectionEcf } from '@/lib/astro/sun';
import { ecfToScene } from '@/lib/orbit/frames';

import type { IssFrame } from './iss-frame';

/**
 * The moment the Sun should be drawn for. With an orbit model the ISS follows the sim clock, so the
 * Sun does too. A live fix cannot be scrubbed, so the Sun stays on the fix's own timestamp: otherwise
 * time travel would swing the terminator while the station stayed put.
 */
export function sunReferenceTime(
  simTime: Date,
  hasOrbitModel: boolean,
  telemetry: LiveTelemetry | null,
): Date {
  return !hasOrbitModel && telemetry !== null ? telemetry.time : simTime;
}

/**
 * The Sun depends on time alone, never on orbit data, so it is written whether or not a TLE or a live
 * fix has arrived. Without this the light would sit at the frame's placeholder (lat 0, lon 0).
 */
export function writeSunDirection(frame: IssFrame, at: Date): void {
  const [x, y, z] = ecfToScene(sunDirectionEcf(at));
  frame.sunDir.set(x, y, z);
}
