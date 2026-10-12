import type { Tuple3 } from '@/lib/orbit/frames';

/** Scene units per ISS model unit (the glTF truss spans exactly 1.0). */
export const ISS_SCENE_SCALE = 0.3;
/** World height of the stand's origin; the globe floats above it with room for the ISS to pass below. */
export const STAND_Y = -1.4;
/** The stand is decoration, so it is shrunk to let the camera frame the globe more tightly. */
export const STAND_SCALE = 0.82;
/** Half the height of the framed view in scene units: the globe and the ISS orbit, with the stand's front tip at the bottom edge. */
export const FIT_RADIUS = 1.6;
/** True isometric view: 45 degrees around, then atan(1 / sqrt 2) above the horizon. */
export const ISO_AZIMUTH_DEG = 45;
export const ISO_ELEVATION_DEG = 35.264;
export const CLOUD_DRIFT_RAD_PER_S = 0.012;
export const ISOMETRIC_SPIN_RAD_PER_S = 0.05;
export const AXIAL_TILT_DEG = 23.44;

export const PALETTE = {
  cream: '#FFF8EE',
  paper: '#FFFDF8',
  peach: '#FFD8BE',
  blush: '#FFB4A2',
  coral: '#FF8C7A',
  sky: '#BDE0FE',
  ocean: '#7CC6E8',
  oceanDeep: '#4FA3D1',
  mint: '#B9F3C9',
  leaf: '#7CC56B',
  butter: '#FFE29A',
  lavender: '#CDB4DB',
  grape: '#8E7DBE',
  night: '#6C6FA8',
  ink: '#2B2D42',
  inkSoft: '#5C5F7A',
  line: '#EADFD3',
} as const;

const modelUrl = (file: string): string => `${import.meta.env.BASE_URL}models/${file}`;

/** glTF files made in Blender; the base path keeps them working when the app is not served from "/". */
export const MODEL_URLS = {
  earth: modelUrl('earth.glb'),
  iss: modelUrl('iss.glb'),
  stand: modelUrl('stand.glb'),
} as const;

const DEG = Math.PI / 180;
const azimuth = ISO_AZIMUTH_DEG * DEG;
const elevation = ISO_ELEVATION_DEG * DEG;

/** Unit vector from the origin towards the isometric camera. */
export const ISO_CAMERA_DIRECTION: Tuple3 = [
  Math.sin(azimuth) * Math.cos(elevation),
  Math.sin(elevation),
  Math.cos(azimuth) * Math.cos(elevation),
];

/** Unit vector pointing up the screen for that camera (world up with the view axis removed). */
export const ISO_SCREEN_UP: Tuple3 = [
  -Math.sin(azimuth) * Math.sin(elevation),
  Math.cos(elevation),
  -Math.cos(azimuth) * Math.sin(elevation),
];

/** Unit vector pointing right across the screen for that camera. */
export const ISO_SCREEN_RIGHT: Tuple3 = [Math.cos(azimuth), 0, -Math.sin(azimuth)];

/** An orthographic camera only needs to sit clear of the scene; this keeps the clip range generous. */
export const CAMERA_DISTANCE = 20;

/**
 * Screen-space offset (scene units) of the middle of the view relative to the globe centre. A small
 * downward shift keeps the stand in shot while the globe stays the dominant, easy-to-read subject.
 */
export const FRAME_CENTRE_Y = -0.3;
/** Half the width of the view on screen: the scaled stand's diagonal is the widest part. */
export const FRAME_HALF_WIDTH = 1.45;
/** Breathing room around the framed view. */
export const FRAME_MARGIN = 1.03;
