/**
 * Orbit Trail component showing past and future ground tracks.
 * Samples orbit using SGP4 propagation with IDL handling.
 */

'use client';

import { useMemo, Suspense } from 'react';
import { Line } from '@react-three/drei';
import { latLonToVector3 } from '../../lib/lib/geoutils';
import { sampleOrbitTrack, breakTrackAtIdl } from '../../lib/lib/propagation';
import type { TLEState } from '../../lib/api/tle';

interface OrbitTrailProps {
  tle: TLEState | null;
  currentTime: Date;
  windowMinutes: number; // ±90 minutes default
  kind: 'past' | 'future';
  earthRadius: number;
  reducedMotion?: boolean;
}

export function OrbitTrail({
  tle,
  currentTime,
  windowMinutes,
  kind,
  earthRadius,
  reducedMotion = false,
}: OrbitTrailProps) {
  const segments = useMemo(() => {
    if (!tle) return [];

    const startTime = new Date(currentTime);
    const endTime = new Date(currentTime);

    if (kind === 'past') {
      startTime.setMinutes(startTime.getMinutes() - windowMinutes);
    } else {
      endTime.setMinutes(endTime.getMinutes() + windowMinutes);
    }

    const stepSeconds = reducedMotion ? 60 : 15;
    const points = sampleOrbitTrack(tle.tle, startTime, endTime, stepSeconds);
    const brokenSegments = breakTrackAtIdl(points);

    return brokenSegments.map((segment) =>
      segment.map((p) =>
        latLonToVector3(
          p.position.latitude,
          p.position.longitude,
          earthRadius + p.position.altitudeKm / 6371
        )
      )
    );
  }, [tle, currentTime, windowMinutes, kind, earthRadius, reducedMotion]);

  if (!tle || segments.length === 0) return null;

  const trailColour = kind === 'past' ? '#64748b' : '#38bdf8';
  const opacity = kind === 'past' ? 0.4 : 0.7;

  return (
    <Suspense fallback={null}>
      {segments.map((segment, idx) => (
        <Line
          key={`${kind}-${idx}`}
          points={segment}
          color={trailColour}
          lineWidth={2}
          opacity={opacity}
          transparent
        />
      ))}
    </Suspense>
  );
}
