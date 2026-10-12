import { useGLTF } from '@react-three/drei';
import { Suspense, useEffect, useMemo } from 'react';
import {
  CanvasTexture,
  MeshStandardMaterial,
  SRGBColorSpace,
  type Material,
  type Mesh,
  type Object3D,
} from 'three';

import { FallbackStand } from './fallbacks/FallbackStand';
import { ModelErrorBoundary } from './ModelErrorBoundary';
import { MODEL_URLS, PALETTE, STAND_SCALE, STAND_Y } from './scene-constants';

/** Lifts the blob just above the tallest grass tuft on the tile (0.135) so it never z-fights. */
const SHADOW_LIFT = 0.15;
/** Width of the square the blob is drawn on; the tile is 2.4 wide, the shadow fades out before its edge. */
const SHADOW_SIZE = 2.7;
const TEXTURE_SIZE = 128;
/** Share of each material's colour that the stand emits on its own. */
const SELF_LIGHT = 0.4;

const hexToChannels = (hex: string): string =>
  [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16)).join(', ');

/**
 * The globe floats, so its shadow is a soft blob rather than a projected silhouette. A real
 * depth-based contact shadow renders every object in the scene, and that smears the orbit lines
 * (thick screen-space lines misbehave under a depth override material) across the tile.
 */
function createShadowTexture(): CanvasTexture | null {
  const canvas = document.createElement('canvas');
  canvas.width = TEXTURE_SIZE;
  canvas.height = TEXTURE_SIZE;
  const context = canvas.getContext('2d');
  if (context === null) return null;

  const middle = TEXTURE_SIZE / 2;
  const gradient = context.createRadialGradient(middle, middle, 0, middle, middle, middle);
  const ink = hexToChannels(PALETTE.night);
  gradient.addColorStop(0, `rgba(${ink}, 0.36)`);
  gradient.addColorStop(0.5, `rgba(${ink}, 0.28)`);
  gradient.addColorStop(0.74, `rgba(${ink}, 0.1)`);
  gradient.addColorStop(1, `rgba(${ink}, 0)`);
  context.fillStyle = gradient;
  context.fillRect(0, 0, TEXTURE_SIZE, TEXTURE_SIZE);

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

function ContactBlob() {
  const texture = useMemo(createShadowTexture, []);
  useEffect(() => () => texture?.dispose(), [texture]);
  if (texture === null) return null;

  return (
    <mesh rotation-x={-Math.PI / 2} position={[0, STAND_Y + SHADOW_LIFT * STAND_SCALE, 0]} renderOrder={1}>
      <planeGeometry args={[SHADOW_SIZE * STAND_SCALE, SHADOW_SIZE * STAND_SCALE]} />
      <meshBasicMaterial map={texture} transparent depthWrite={false} toneMapped={false} />
    </mesh>
  );
}

/**
 * The stand is lit by the real Sun like everything else, but a tile that goes dull whenever the Sun is
 * below the horizon would spoil the diorama. A little self-light, derived from each material's own
 * colour, keeps it cosy at night. Only this component uses stand.glb, so touching the shared
 * materials is safe, and the assignment is idempotent.
 */
function warmUp(root: Object3D): void {
  root.traverse((node) => {
    if (!(node as Mesh).isMesh) return;
    const materials = Array.isArray((node as Mesh).material)
      ? ((node as Mesh).material as Material[])
      : [(node as Mesh).material as Material];
    materials.forEach((material) => {
      if (!(material instanceof MeshStandardMaterial)) return;
      material.emissive.copy(material.color).multiplyScalar(SELF_LIGHT);
    });
  });
}

function StandScene() {
  const { scene } = useGLTF(MODEL_URLS.stand, false);
  const stand = useMemo(() => {
    warmUp(scene);
    return scene.clone(true);
  }, [scene]);
  return <primitive object={stand} position={[0, STAND_Y, 0]} scale={STAND_SCALE} />;
}

useGLTF.preload(MODEL_URLS.stand, false);

/** The pastel base the globe floats above. It stays put while the globe turns. */
export function StandModel() {
  return (
    <>
      <ModelErrorBoundary name="stand" fallback={<FallbackStand />}>
        <Suspense fallback={<FallbackStand />}>
          <StandScene />
        </Suspense>
      </ModelErrorBoundary>
      <ContactBlob />
    </>
  );
}
