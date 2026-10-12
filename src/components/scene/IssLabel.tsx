import { Html } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useRef } from 'react';
import { Vector3, type Group } from 'three';

import { formatAltitude } from '@/lib/format/units';
import { useTrackerStore } from '@/lib/state/tracker-store';

import { useIssFrame } from './iss-frame';

/** Slightly over the globe radius so the label also hides while the ISS skims the limb. */
const OCCLUDER_RADIUS = 1.05;
const TEXT_REFRESH_SECONDS = 0.5;

const viewDirection = new Vector3();
const centre = new Vector3();
const offset = new Vector3();

interface TextMemo {
  text: string;
  checkedAt: number;
}

function Label() {
  const issFrame = useIssFrame();
  const camera = useThree((state) => state.camera);
  const anchor = useRef<Group>(null);
  const pill = useRef<HTMLDivElement>(null);
  const altitude = useRef<HTMLSpanElement>(null);
  const memo = useRef<TextMemo>({ text: '', checkedAt: Number.NEGATIVE_INFINITY });

  useFrame(({ clock }) => {
    const root = anchor.current;
    if (!root) return;
    const frame = issFrame.current;
    root.position.copy(frame.position);

    // The camera is orthographic, so "behind the globe" is the same test for every point: it lies
    // beyond the centre plane facing away from the camera, inside the globe's silhouette.
    let hidden = !frame.ready;
    if (!hidden && root.parent) {
      root.parent.getWorldPosition(centre);
      root.getWorldPosition(offset).sub(centre);
      camera.getWorldDirection(viewDirection);
      const towardsCamera = -offset.dot(viewDirection);
      hidden =
        towardsCamera < 0 &&
        offset.lengthSq() - towardsCamera * towardsCamera < OCCLUDER_RADIUS * OCCLUDER_RADIUS;
    }
    if (pill.current) pill.current.style.opacity = hidden ? '0' : '1';

    const elapsed = clock.elapsedTime;
    if (frame.state && altitude.current && elapsed - memo.current.checkedAt > TEXT_REFRESH_SECONDS) {
      memo.current.checkedAt = elapsed;
      const text = formatAltitude(frame.state.altitudeKm, useTrackerStore.getState().units);
      if (text !== memo.current.text) {
        memo.current.text = text;
        altitude.current.textContent = text;
      }
    }
  });

  return (
    <group ref={anchor}>
      <Html center zIndexRange={[5, 0]} pointerEvents="none">
        <div
          ref={pill}
          aria-hidden="true"
          style={{ opacity: 0, transform: 'translateY(-2.2rem)' }}
          className="flex flex-col items-center transition-opacity duration-200"
        >
          <div className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border-2 border-line bg-paper/95 px-2.5 py-0.5 font-display text-xs font-semibold text-ink shadow-[0_3px_0_#EADFD3,0_8px_16px_-10px_rgba(43,45,66,0.35)]">
            <span className="h-2 w-2 rounded-full bg-coral" />
            <span>ISS</span>
            <span ref={altitude} className="font-mono text-[11px] font-medium text-ink-soft" />
          </div>
          <div className="-mt-px h-0 w-0 border-x-[5px] border-t-[6px] border-x-transparent border-t-line" />
        </div>
      </Html>
    </group>
  );
}

/** Small "ISS" tag with the live altitude that follows the station and fades behind the globe. */
export function IssLabel() {
  const visible = useTrackerStore((state) => state.layers.labels);
  return visible ? <Label /> : null;
}
