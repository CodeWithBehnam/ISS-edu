import { BoxGeometry, Color, Group, Mesh, MeshStandardMaterial } from 'three';
import { describe, expect, it } from 'vitest';

import {
  applyShade,
  cloneMeshMaterials,
  collectShadeSlots,
  emissiveMaterials,
  meshMaterials,
  nextShade,
} from '@/components/scene/iss-materials';

function buildStation() {
  const hull = new MeshStandardMaterial({ color: '#FFFDF8' });
  const lamp = new MeshStandardMaterial({ color: '#FF8C7A', emissive: '#FF8C7A', emissiveIntensity: 1 });
  const root = new Group();
  const shared = [new Mesh(new BoxGeometry(), hull), new Mesh(new BoxGeometry(), hull)];
  const beacon = new Mesh(new BoxGeometry(), lamp);
  beacon.name = 'Beacon';
  root.add(...shared, beacon);
  return { root, hull, lamp };
}

const luminance = (colour: Color): number => colour.r + colour.g + colour.b;

describe('nextShade', () => {
  it('eases towards 1 in shadow and towards 0 in sunlight without overshooting', () => {
    const into = nextShade(0, false, 0.1, false);
    expect(into).toBeGreaterThan(0);
    expect(into).toBeLessThan(1);
    const out = nextShade(1, true, 0.1, false);
    expect(out).toBeLessThan(1);
    expect(out).toBeGreaterThan(0);
  });

  it('settles at the target after a long pause and snaps when asked to', () => {
    expect(nextShade(0, false, 10, false)).toBeGreaterThan(0.999);
    expect(nextShade(1, true, 10, false)).toBeLessThan(0.001);
    expect(nextShade(0.3, false, 0.016, true)).toBe(1);
    expect(nextShade(0.7, true, 0.016, true)).toBe(0);
  });

  it('takes the same time to arrive at any frame rate', () => {
    let at60 = 0;
    for (let frame = 0; frame < 60; frame += 1) at60 = nextShade(at60, false, 1 / 60, false);
    let at144 = 0;
    for (let frame = 0; frame < 144; frame += 1) at144 = nextShade(at144, false, 1 / 144, false);
    expect(at144).toBeCloseTo(at60, 6);
  });
});

describe('applyShade', () => {
  it('dims and cools the colours in shadow but never goes black', () => {
    const { root, lamp } = buildStation();
    const slots = collectShadeSlots(root, [lamp]);
    const day = luminance(slots[0].material.color);

    applyShade(slots, 1);

    const night = luminance(slots[0].material.color);
    expect(night).toBeLessThan(day);
    expect(night).toBeGreaterThan(0.3 * day);
  });

  it('never lightens a dark part, which is what blending towards a night tint would do', () => {
    const ink = new MeshStandardMaterial({ color: '#2B2D42' });
    const root = new Group();
    root.add(new Mesh(new BoxGeometry(), ink));
    const slots = collectShadeSlots(root, []);
    const before = ink.color.clone();

    applyShade(slots, 1);

    expect(ink.color.r).toBeLessThanOrEqual(before.r);
    expect(ink.color.g).toBeLessThanOrEqual(before.g);
    expect(ink.color.b).toBeLessThanOrEqual(before.b);
  });

  it('restores the day-side colours exactly at level 0', () => {
    const { root, lamp } = buildStation();
    const slots = collectShadeSlots(root, [lamp]);
    const before = slots[0].material.color.getHex();

    applyShade(slots, 1);
    applyShade(slots, 0);

    expect(slots[0].material.color.getHex()).toBe(before);
  });

  it('cuts emissive glow in shadow and clamps levels outside 0 to 1', () => {
    const glow = new MeshStandardMaterial({ emissive: '#FFE29A', emissiveIntensity: 1 });
    const root = new Group();
    root.add(new Mesh(new BoxGeometry(), glow));
    const slots = collectShadeSlots(root, []);
    const dayGlow = luminance(glow.emissive);

    applyShade(slots, 1);
    const nightGlow = luminance(glow.emissive);
    expect(nightGlow).toBeLessThan(dayGlow);

    applyShade(slots, 5);
    expect(luminance(glow.emissive)).toBeCloseTo(nightGlow, 12);
    applyShade(slots, -3);
    expect(luminance(glow.emissive)).toBeCloseTo(dayGlow, 12);
  });
});

describe('collecting materials', () => {
  it('lists each shared material once and leaves excluded lamps out of the shade slots', () => {
    const { root, hull, lamp } = buildStation();
    expect(meshMaterials(root)).toHaveLength(2);
    expect(emissiveMaterials(root)).toEqual([lamp]);
    expect(collectShadeSlots(root, [lamp]).map((slot) => slot.material)).toEqual([hull]);
  });
});

describe('cloneMeshMaterials', () => {
  it('gives the copy its own materials so shading never reaches the original', () => {
    const { root, hull } = buildStation();
    const copy = root.clone(true);
    cloneMeshMaterials(copy);

    const [copiedHull] = collectShadeSlots(copy, emissiveMaterials(copy)).map((slot) => slot.material);
    expect(copiedHull).not.toBe(hull);

    applyShade(collectShadeSlots(copy, []), 1);

    expect(hull.color.getHex()).toBe(new Color('#FFFDF8').getHex());
    expect(copiedHull.color.getHex()).not.toBe(hull.color.getHex());
  });

  it('keeps meshes that shared a material sharing one copy', () => {
    const { root } = buildStation();
    cloneMeshMaterials(root);
    expect(meshMaterials(root)).toHaveLength(2);
  });
});
