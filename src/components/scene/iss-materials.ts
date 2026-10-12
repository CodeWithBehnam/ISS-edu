import { Color, Mesh, MeshStandardMaterial, type Object3D } from 'three';

import { dampingBlend } from '@/lib/time/damping';

/** How fast the station dims on entering Earth's shadow and brightens on leaving it, per second. */
export const SHADE_RATE = 3;
/**
 * What full shade multiplies every colour by (linear RGB): dimmer, and cooler towards lavender like the
 * planet's own night side. A multiplier never lightens a dark part, which blending towards a tint would.
 * Some brightness stays, so the model never goes black.
 */
const DUSK = new Color().setRGB(0.42, 0.45, 0.72);
const DAYLIGHT = new Color(1, 1, 1);
/** Windows and lamps would otherwise glow at full strength in the dark. */
const SHADE_EMISSIVE_CUT = 0.6;

const factor = new Color();

/** A material plus the day-side colours it returns to when the station is back in sunlight. */
export interface ShadeSlot {
  material: MeshStandardMaterial;
  colour: Color;
  emissive: Color;
}

/** Each distinct standard material under `root`, once. */
export function meshMaterials(root: Object3D): MeshStandardMaterial[] {
  const found = new Set<MeshStandardMaterial>();
  root.traverse((part) => {
    if (part instanceof Mesh && part.material instanceof MeshStandardMaterial) found.add(part.material);
  });
  return [...found];
}

export function emissiveMaterials(root: Object3D): MeshStandardMaterial[] {
  return meshMaterials(root).filter((material) => material.emissive.getHex() !== 0);
}

/**
 * Gives the meshes under `root` their own copies of their materials, so animating a colour never
 * reaches back into the glTF loader's cache. Meshes that shared a material still share its copy.
 */
export function cloneMeshMaterials(root: Object3D): void {
  const copies = new Map<MeshStandardMaterial, MeshStandardMaterial>();
  root.traverse((part) => {
    if (!(part instanceof Mesh) || !(part.material instanceof MeshStandardMaterial)) return;
    const copy = copies.get(part.material) ?? part.material.clone();
    copies.set(part.material, copy);
    part.material = copy;
  });
}

/** Everything under `root` that dims in shadow, except the materials the caller animates itself. */
export function collectShadeSlots(root: Object3D, exclude: readonly MeshStandardMaterial[]): ShadeSlot[] {
  return meshMaterials(root)
    .filter((material) => !exclude.includes(material))
    .map((material) => ({ material, colour: material.color.clone(), emissive: material.emissive.clone() }));
}

/** Eases the shade level towards 1 in Earth's shadow and 0 in sunlight; `instant` skips the ease. */
export function nextShade(current: number, sunlit: boolean, dtSeconds: number, instant: boolean): number {
  const target = sunlit ? 0 : 1;
  return instant ? target : current + (target - current) * dampingBlend(SHADE_RATE, dtSeconds);
}

/** Level 0 restores the day-side colours exactly; level 1 is the full dusk look. */
export function applyShade(slots: readonly ShadeSlot[], level: number): void {
  const amount = Math.min(1, Math.max(0, level));
  factor.copy(DAYLIGHT).lerp(DUSK, amount);
  for (const { material, colour, emissive } of slots) {
    material.color.copy(colour).multiply(factor);
    material.emissive.copy(emissive).multiplyScalar(1 - SHADE_EMISSIVE_CUT * amount);
  }
}
