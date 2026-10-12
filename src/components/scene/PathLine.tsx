import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo } from 'react';
import { Line2 } from 'three/examples/jsm/lines/Line2.js';
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';

import type { Tuple3 } from '@/lib/orbit/frames';
import { useTrackerStore } from '@/lib/state/tracker-store';

export interface PathDash {
  size: number;
  gap: number;
  /** Scene units per second the pattern crawls along the line; leave out for a still pattern. */
  speed?: number;
}

export interface PathLineProps {
  /** Replacing the points swaps the geometry only: the material and its shader program stay alive. */
  points: readonly Tuple3[];
  color: string;
  lineWidth: number;
  opacity: number;
  dash?: PathDash;
}

function createLine(): Line2 {
  return new Line2(new LineGeometry(), new LineMaterial({ transparent: true, depthWrite: false }));
}

/**
 * A fat line (Line2) that owns one geometry and one material for its whole life. drei's <Line> disposes
 * its material whenever `points` changes, so the dashed shader program was destroyed and relinked on
 * every orbit resample (about 16 times a second at 600x playback).
 */
export function PathLine({ points, color, lineWidth, opacity, dash }: PathLineProps) {
  const width = useThree((state) => state.size.width);
  const height = useThree((state) => state.size.height);
  const line = useMemo(createLine, []);

  const dashed = dash !== undefined;
  const dashSize = dash?.size ?? 1;
  const dashGap = dash?.gap ?? 1;
  const dashSpeed = dash?.speed ?? 0;

  useLayoutEffect(() => {
    const next = new LineGeometry();
    next.setPositions(points.flat());
    const previous = line.geometry;
    line.geometry = next;
    // Dash patterns are measured along the line, so the distances follow every new geometry.
    line.computeLineDistances();
    previous.dispose();
  }, [line, points]);

  useLayoutEffect(() => {
    const { material } = line;
    material.color.set(color);
    material.linewidth = lineWidth;
    material.opacity = opacity;
    material.dashed = dashed;
    material.dashSize = dashSize;
    material.gapSize = dashGap;
  }, [line, color, lineWidth, opacity, dashed, dashSize, dashGap]);

  // This three release does not track the viewport itself, and a wrong size skews the line width.
  useLayoutEffect(() => {
    line.material.resolution.set(width, height);
  }, [line, width, height]);

  useEffect(
    () => () => {
      line.geometry.dispose();
      line.material.dispose();
    },
    [line],
  );

  useFrame((_, dt) => {
    if (dashSpeed === 0 || useTrackerStore.getState().reducedMotion) return;
    // Dash coordinates grow along the line, so a falling offset slides the pattern forwards.
    const { material } = line;
    material.dashOffset = (material.dashOffset - dt * dashSpeed) % (dashSize + dashGap);
  });

  return <primitive object={line} />;
}
