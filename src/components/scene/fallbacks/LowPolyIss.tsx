import { useEffect, useMemo } from 'react';
import { MeshStandardMaterial } from 'three';

import { PALETTE } from '../scene-constants';

/**
 * Same axes and scale as /models/iss.glb: truss along +X with a 1.0 span, +Z in the direction of
 * flight, +Y towards the zenith. IssModel animates the nodes by name, so the wings and the beacon
 * keep the glTF's `SolarWing_*` and `Beacon` names.
 */
const WING_SLOTS = [
  { name: 'SolarWing_P2A', x: -0.45, side: 1 },
  { name: 'SolarWing_P2B', x: -0.45, side: -1 },
  { name: 'SolarWing_P1A', x: -0.31, side: 1 },
  { name: 'SolarWing_P1B', x: -0.31, side: -1 },
  { name: 'SolarWing_S1A', x: 0.31, side: 1 },
  { name: 'SolarWing_S1B', x: 0.31, side: -1 },
  { name: 'SolarWing_S2A', x: 0.45, side: 1 },
  { name: 'SolarWing_S2B', x: 0.45, side: -1 },
] as const;

const WING_WIDTH = 0.095;
const WING_LENGTH = 0.27;
const WING_GAP = 0.04;
const HALF_PI = Math.PI / 2;
/** Deeper than PALETTE.oceanDeep so the cells still read as dark photovoltaics against the pastel page. */
const CELL_BLUE = '#5B78C4';

function flat(color: string): MeshStandardMaterial {
  return new MeshStandardMaterial({ color, flatShading: true, roughness: 0.85, metalness: 0 });
}

function createMaterials() {
  return {
    truss: flat(PALETTE.lavender),
    module: flat(PALETTE.paper),
    accent: flat(PALETTE.blush),
    cell: flat(CELL_BLUE),
    mast: flat(PALETTE.butter),
    radiator: flat(PALETTE.sky),
    face: flat(PALETTE.ink),
    beacon: new MeshStandardMaterial({
      color: PALETTE.coral,
      emissive: PALETTE.coral,
      emissiveIntensity: 1,
      flatShading: true,
    }),
  };
}

export function LowPolyIss() {
  const materials = useMemo(createMaterials, []);

  useEffect(
    () => () => {
      Object.values(materials).forEach((material) => material.dispose());
    },
    [materials],
  );

  return (
    <group name="ISS">
      <mesh material={materials.truss}>
        <boxGeometry args={[0.92, 0.026, 0.026]} />
      </mesh>

      <mesh rotation={[HALF_PI, 0, 0]} material={materials.module}>
        <cylinderGeometry args={[0.045, 0.045, 0.34, 10]} />
      </mesh>
      <mesh rotation={[0, 0, HALF_PI]} material={materials.module}>
        <cylinderGeometry args={[0.032, 0.032, 0.2, 10]} />
      </mesh>
      <mesh position={[0, 0, 0.17]} material={materials.accent}>
        <sphereGeometry args={[0.046, 10, 8]} />
      </mesh>
      <mesh position={[0.016, 0.014, 0.213]} material={materials.face}>
        <sphereGeometry args={[0.007, 6, 5]} />
      </mesh>
      <mesh position={[-0.016, 0.014, 0.213]} material={materials.face}>
        <sphereGeometry args={[0.007, 6, 5]} />
      </mesh>

      <mesh position={[-0.11, -0.06, -0.04]} material={materials.radiator}>
        <boxGeometry args={[0.15, 0.004, 0.12]} />
      </mesh>
      <mesh position={[0.11, -0.06, -0.04]} material={materials.radiator}>
        <boxGeometry args={[0.15, 0.004, 0.12]} />
      </mesh>

      {WING_SLOTS.map(({ name, x, side }) => (
        <group key={name} name={name} position={[x, 0, 0]}>
          <mesh position={[0, 0, side * (WING_GAP + WING_LENGTH / 2)]} material={materials.cell}>
            <boxGeometry args={[WING_WIDTH, 0.005, WING_LENGTH]} />
          </mesh>
          <mesh position={[0, 0, side * (WING_GAP + WING_LENGTH / 2)]} material={materials.mast}>
            <boxGeometry args={[0.008, 0.008, WING_LENGTH + 0.01]} />
          </mesh>
        </group>
      ))}

      <mesh name="Beacon" position={[0, 0.075, 0]} material={materials.beacon}>
        <sphereGeometry args={[0.016, 8, 6]} />
      </mesh>
    </group>
  );
}
