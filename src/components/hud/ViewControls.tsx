import type { ReactNode } from 'react';
import clsx from 'clsx';

import {
  IconButton,
  IconCrosshair,
  IconLayers,
  IconLocate,
  IconMapPin,
  IconOrbit,
  SegmentedControl,
  ToggleChip,
} from '@/components/kit';
import type { SegmentedOption } from '@/components/kit';
import { useTrackerStore } from '@/lib/state/tracker-store';
import type { Layers, ViewMode } from '@/lib/state/tracker-store';

const VIEW_OPTIONS: readonly SegmentedOption<ViewMode>[] = [
  { value: 'follow', label: 'Follow' },
  { value: 'isometric', label: 'Isometric' },
  { value: 'free', label: 'Free' },
];

interface LayerChip {
  key: keyof Layers;
  label: string;
  icon: ReactNode;
}

const LAYER_CHIPS: readonly LayerChip[] = [
  { key: 'orbit', label: 'Orbit', icon: <IconOrbit className="h-4 w-4" /> },
  { key: 'footprint', label: 'Footprint', icon: <IconCrosshair className="h-4 w-4" /> },
  { key: 'clouds', label: 'Clouds', icon: <IconLayers className="h-4 w-4" /> },
  { key: 'labels', label: 'Labels', icon: <IconMapPin className="h-4 w-4" /> },
];

export interface ViewControlsProps {
  className?: string;
  /** The flat map is showing instead of the 3D scene, so there is no camera or layer to control. */
  flat?: boolean;
}

export function ViewControls({ className, flat = false }: ViewControlsProps) {
  const viewMode = useTrackerStore((state) => state.viewMode);
  const layers = useTrackerStore((state) => state.layers);
  const setViewMode = useTrackerStore((state) => state.setViewMode);
  const toggleLayer = useTrackerStore((state) => state.toggleLayer);
  const requestCameraReset = useTrackerStore((state) => state.requestCameraReset);

  if (flat) return null;

  return (
    <section
      aria-label="View controls"
      className={clsx('toy-card flex flex-col gap-3 rounded-3xl p-3 sm:p-4', className)}
    >
      <div className="flex items-center gap-2">
        <SegmentedControl
          options={VIEW_OPTIONS}
          value={viewMode}
          onChange={setViewMode}
          ariaLabel="Camera view"
          className="min-w-0 flex-1 [&>button]:flex-1 [&>button]:px-2"
        />
        {/* Follow and Isometric put the camera back on their own, so reset only has work to do in Free. */}
        <IconButton
          label="Reset view"
          size="sm"
          onClick={requestCameraReset}
          disabled={viewMode !== 'free'}
        >
          <IconLocate className="h-5 w-5" />
        </IconButton>
      </div>

      {/* Two columns keep the chips equal in width, however long their labels are. */}
      <div
        className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-2"
        role="group"
        aria-label="Scene layers"
      >
        {LAYER_CHIPS.map(({ key, label, icon }) => (
          <ToggleChip
            key={key}
            pressed={layers[key]}
            onToggle={() => toggleLayer(key)}
            label={label}
            icon={icon}
            className="w-full justify-between"
          />
        ))}
      </div>
    </section>
  );
}
