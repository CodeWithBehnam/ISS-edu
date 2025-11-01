import { Canvas } from '@react-three/fiber';
import { Suspense, useCallback, useMemo, useRef, useState } from 'react';
import { AdaptiveDpr, AdaptiveEvents, OrbitControls, Stars } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { ACESFilmicToneMapping, SRGBColorSpace } from 'three';

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
    toggleGroundTrack,
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
    <div className="h-[72vh] w-full min-h-[540px] md:h-[80vh] md:min-h-[620px]">
      <Canvas
        camera={{ position: [0, 0, 4.3], fov: 45 }}
        shadows
        dpr={[1, 1.8]}
        gl={{ antialias: true }}
        onCreated={({ gl }) => {
          gl.outputColorSpace = SRGBColorSpace;
          gl.toneMapping = ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.05;
        }}
      >
        <Suspense fallback={null}>
          <GlobeScene
            ref={globeRef}
            telemetry={telemetry}
            showGroundTrack={showGroundTrack}
            autoRotate={autoRotate}
          />
          <Stars
            radius={140}
            depth={60}
            count={6_000}
            factor={3.5}
            saturation={0.2}
            fade
            speed={0.3}
          />
        </Suspense>
        <OrbitControls
          ref={controlsRef}
          enableDamping
          dampingFactor={0.08}
          enablePan={false}
          minDistance={2.35}
          maxDistance={10}
          minPolarAngle={Math.PI / 4}
          maxPolarAngle={(Math.PI / 2) + Math.PI / 6}
          rotateSpeed={0.6}
          zoomSpeed={0.65}
          target={[0, 0, 0]}
          onStart={handleControlStart}
        />
        <AdaptiveDpr />
        <AdaptiveEvents />
      </Canvas>

      <div className="pointer-events-none absolute inset-0 flex justify-between p-4">
        <div className="pointer-events-auto space-y-2">
          <ToggleButton
            active={showGroundTrack}
            label="Ground track"
            onToggle={toggleGroundTrack}
          />
          <ResetRotationButton autoRotate={autoRotate} onReset={handleResetView} />
        </div>

        <div className="pointer-events-auto self-end">
          <span className="rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-xs text-slate-700 shadow">
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
      className={`rounded-full border px-4 py-2 text-sm transition-colors shadow-sm ${
        active
          ? 'border-sky-400 bg-sky-500 text-white shadow-md hover:bg-sky-400'
          : 'border-slate-200 bg-white/80 text-slate-600 hover:bg-slate-100'
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
      className={`rounded-full border px-4 py-2 text-sm transition-colors shadow-sm ${
        autoRotate
          ? 'border-slate-200 bg-white/80 text-slate-600 hover:bg-slate-100'
          : 'border-sky-400 bg-sky-500 text-white shadow-md hover:bg-sky-400'
      }`}
    >
      {autoRotate ? 'Reset rotation' : 'Resume rotation'}
    </button>
  );
}
