import { useFrame } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import {
  CanvasTexture,
  Quaternion,
  SRGBColorSpace,
  Vector3,
  type DirectionalLight,
  type Group,
  type HemisphereLight,
  type Sprite,
} from 'three';

import { useIssFrame } from './iss-frame';
import { ISO_CAMERA_DIRECTION, ISO_SCREEN_RIGHT, ISO_SCREEN_UP, PALETTE } from './scene-constants';

const KEY_DISTANCE = 6;
const SUN_DISTANCE = 3.3;
const SUN_SIZE = 1.5;
const GLOW_TEXTURE_SIZE = 128;
/** Covers the cloud shell (radius 1.16) with a little margin; nothing else casts shadows. */
const SHADOW_EXTENT = 1.3;
const SHADOW_MAP_SIZE = 1024;

const CAMERA_DIRECTION = new Vector3(...ISO_CAMERA_DIRECTION);
const SCREEN_UP = new Vector3(...ISO_SCREEN_UP);
const SCREEN_RIGHT = new Vector3(...ISO_SCREEN_RIGHT);

const combine = (front: number, right: number, up: number): Vector3 =>
  new Vector3()
    .addScaledVector(CAMERA_DIRECTION, front)
    .addScaledVector(SCREEN_RIGHT, right)
    .addScaledVector(SCREEN_UP, up)
    .normalize();

/**
 * Warm fill from the viewer's left. It is deliberately not frontal: a light aimed at the camera side of
 * the globe would wash the terminator out and make the night side look like day.
 */
const FILL_WORLD = combine(0.25, -0.9, 0.45);
/** Cool rim from behind on the right separates the globe from the page behind it. */
const RIM_WORLD = combine(-0.7, 0.75, 0.3);
/** Sky colour comes from the top of the screen, lavender ground from the bottom. */
const SKY_WORLD = combine(0.4, 0, 1);

const hexToChannels = (hex: string): string =>
  [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16)).join(', ');

function createGlowTexture(): CanvasTexture | null {
  const canvas = document.createElement('canvas');
  canvas.width = GLOW_TEXTURE_SIZE;
  canvas.height = GLOW_TEXTURE_SIZE;
  const context = canvas.getContext('2d');
  if (context === null) return null;

  const middle = GLOW_TEXTURE_SIZE / 2;
  const gradient = context.createRadialGradient(middle, middle, 0, middle, middle, middle);
  const butter = hexToChannels(PALETTE.butter);
  gradient.addColorStop(0, 'rgba(255, 252, 238, 1)');
  gradient.addColorStop(0.2, 'rgba(255, 246, 214, 1)');
  gradient.addColorStop(0.27, `rgba(${butter}, 0.9)`);
  gradient.addColorStop(0.5, `rgba(${butter}, 0.28)`);
  gradient.addColorStop(1, `rgba(${butter}, 0)`);
  context.fillStyle = gradient;
  context.fillRect(0, 0, GLOW_TEXTURE_SIZE, GLOW_TEXTURE_SIZE);

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

const smoothstep = (edge0: number, edge1: number, value: number): number => {
  const t = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
};

interface RigScratch {
  rig: Quaternion;
  inverse: Quaternion;
  sunWorld: Vector3;
}

/**
 * Lights for the diorama: the real Sun as key, soft pastel fill so the night side is never black.
 * It lives inside GlobeRig, in the Earth-fixed frame, so the Sun direction can be used as is for the
 * key light. Everything that should stay put relative to the viewer (fill, rim, sky) is defined in
 * world space and brought back into the rig's frame each frame.
 */
export function SunRig() {
  const frameRef = useIssFrame();
  const group = useRef<Group>(null);
  const key = useRef<DirectionalLight>(null);
  const keyFill = useRef<DirectionalLight>(null);
  const fill = useRef<DirectionalLight>(null);
  const rim = useRef<DirectionalLight>(null);
  const sky = useRef<HemisphereLight>(null);
  const sun = useRef<Sprite>(null);
  const glow = useMemo(createGlowTexture, []);
  const scratch = useMemo<RigScratch>(
    () => ({ rig: new Quaternion(), inverse: new Quaternion(), sunWorld: new Vector3() }),
    [],
  );

  useEffect(() => () => glow?.dispose(), [glow]);

  useLayoutEffect(() => {
    const light = key.current;
    if (light === null) return;
    light.shadow.mapSize.set(SHADOW_MAP_SIZE, SHADOW_MAP_SIZE);
    const camera = light.shadow.camera;
    camera.left = -SHADOW_EXTENT;
    camera.right = SHADOW_EXTENT;
    camera.top = SHADOW_EXTENT;
    camera.bottom = -SHADOW_EXTENT;
    camera.near = KEY_DISTANCE - 2 * SHADOW_EXTENT;
    camera.far = KEY_DISTANCE + 2 * SHADOW_EXTENT;
    camera.updateProjectionMatrix();
  }, []);

  useFrame(() => {
    const rigObject = group.current?.parent;
    const keyLight = key.current;
    const keyFillLight = keyFill.current;
    const fillLight = fill.current;
    const rimLight = rim.current;
    const skyLight = sky.current;
    const sprite = sun.current;
    if (!rigObject || !keyLight || !keyFillLight || !fillLight || !rimLight || !skyLight) return;

    const { sunDir } = frameRef.current;
    rigObject.getWorldQuaternion(scratch.rig);
    scratch.inverse.copy(scratch.rig).invert();

    keyLight.position.copy(sunDir).multiplyScalar(KEY_DISTANCE);
    keyFillLight.position.copy(keyLight.position);
    fillLight.position.copy(FILL_WORLD).applyQuaternion(scratch.inverse);
    rimLight.position.copy(RIM_WORLD).applyQuaternion(scratch.inverse);
    skyLight.position.copy(SKY_WORLD).applyQuaternion(scratch.inverse);

    if (!sprite) return;
    // The glow only shows when the Sun is behind or beside the globe; in front it would hide the planet.
    sprite.position.copy(sunDir).multiplyScalar(SUN_DISTANCE);
    scratch.sunWorld.copy(sunDir).applyQuaternion(scratch.rig);
    const towardsViewer = scratch.sunWorld.dot(CAMERA_DIRECTION);
    const opacity = 1 - smoothstep(-0.15, 0.35, towardsViewer);
    sprite.material.opacity = opacity;
    sprite.visible = opacity > 0.01;
  });

  return (
    <group ref={group}>
      <directionalLight
        ref={key}
        color="#FFF1DA"
        intensity={2}
        castShadow
        shadow-bias={-0.0006}
        shadow-normalBias={0.02}
      />
      {/* Same direction, no shadow: stops cloud shadows going as dark as the night side. */}
      <directionalLight ref={keyFill} color="#FFF1DA" intensity={0.8} />
      <directionalLight ref={fill} color="#FFDCC6" intensity={0.35} />
      <directionalLight ref={rim} color={PALETTE.sky} intensity={0.6} />
      <hemisphereLight ref={sky} args={['#EFE8FF', '#B4A5E4', 1.3]} />
      <ambientLight color="#CDB9F2" intensity={0.5} />
      {glow !== null && (
        <sprite ref={sun} scale={[SUN_SIZE, SUN_SIZE, 1]} renderOrder={-1}>
          <spriteMaterial map={glow} transparent depthWrite={false} toneMapped={false} fog={false} />
        </sprite>
      )}
    </group>
  );
}
