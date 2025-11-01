'use client';

import { Canvas } from '@react-three/fiber';
import { Suspense, useCallback, useMemo, useRef, useState } from 'react';
import { AdaptiveDpr, AdaptiveEvents, OrbitControls, Stars } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';

import { useSettingsStore } from '@/lib/state/settings-store';
import type { TelemetryState } from '@/lib/types/telemetry';
import { GlobeScene, type GlobeSceneHandle } from '../three/GlobeScene';

interface GlobeExperienceProps {
  telemetry: TelemetryState | null;
  busy: boolean;
}

export function GlobeExperience({ telemetry, busy }: GlobeExperienceProps) {
  const {
    showGroundTrack,
    showCityLights,
    showTerminator,
    showAurora,
    toggleGroundTrack,
    toggleCityLights,
    toggleTerminator,
    toggleAurora,
  } = useSettingsStore();
  const controlsRef = useRef<OrbitControlsImpl | null>(null);
  const globeRef = useRef<GlobeSceneHandle | null>(null);
  const [autoRotate, setAutoRotate] = useState(true);

  const handleControlStart = useCallback(() => {
    setAutoRotate(false);
  }, []);

  const handleResetView = useCallback(() => {
    controlsRef.current?.reset();
    globeRef.current?.resetOrientation();
    setAutoRotate(true);
  }, []);

  const statusLabel = useMemo(() => {
    if (busy) return 'Updating telemetry…';
    return autoRotate ? 'Streaming telemetry' : 'Rotation paused — reset to resume';
  }, [autoRotate, busy]);

  return (
    <div className="h-[60vh] w-full min-h-[480px]">
      <Canvas camera={{ position: [0, 0, 5], fov: 45 }} shadows>
        <Suspense fallback={null}>
          <GlobeScene
            ref={globeRef}
            telemetry={telemetry}
            showGroundTrack={showGroundTrack}
            showCityLights={showCityLights}
            showTerminator={showTerminator}
            showAurora={showAurora}
            autoRotate={autoRotate}
          />
          <Stars
            radius={100}
            depth={50}
            count={8_000}
            factor={4}
            saturation={0}
            speed={0.5}
          />
        </Suspense>
        <OrbitControls
          ref={controlsRef}
          enablePan
          enableZoom
          enableRotate
          minDistance={2}
          maxDistance={12}
          onStart={handleControlStart}
        />
        <AdaptiveDpr pixelated />
        <AdaptiveEvents />
      </Canvas>

      <div className="pointer-events-none absolute inset-0 flex justify-between p-4">
        <div className="pointer-events-auto space-y-2">
          <ToggleButton
            active={showGroundTrack}
            label="Ground track"
            onToggle={toggleGroundTrack}
          />
          <ToggleButton
            active={showCityLights}
            label="City lights"
            onToggle={toggleCityLights}
          />
          <ToggleButton
            active={showTerminator}
            label="Terminator"
            onToggle={toggleTerminator}
          />
          <ToggleButton
            active={showAurora}
            label="Aurora overlay"
            onToggle={toggleAurora}
          />
          <ResetRotationButton autoRotate={autoRotate} onReset={handleResetView} />
        </div>

        <div className="pointer-events-auto self-end">
          <span className="rounded-full bg-slate-900/70 px-3 py-1 text-xs text-slate-200 shadow">
            {statusLabel}
          </span>
        </div>
      </div>
    </div>
  );
}

function ToggleButton({
  label,
  active,
  onToggle,
}: {
  label: string;
  active: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={active}
      className={`rounded-full px-4 py-2 text-sm transition-colors ${
        active
          ? 'bg-sky-500/80 text-white hover:bg-sky-400'
          : 'bg-slate-800/70 text-slate-300 hover:bg-slate-700'
      }`}
    >
      {label}
    </button>
  );
}

function ResetRotationButton({
  autoRotate,
  onReset,
}: {
  autoRotate: boolean;
  onReset: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onReset}
      className={`rounded-full px-4 py-2 text-sm transition-colors ${
        autoRotate
          ? 'bg-slate-700/70 text-slate-200 hover:bg-slate-600'
          : 'bg-sky-500/80 text-white hover:bg-sky-400'
      }`}
    >
      {autoRotate ? 'Reset rotation' : 'Resume rotation'}
    </button>
  );
}
