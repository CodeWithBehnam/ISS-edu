import { describe, expect, it } from 'vitest';

import { dampingBlend, frameFactorFor } from '@/lib/time/damping';

describe('dampingBlend', () => {
  it('is zero for no time and approaches one for a long time', () => {
    expect(dampingBlend(8, 0)).toBe(0);
    expect(dampingBlend(8, 10)).toBeGreaterThan(0.999);
  });

  it('gives the same result whether time passes in one step or many', () => {
    const rate = 5;
    const oneStep = dampingBlend(rate, 0.1);
    const remaining = (1 - dampingBlend(rate, 0.025)) ** 4;
    expect(1 - remaining).toBeCloseTo(oneStep, 12);
  });
});

describe('frameFactorFor', () => {
  it('returns the tuned factor for a 60 Hz frame', () => {
    expect(frameFactorFor(0.08, 1 / 60)).toBeCloseTo(0.08, 12);
  });

  it('keeps the half-life of inertia the same at every frame rate', () => {
    const halfLifeMs = (hz: number): number => {
      const keptPerFrame = 1 - frameFactorFor(0.08, 1 / hz);
      return (Math.log(0.5) / Math.log(keptPerFrame)) * (1000 / hz);
    };
    const reference = halfLifeMs(60);
    for (const hz of [30, 90, 120, 144]) {
      expect(halfLifeMs(hz)).toBeCloseTo(reference, 6);
    }
  });

  it('applies a smaller step on shorter frames and a larger one on longer frames', () => {
    expect(frameFactorFor(0.08, 1 / 144)).toBeLessThan(0.08);
    expect(frameFactorFor(0.08, 1 / 30)).toBeGreaterThan(0.08);
  });
});
