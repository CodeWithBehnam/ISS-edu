import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { DoubleSide, Quaternion, Vector3, type Group, type Mesh, type MeshBasicMaterial } from 'three';

import { geodeticToScene } from '@/lib/orbit/frames';
import { useTrackerStore } from '@/lib/state/tracker-store';

import { PALETTE } from './scene-constants';

/** The land is raised to r <= 1.04, so the pin's tip rests on the highest ground. */
const PIN_BASE_RADIUS = 1.04;
const CONE_HEIGHT = 0.052;
const HEAD_RADIUS = 0.026;
const PULSE_SECONDS = 2;
const BOB_AMPLITUDE = 0.005;
const BOB_RATE = 2.2;
const HALF_PI = Math.PI / 2;

const UP = new Vector3(0, 1, 0);

interface PinProps {
  latitude: number;
  longitude: number;
}

function Pin({ latitude, longitude }: PinProps) {
  const bob = useRef<Group>(null);
  const ring = useRef<Mesh>(null);
  const ringMaterial = useRef<MeshBasicMaterial>(null);

  const { position, quaternion } = useMemo(() => {
    const [x, y, z] = geodeticToScene(latitude, longitude, PIN_BASE_RADIUS);
    const placed = new Vector3(x, y, z);
    return {
      position: placed,
      quaternion: new Quaternion().setFromUnitVectors(UP, placed.clone().normalize()),
    };
  }, [latitude, longitude]);

  useFrame(({ clock }) => {
    const still = useTrackerStore.getState().reducedMotion;
    const seconds = clock.elapsedTime;
    if (bob.current) bob.current.position.y = still ? 0 : BOB_AMPLITUDE * Math.sin(seconds * BOB_RATE);

    // A calm ripple outwards from the pin; under reduced motion it rests as a static ring.
    const progress = still ? 0.45 : (seconds % PULSE_SECONDS) / PULSE_SECONDS;
    ring.current?.scale.setScalar(1 + 1.8 * progress);
    if (ringMaterial.current) ringMaterial.current.opacity = 0.75 * (1 - progress) ** 1.5;
  });

  return (
    <group position={position} quaternion={quaternion}>
      <mesh rotation={[-HALF_PI, 0, 0]} position={[0, 0.002, 0]}>
        <circleGeometry args={[0.018, 16]} />
        <meshBasicMaterial color={PALETTE.ink} transparent opacity={0.16} depthWrite={false} />
      </mesh>
      <mesh ref={ring} rotation={[-HALF_PI, 0, 0]} position={[0, 0.004, 0]}>
        <ringGeometry args={[0.03, 0.039, 40]} />
        <meshBasicMaterial
          ref={ringMaterial}
          color={PALETTE.coral}
          transparent
          opacity={0.6}
          side={DoubleSide}
          depthWrite={false}
        />
      </mesh>
      <group ref={bob}>
        <mesh position={[0, CONE_HEIGHT / 2, 0]} rotation={[Math.PI, 0, 0]}>
          <coneGeometry args={[0.017, CONE_HEIGHT, 10]} />
          <meshStandardMaterial color={PALETTE.coral} flatShading roughness={0.8} />
        </mesh>
        <mesh position={[0, CONE_HEIGHT + HEAD_RADIUS * 0.6, 0]}>
          <sphereGeometry args={[HEAD_RADIUS, 14, 10]} />
          <meshStandardMaterial color={PALETTE.coral} flatShading roughness={0.8} />
        </mesh>
        <mesh position={[0, CONE_HEIGHT + HEAD_RADIUS * 1.5, 0]}>
          <sphereGeometry args={[0.011, 10, 8]} />
          <meshBasicMaterial color={PALETTE.paper} />
        </mesh>
      </group>
    </group>
  );
}

/** Where the viewer is (their location or a chosen city), standing on the globe. */
export function ObserverPin() {
  const observer = useTrackerStore((state) => state.observer);
  if (observer === null) return null;
  return <Pin latitude={observer.latitude} longitude={observer.longitude} />;
}
