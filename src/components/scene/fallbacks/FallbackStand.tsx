import { RoundedBox } from '@react-three/drei';

import { PALETTE, STAND_SCALE, STAND_Y } from '../scene-constants';

/** Pastel rounded tile used until stand.glb arrives, or when it cannot be loaded. */
export function FallbackStand() {
  return (
    <group position={[0, STAND_Y, 0]} scale={STAND_SCALE}>
      <RoundedBox args={[2.24, 0.16, 2.24]} radius={0.06} smoothness={3} position={[0, -0.25, 0]}>
        <meshStandardMaterial color={PALETTE.blush} roughness={0.85} />
      </RoundedBox>
      <RoundedBox args={[2.4, 0.18, 2.4]} radius={0.08} smoothness={3} position={[0, -0.09, 0]}>
        <meshStandardMaterial color={PALETTE.peach} roughness={0.8} />
      </RoundedBox>
      <RoundedBox args={[2.12, 0.04, 2.12]} radius={0.02} smoothness={2} position={[0, 0, 0]}>
        <meshStandardMaterial color={PALETTE.cream} roughness={0.85} />
      </RoundedBox>
      <mesh position={[0, 0.03, 0]}>
        <cylinderGeometry args={[0.95, 1, 0.05, 40]} />
        <meshStandardMaterial color={PALETTE.mint} roughness={0.8} />
      </mesh>
    </group>
  );
}
