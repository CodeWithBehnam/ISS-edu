/** Blend factor for an exponential approach at `rate` per second; the same result at any frame rate. */
export function dampingBlend(rate: number, dtSeconds: number): number {
  return 1 - Math.exp(-rate * dtSeconds);
}

/**
 * Turns a per-frame factor tuned at 60 Hz (the way OrbitControls' `dampingFactor` is applied) into
 * the factor for a frame lasting `dtSeconds`, so inertia lasts as long on a 144 Hz screen as on a 30 Hz one.
 */
export function frameFactorFor(factorAt60Hz: number, dtSeconds: number): number {
  return 1 - Math.pow(1 - factorAt60Hz, dtSeconds * 60);
}
