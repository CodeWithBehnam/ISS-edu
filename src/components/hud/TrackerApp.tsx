import { Suspense, lazy, useEffect, useState } from 'react';

import { CrewCard } from '@/components/hud/CrewCard';
import { FlatMapFallback } from '@/components/hud/FlatMapFallback';
import { LiveAnnouncer } from '@/components/hud/LiveAnnouncer';
import { PassesCard } from '@/components/hud/PassesCard';
import { TelemetryCard } from '@/components/hud/TelemetryCard';
import { TimeScrubber } from '@/components/hud/TimeScrubber';
import { TopBar } from '@/components/hud/TopBar';
import { ViewControls } from '@/components/hud/ViewControls';
import { WhereNowCard } from '@/components/hud/WhereNowCard';
import { IconGlobe } from '@/components/kit';
import { ModelErrorBoundary } from '@/components/scene/ModelErrorBoundary';
import type { LiveTelemetry } from '@/lib/api/iss-telemetry';
import { useDeviceCapability } from '@/lib/hooks/useDeviceCapability';
import { useIssRegion } from '@/lib/hooks/useIssRegion';
import { useIssTelemetry } from '@/lib/hooks/useIssTelemetry';
import { useSatrec } from '@/lib/hooks/useIssTle';
import { useMediaQuery } from '@/lib/hooks/useMediaQuery';
import { useReducedMotionSync } from '@/lib/hooks/useReducedMotionSync';
import type { SatRec } from '@/lib/orbit/types';

// The 3D bundle (three, R3F, drei) is the heavy part; loading it lazily lets the HUD paint first.
const TrackerCanvas = lazy(() =>
  import('@/components/scene/TrackerCanvas').then((module) => ({ default: module.TrackerCanvas })),
);

interface StageProps {
  satrec: SatRec | null;
  telemetry: LiveTelemetry | null;
  /** False until the browser has been probed, so the flat map never flashes on WebGL devices. */
  probed: boolean;
  webgl: boolean;
  /** Called when the 3D scene could not start or crashed, and the flat map has taken its place. */
  onSceneFailed: () => void;
}

function StagePlaceholder() {
  return (
    <div role="status" className="grid h-full w-full place-items-center">
      <div className="flex flex-col items-center gap-3 text-ink-soft">
        <span className="grid h-16 w-16 place-items-center rounded-3xl border-2 border-line bg-paper shadow-toy motion-safe:animate-bob">
          <IconGlobe className="h-9 w-9" />
        </span>
        <p className="m-0 font-display text-lg font-semibold">Warming up the globe…</p>
      </div>
    </div>
  );
}

function Stage({ satrec, telemetry, probed, webgl, onSceneFailed }: StageProps) {
  if (!probed) return <StagePlaceholder />;
  const flatMap = <FlatMapFallback satrec={satrec} fallbackTelemetry={telemetry} />;
  if (!webgl) return flatMap;
  // One boundary covers a failed chunk download, a renderer that cannot start and a crash in the scene.
  // The live fix only matters until a TLE arrives; passing it afterwards would re-render the whole
  // scene every few seconds for nothing.
  return (
    <ModelErrorBoundary name="stage" fallback={flatMap} onFail={onSceneFailed}>
      <Suspense fallback={<StagePlaceholder />}>
        <TrackerCanvas satrec={satrec} fallbackTelemetry={satrec ? null : telemetry} />
      </Suspense>
    </ModelErrorBoundary>
  );
}

/** Lives apart from the cards so the once-a-minute announcement does not re-render them. */
function Announcer({ satrec, telemetry }: { satrec: SatRec | null; telemetry: LiveTelemetry | null }) {
  const { state, region } = useIssRegion(satrec, telemetry);
  return <LiveAnnouncer state={state} region={region} />;
}

/*
 * Layout. Below 1024 px everything is one column: the stage first, then controls, then cards,
 * and the page scrolls. From 1024 px the root becomes a fixed three-column grid over a
 * full-bleed stage. The centre column stays empty so the globe and the ISS are never covered.
 * Wrappers ignore the pointer (so the canvas can be dragged through the gaps) and only the
 * cards themselves take it back.
 */
const ROOT_CLASS = [
  'relative isolate grid min-h-svh grid-cols-1 content-start gap-y-4 px-4 pb-[max(2.5rem,env(safe-area-inset-bottom))] max-lg:pt-safe',
  'lg:pointer-events-none lg:fixed lg:inset-0 lg:min-h-0 lg:grid-cols-[var(--hud-col)_minmax(0,1fr)_var(--hud-col)]',
  'lg:grid-rows-[auto_auto_minmax(0,1fr)_auto] lg:gap-x-5 lg:gap-y-3 lg:overflow-hidden lg:px-5 lg:pb-5 lg:pt-4',
  'lg:[--hud-col:18.5rem] xl:[--hud-col:20rem] 2xl:[--hud-col:22rem]',
].join(' ');

/*
 * The columns scroll from 1024 px. Scroll padding keeps a focused control clear of the bottom fade
 * (a 1.75rem mask), and the focus ring is drawn inside the box because the mask would clip it outside.
 */
const COLUMN_CLASS = [
  'z-10 flex min-w-0 flex-col gap-4 lg:pointer-events-none lg:-mx-2 lg:min-h-0 lg:overflow-y-auto lg:overscroll-contain',
  'lg:rounded-3xl lg:px-2 lg:pb-8 lg:pt-1 lg:scroll-pb-12 lg:scroll-pt-4 lg:scroll-soft lg:focus-visible:[outline-offset:-3px]',
  'lg:[&>*]:pointer-events-auto lg:[mask-image:linear-gradient(to_bottom,#000_calc(100%-1.75rem),transparent)]',
].join(' ');

export function TrackerApp() {
  const { satrec, tle, isLoading, refetch: refetchTle } = useSatrec();
  const telemetryQuery = useIssTelemetry();
  const telemetry = telemetryQuery.data ?? null;
  const capability = useDeviceCapability();
  const desktop = useMediaQuery('(min-width: 1024px)');
  useReducedMotionSync();

  // Declared after useDeviceCapability: both effects run in one commit, so `probed` and
  // `capability` change together and the decision below never sees a half-updated pair.
  const [probed, setProbed] = useState(false);
  useEffect(() => {
    setProbed(true);
  }, []);

  const [sceneFailed, setSceneFailed] = useState(false);
  const flat = probed && (capability !== 'webgl' || sceneFailed);
  // Only the columns scroll, and only from 1024 px, so only there are they worth a tab stop.
  const columnFocus = desktop ? 0 : undefined;

  return (
    <main className={ROOT_CLASS}>
      <TopBar className="z-10 lg:pointer-events-auto lg:col-span-3 lg:row-start-1" />

      <section
        aria-label="Live view of the International Space Station above Earth"
        className="relative z-0 -mx-4 h-[60svh] min-h-[19rem] lg:pointer-events-auto lg:absolute lg:inset-x-0 lg:bottom-0 lg:top-[5.5rem] lg:mx-0 lg:h-auto lg:min-h-0"
      >
        <div className="absolute inset-0">
          <Stage
            satrec={satrec}
            telemetry={telemetry}
            probed={probed}
            webgl={capability === 'webgl'}
            onSceneFailed={() => setSceneFailed(true)}
          />
        </div>
      </section>

      {/*
        On phones the time and view controls overlap the stage's lower edge like a peeking sheet, with
        the time controls first so they stay on the first screen. From 1024 px the wrapper dissolves
        and each control takes its own grid cell.
      */}
      <div className="relative z-10 flex flex-col gap-3 max-lg:-mt-10 lg:contents">
        <TimeScrubber className="relative z-10 lg:pointer-events-auto lg:col-span-3 lg:col-start-1 lg:row-start-4 lg:w-[min(44rem,100%)] lg:justify-self-center xl:col-span-1 xl:col-start-2" />
        <ViewControls
          flat={flat}
          className="relative z-10 lg:pointer-events-auto lg:col-start-3 lg:row-start-2"
        />
      </div>

      <section
        aria-label="Live station readings"
        tabIndex={columnFocus}
        className={`${COLUMN_CLASS} lg:col-start-1 lg:row-span-2 lg:row-start-2 xl:row-span-3`}
      >
        {/* Location first: it is short, so "Over Brazil" shows without scrolling on a laptop screen. */}
        <WhereNowCard satrec={satrec} telemetry={telemetry} />
        <TelemetryCard
          satrec={satrec}
          tle={tle}
          telemetry={telemetry}
          loading={isLoading || telemetryQuery.isLoading}
        />
      </section>

      <section
        aria-label="Passes and crew"
        tabIndex={columnFocus}
        className={`${COLUMN_CLASS} lg:col-start-3 lg:row-start-3 xl:row-span-2`}
      >
        <PassesCard
          satrec={satrec}
          orbitFailed={satrec === null && !isLoading}
          onRetryOrbit={refetchTle}
        />
        <CrewCard />
      </section>

      <Announcer satrec={satrec} telemetry={telemetry} />
    </main>
  );
}
