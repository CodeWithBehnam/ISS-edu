/**
 * ISS Marker component with subtle bob animation.
 * Shows current ISS position with springy easing.
 */

'use client';

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { a, useSpring } from '@react-spring/three';
import { Mesh, Vector3 } from 'three';
import { latLonToVector3 } from '../../lib/lib/geoutils';
import type { IssTelemetry } from '../../lib/types/telemetry';

interface IssMarkerProps {
  telemetry: IssTelemetry | null;
  earthRadius: number;
  reducedMotion?: boolean;
}

export function IssMarker({ telemetry, earthRadius, reducedMotion = false }: IssMarkerProps) {
  const meshRef = useRef<Mesh>(null);
  const positionRef = useRef<Vector3>(new Vector3());

  const position = useMemo(() => {
    if (!telemetry) return null;
    return latLonToVector3(
      telemetry.latitude,
      telemetry.longitude,
      earthRadius + telemetry.altitudeKm / 6371 // Scale altitude to globe units
    );
  }, [telemetry, earthRadius]);

  // Spring animation for bob effect (subtle scale oscillation)
  const { scale } = useSpring({
    from: { scale: 1.0 },
    to: async (next) => {
      while (true) {
        await next({ scale: 1.03 });
        await next({ scale: 1.0 });
      }
    },
    config: { tension: 100, friction: 50 },
    pause: reducedMotion,
  });

  // Smooth position interpolation
  useFrame(() => {
    if (!meshRef.current || !position) return;

    if (reducedMotion) {
      meshRef.current.position.copy(position);
    } else {
      // Smooth interpolation
      positionRef.current.lerp(position, 0.15);
      meshRef.current.position.copy(positionRef.current);
    }
  });

  if (!position) return null;

  return (
    <a.mesh ref={meshRef} position={position} scale={scale}>
      {/* ISS sprite - simple sphere with glow */}
      <sphereGeometry args={[0.06, 16, 16]} />
      <meshStandardMaterial
        color="#f1f5f9"
        emissive="#38bdf8"
        emissiveIntensity={1.2}
      />
      {/* Velocity vector indicator (small trail) */}
      {telemetry && (
        <group>
          <mesh position={[0, 0, 0.15]}>
            <sphereGeometry args={[0.02, 8, 8]} />
            <meshStandardMaterial color="#60a5fa" emissiveIntensity={0.5} />
          </mesh>
        </group>
      )}
    </a.mesh>
  );
}
