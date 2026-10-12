import { useEffect, useMemo } from 'react';
import { BufferGeometry, Color, Float32BufferAttribute, IcosahedronGeometry, Vector3 } from 'three';

import { geodeticToScene } from '@/lib/orbit/frames';

import { PALETTE } from '../scene-constants';

interface Blob {
  latitude: number;
  longitude: number;
  radiusDeg: number;
}

/** Rough continents, enough to tell which way round the planet is while the real model loads. */
const LAND_BLOBS: readonly Blob[] = [
  { latitude: 48, longitude: -102, radiusDeg: 23 },
  { latitude: 72, longitude: -42, radiusDeg: 9 },
  { latitude: -14, longitude: -60, radiusDeg: 18 },
  { latitude: 50, longitude: 14, radiusDeg: 11 },
  { latitude: 6, longitude: 20, radiusDeg: 22 },
  { latitude: 52, longitude: 88, radiusDeg: 26 },
  { latitude: 22, longitude: 79, radiusDeg: 9 },
  { latitude: 8, longitude: 108, radiusDeg: 9 },
  { latitude: -25, longitude: 134, radiusDeg: 13 },
];

const BLOB_CENTRES: readonly Vector3[] = LAND_BLOBS.map((blob) => {
  const [x, y, z] = geodeticToScene(blob.latitude, blob.longitude, 1);
  return new Vector3(x, y, z);
});

/** Edge subdivisions of the icosahedron: enough faces for readable continents, few enough to stay chunky. */
const LOW_POLY_DETAIL = 8;
const LAND_LIFT = 0.04;
const POLAR_LATITUDE_SINE = Math.sin((72 * Math.PI) / 180);
const RAD_TO_DEG = 180 / Math.PI;

const OCEAN = new Color(PALETTE.ocean);
const GRASS = new Color(PALETTE.leaf);
const HIGHLAND = new Color(PALETTE.mint);
const ICE = new Color(PALETTE.paper);

/** Deterministic wobble in [-1, 1] so coastlines are ragged without a random source. */
const wobble = (d: Vector3): number => Math.sin(d.x * 9.1 + d.y * 7.3) * Math.cos(d.z * 8.7 + d.x * 3.1);

/** 0 in the sea, rising to 1 deep inland. */
function landDepth(direction: Vector3): number {
  const ragged = 1 + 0.28 * wobble(direction);
  return BLOB_CENTRES.reduce((deepest, centre, index) => {
    const angleDeg = Math.acos(Math.min(1, Math.max(-1, direction.dot(centre)))) * RAD_TO_DEG;
    return Math.max(deepest, 1 - angleDeg / (LAND_BLOBS[index].radiusDeg * ragged));
  }, 0);
}

const smooth = (t: number): number => {
  const c = Math.min(1, Math.max(0, t));
  return c * c * (3 - 2 * c);
};

/** Radius depends only on the vertex position, so neighbouring faces never tear apart. */
const radiusAt = (direction: Vector3): number =>
  direction.y > POLAR_LATITUDE_SINE || direction.y < -POLAR_LATITUDE_SINE
    ? 1 + LAND_LIFT
    : 1 + LAND_LIFT * smooth(landDepth(direction) * 4);

function colourFor(centroid: Vector3, out: Color): Color {
  if (Math.abs(centroid.y) > POLAR_LATITUDE_SINE) return out.copy(ICE);
  const depth = landDepth(centroid);
  if (depth <= 0) return out.copy(OCEAN);
  return out.copy(GRASS).lerp(HIGHLAND, smooth((depth - 0.45) * 3));
}

function buildGeometry(): BufferGeometry {
  // The icosahedron is non-indexed, so every face owns its three vertices: ideal for flat colours.
  const geometry = new IcosahedronGeometry(1, LOW_POLY_DETAIL);
  const positions = geometry.getAttribute('position');
  const colours = new Float32Array(positions.count * 3);
  const vertex = new Vector3();
  const centroid = new Vector3();
  const colour = new Color();

  for (let face = 0; face < positions.count; face += 3) {
    centroid.set(0, 0, 0);
    for (let corner = 0; corner < 3; corner += 1) {
      centroid.add(vertex.fromBufferAttribute(positions, face + corner));
    }
    colourFor(centroid.normalize(), colour);
    for (let corner = 0; corner < 3; corner += 1) {
      colour.toArray(colours, (face + corner) * 3);
      vertex.fromBufferAttribute(positions, face + corner).normalize();
      vertex.multiplyScalar(radiusAt(vertex));
      positions.setXYZ(face + corner, vertex.x, vertex.y, vertex.z);
    }
  }
  geometry.setAttribute('color', new Float32BufferAttribute(colours, 3));
  geometry.computeVertexNormals();
  return geometry;
}

/** Flat-shaded stand-in for earth.glb: same frame, same radius, no network. */
export function LowPolyEarth() {
  const geometry = useMemo(buildGeometry, []);
  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <mesh geometry={geometry} receiveShadow>
      <meshStandardMaterial vertexColors flatShading roughness={0.85} metalness={0} />
    </mesh>
  );
}
