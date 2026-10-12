import { useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { Suspense, useMemo } from 'react';
import {
  Color,
  MeshStandardMaterial,
  Quaternion,
  Vector3,
  type Material,
  type Mesh,
  type Object3D,
  type WebGLProgramParametersWithUniforms,
} from 'three';

import { useTrackerStore } from '@/lib/state/tracker-store';

import { LowPolyEarth } from './fallbacks/LowPolyEarth';
import { useIssFrame } from './iss-frame';
import { ModelErrorBoundary } from './ModelErrorBoundary';
import { CLOUD_DRIFT_RAD_PER_S, MODEL_URLS, PALETTE } from './scene-constants';

/** Bounds the drift step after a tab has been hidden, so the clouds never leap. */
const MAX_STEP_SECONDS = 0.1;

const isMesh = (node: Object3D): node is Mesh => (node as Mesh).isMesh === true;

/**
 * Uniforms shared by every Earth material, so one write per frame reaches all of them. Lights alone
 * cannot make the night side lavender: they multiply the albedo, and the ocean's albedo has almost no
 * red in it, so a lavender light still gives navy. The shader therefore pulls the shaded colour
 * towards a lavender of the same brightness across the terminator, and adds a faint peach glow there.
 */
const nightUniforms = {
  uSunView: { value: new Vector3(1, 0, 0) },
  uNightTint: { value: new Color(PALETTE.lavender) },
  uTwilight: { value: new Color(PALETTE.peach) },
};

const NIGHT_UNIFORMS_GLSL = /* glsl */ `
uniform vec3 uSunView;
uniform vec3 uNightTint;
uniform vec3 uTwilight;
`;

/** Runs on the lit colour in linear space, before tone mapping and the sRGB conversion. */
const NIGHT_TINT_GLSL = /* glsl */ `
float sunFacing = dot( normalize( normal ), uSunView );
float nightFall = smoothstep( 0.12, -0.38, sunFacing );
float twilight = smoothstep( 0.3, 0.0, abs( sunFacing - 0.02 ) ) * 0.1;
float brightness = dot( gl_FragColor.rgb, vec3( 0.2126, 0.7152, 0.0722 ) );
vec3 lavender = uNightTint * ( 0.22 + brightness * 1.3 );
// A light touch keeps coastlines and biomes readable on the night side (small islands vanish at 0.5).
gl_FragColor.rgb = mix( gl_FragColor.rgb, lavender, nightFall * 0.3 ) + uTwilight * twilight;
`;

function patchShader(shader: WebGLProgramParametersWithUniforms): void {
  Object.assign(shader.uniforms, nightUniforms);
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', `#include <common>\n${NIGHT_UNIFORMS_GLSL}`)
    .replace('#include <opaque_fragment>', `#include <opaque_fragment>\n${NIGHT_TINT_GLSL}`);
}

/** The glTF cache hands the same materials to every mount, so patch each only once. */
function tintNightSide(material: Material): void {
  if (!(material instanceof MeshStandardMaterial) || material.userData.nightTint === true) return;
  material.userData.nightTint = true;
  material.onBeforeCompile = patchShader;
  material.customProgramCacheKey = () => 'earth-night-tint';
  material.needsUpdate = true;
}

interface PreparedEarth {
  root: Object3D;
  clouds: Object3D | null;
}

/**
 * Each mount gets its own node tree (geometry and materials stay shared with the cache), so the
 * clouds can be hidden or turned without touching any other user of the cached glTF.
 * Only the clouds cast shadows: the Earth shades itself with the terminator, and a shadow map for the
 * whole sphere would add acne for no visible gain.
 */
function prepareEarth(source: Object3D): PreparedEarth {
  const root = source.clone(true);
  root.traverse((node) => {
    if (!isMesh(node)) return;
    node.receiveShadow = true;
    (Array.isArray(node.material) ? node.material : [node.material]).forEach(tintNightSide);
  });
  const clouds = root.getObjectByName('Clouds') ?? null;
  clouds?.traverse((node) => {
    if (!isMesh(node)) return;
    node.castShadow = true;
    node.receiveShadow = false;
  });
  return { root, clouds };
}

function EarthScene() {
  const { scene } = useGLTF(MODEL_URLS.earth, false);
  const { root, clouds } = useMemo(() => prepareEarth(scene), [scene]);
  const issFrame = useIssFrame();
  const scratch = useMemo(() => ({ rig: new Quaternion() }), []);

  useFrame(({ camera }, delta) => {
    // The Sun direction is Earth-fixed; the shader works in view space, so turn it by the rig first.
    root.getWorldQuaternion(scratch.rig);
    nightUniforms.uSunView.value
      .copy(issFrame.current.sunDir)
      .applyQuaternion(scratch.rig)
      .transformDirection(camera.matrixWorldInverse);

    if (clouds === null) return;
    const { layers, reducedMotion } = useTrackerStore.getState();
    clouds.visible = layers.clouds;
    if (layers.clouds && !reducedMotion) {
      clouds.rotation.y += CLOUD_DRIFT_RAD_PER_S * Math.min(delta, MAX_STEP_SECONDS);
    }
  });

  return <primitive object={root} />;
}

useGLTF.preload(MODEL_URLS.earth, false);

/** The Blender planet, or a flat-shaded low-poly stand-in while it loads or if it fails. */
export function EarthModel() {
  return (
    <ModelErrorBoundary name="earth" fallback={<LowPolyEarth />}>
      <Suspense fallback={<LowPolyEarth />}>
        <EarthScene />
      </Suspense>
    </ModelErrorBoundary>
  );
}
