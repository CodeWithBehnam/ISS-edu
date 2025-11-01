'use client';

import { useFrame } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import { Fragment, Suspense, forwardRef, useImperativeHandle, useMemo, useRef } from 'react';
import { Color, Group, Vector3 } from 'three';

import type { TelemetryState } from '@/lib/types/telemetry';

export interface GlobeSceneProps {
  telemetry: TelemetryState | null;
  showGroundTrack: boolean;
  showCityLights: boolean;
  showTerminator: boolean;
  showAurora: boolean;
  autoRotate: boolean;
}

const EARTH_RADIUS_UNITS = 1.2;

// Public Earth texture from NASA Visible Earth
const EARTH_TEXTURE_URL = 'https://cdn.jsdelivr.net/npm/three-globe@2.28.0/example/img/earth-blue-marble.jpg';
const EARTH_NIGHT_LIGHTS_URL = 'https://cdn.jsdelivr.net/npm/three-globe@2.28.0/example/img/earth-night.jpg';

function EarthMesh({
  showCityLights,
}: {
  showCityLights: boolean;
}) {
  const [earthDayTexture, earthNightTexture] = useTexture([
    EARTH_TEXTURE_URL,
    EARTH_NIGHT_LIGHTS_URL,
  ]);

  return (
    <mesh castShadow receiveShadow>
      <sphereGeometry args={[EARTH_RADIUS_UNITS, 64, 64]} />
      <meshStandardMaterial
        map={earthDayTexture}
        emissiveMap={showCityLights ? earthNightTexture : null}
        emissiveIntensity={showCityLights ? 0.35 : 0}
        roughness={0.8}
        metalness={0.1}
      />
    </mesh>
  );
}

export type GlobeSceneHandle = {
  resetOrientation: () => void;
};

export const GlobeScene = forwardRef<GlobeSceneHandle, GlobeSceneProps>(function GlobeScene(
  {
    telemetry,
    showGroundTrack,
    showCityLights,
    showTerminator,
    showAurora,
    autoRotate,
  },
  ref,
) {
  const globeGroupRef = useRef<Group | null>(null);

  useFrame((_, delta) => {
    if (autoRotate && globeGroupRef.current) {
      globeGroupRef.current.rotation.y += delta * 0.12;
    }
  });

  const issPosition = useMemo(() => {
    if (!telemetry) return null;
    const { latitude, longitude } = telemetry.envelope.data;
    return latLonToVector3(latitude, longitude, EARTH_RADIUS_UNITS + 0.05);
  }, [telemetry]);

  useImperativeHandle(
    ref,
    () => ({
      resetOrientation: () => {
        if (globeGroupRef.current) {
          globeGroupRef.current.rotation.set(0, 0, 0);
        }
      },
    }),
    [],
  );

  return (
    <group>
      <hemisphereLight intensity={0.15} groundColor={new Color('#0f172a')} />
      <directionalLight
        position={new Vector3(5, 2, 2)}
        intensity={1.2}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
      />

      <group ref={globeGroupRef}>
        <Suspense
          fallback={
            <mesh castShadow receiveShadow>
              <sphereGeometry args={[EARTH_RADIUS_UNITS, 64, 64]} />
              <meshStandardMaterial color={new Color('#1b335f')} roughness={0.8} metalness={0.1} />
            </mesh>
          }
        >
          <EarthMesh showCityLights={showCityLights} />
        </Suspense>

        {telemetry ? (
          <Fragment>
            <IssMarker position={issPosition} />
            {showGroundTrack ? (
              <GroundTrack
                latitude={telemetry.envelope.data.latitude}
                longitude={telemetry.envelope.data.longitude}
              />
            ) : null}
          </Fragment>
        ) : null}

        {showTerminator ? <Terminator /> : null}
        {showAurora ? <AuroraBelt /> : null}
        <Atmosphere glowColour="#38bdf8" radius={EARTH_RADIUS_UNITS} />
      </group>
    </group>
  );
});

function latLonToVector3(lat: number, lon: number, radius: number): Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);

  const x = -radius * Math.sin(phi) * Math.cos(theta);
  const z = radius * Math.sin(phi) * Math.sin(theta);
  const y = radius * Math.cos(phi);

  return new Vector3(x, y, z);
}

function IssMarker({ position }: { position: Vector3 | null }) {
  if (!position) return null;
  return (
    <mesh position={position.toArray()}>
      <sphereGeometry args={[0.05, 16, 16]} />
      <meshStandardMaterial color={new Color('#f1f5f9')} emissive={new Color('#38bdf8')} emissiveIntensity={1.2} />
    </mesh>
  );
}

function GroundTrack({ latitude, longitude }: { latitude: number; longitude: number }) {
  const segments = useMemo(() => generateGroundTrack(latitude, longitude), [latitude, longitude]);
  return (
    <line>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[new Float32Array(segments.flatMap((vector) => vector.toArray())), 3]}
        />
      </bufferGeometry>
      <lineBasicMaterial color={new Color('#38bdf8')} linewidth={2} />
    </line>
  );
}

function generateGroundTrack(lat: number, lon: number) {
  const positions: Vector3[] = [];
  const radius = EARTH_RADIUS_UNITS + 0.01;
  for (let i = -90; i <= 90; i += 5) {
    positions.push(latLonToVector3(lat + i, lon + i * 2, radius));
  }
  return positions;
}

function Terminator() {
  return (
    <mesh rotation={[Math.PI / 2, 0, 0]}>
      <ringGeometry args={[EARTH_RADIUS_UNITS * 1.01, EARTH_RADIUS_UNITS * 1.3, 64]} />
      <meshBasicMaterial
        color={new Color('#0f172a')}
        transparent
        opacity={0.15}
        side={2}
      />
    </mesh>
  );
}

function AuroraBelt() {
  return (
    <mesh rotation={[Math.PI / 2, 0, 0]}>
      <ringGeometry args={[EARTH_RADIUS_UNITS * 1.2, EARTH_RADIUS_UNITS * 1.6, 128]} />
      <meshBasicMaterial
        color={new Color('#22d3ee')}
        transparent
        opacity={0.2}
        side={2}
      />
    </mesh>
  );
}

function Atmosphere({ glowColour, radius }: { glowColour: string; radius: number }) {
  const colour = useMemo(() => new Color(glowColour), [glowColour]);

  return (
    <mesh>
      <sphereGeometry args={[radius * 1.02, 64, 64]} />
      <meshPhongMaterial
        color={colour}
        transparent
        opacity={0.08}
        side={1}
      />
    </mesh>
  );
}
