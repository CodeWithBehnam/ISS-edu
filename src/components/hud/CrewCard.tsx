import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';

import { Card, IconRefresh, IconUsers } from '@/components/kit';
import { daysAboard, thumbnailUrl } from '@/lib/api/crew';
import type { CrewInfo, CrewMember } from '@/lib/api/crew';
import { flagEmoji } from '@/lib/geo/regions';
import { useCrew } from '@/lib/hooks/useCrew';

export interface CrewCardProps {
  className?: string;
}

/** The feed fills missing text with "Unknown"; hiding it reads better than printing it. */
const isKnown = (value: string): boolean => value !== 'Unknown';

const plural = (count: number, one: string, many: string): string => (count === 1 ? one : many);

const dayCount = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 0 });

/** Day counts only change once a day, so a minute is a generous tick. */
const CLOCK_TICK_MS = 60_000;
/** 2x the 48 px portrait and the 56 px patch, for sharp pictures on high-density screens. */
const PORTRAIT_SOURCE_PX = 96;
const PATCH_SOURCE_PX = 112;

function useCoarseNow(): number {
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), CLOCK_TICK_MS);
    return () => window.clearInterval(timer);
  }, []);
  return nowMs;
}

/** The feed's own figure is only a fallback: it counts earlier flights, not this stay. */
function describeTimeAboard(member: CrewMember, nowMs: number): string | null {
  const aboard = daysAboard(member.launchedAt, nowMs);
  if (aboard !== null) return `Aboard for ${dayCount.format(aboard)} ${plural(aboard, 'day', 'days')}`;
  if (member.daysInSpace === null) return null;
  return `${dayCount.format(member.daysInSpace)} ${plural(member.daysInSpace, 'day', 'days')} in space`;
}

function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children}
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter((word) => word !== '')
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join('');
}

type ImageStage = 'thumbnail' | 'original' | 'failed';

interface CrewImageProps {
  url: string;
  sourcePx: number;
  size: number;
  alt: string;
  className: string;
  /** Shown once neither the thumbnail nor the original could be loaded. */
  fallback?: ReactNode;
}

/**
 * Asks for a small thumbnail first (the originals are megabytes), falls back to the original file if
 * the thumbnail is refused, and gives up after that. Key it by URL so a new picture starts afresh.
 */
function CrewImage({ url, sourcePx, size, alt, className, fallback = null }: CrewImageProps) {
  const [stage, setStage] = useState<ImageStage>('thumbnail');
  const thumbnail = thumbnailUrl(url, sourcePx);
  if (stage === 'failed') return <>{fallback}</>;

  return (
    <img
      src={stage === 'thumbnail' ? thumbnail : url}
      alt={alt}
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      // A CORS-mode request carries no credentials, and the browser then ignores the cookie that
      // the image host would otherwise set (Wikimedia sends one on every response).
      crossOrigin="anonymous"
      className={className}
      onError={() => setStage(stage === 'thumbnail' && thumbnail !== url ? 'original' : 'failed')}
    />
  );
}

/**
 * Fixed 48 px box, so a slow or failed portrait never moves the rows around it. The initials sit
 * underneath the photo, which means there is something to look at while it loads or if it never does.
 */
function Portrait({ member }: { member: CrewMember }) {
  return (
    <span className="relative grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-2xl border-2 border-line bg-peach">
      <span className="font-display text-sm font-semibold text-ink" aria-hidden="true">
        {initialsOf(member.name)}
      </span>
      {member.imageUrl ? (
        <CrewImage
          key={member.imageUrl}
          url={member.imageUrl}
          sourcePx={PORTRAIT_SOURCE_PX}
          size={48}
          alt={`Portrait of ${member.name}`}
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : null}
    </span>
  );
}

function CrewRow({ member, nowMs }: { member: CrewMember; nowMs: number }) {
  const flag = flagEmoji(member.flagCode);
  // Without a flag the country would otherwise vanish from the row.
  const subtitle = [
    isKnown(member.agency) ? member.agency : null,
    flag || !isKnown(member.country) ? null : member.country,
    member.position,
  ].filter((part): part is string => part !== null);
  const aboard = [
    isKnown(member.spacecraft) ? member.spacecraft : null,
    describeTimeAboard(member, nowMs),
  ].filter((part): part is string => part !== null);

  return (
    <li className="flex items-start gap-3 rounded-2xl border-2 border-line bg-cream/60 p-2.5">
      <Portrait member={member} />
      <div className="min-w-0 flex-1">
        <p className="m-0 flex flex-wrap items-center gap-x-1.5 font-display text-base font-semibold leading-tight">
          {flag ? (
            <span role="img" aria-label={member.country}>
              {flag}
            </span>
          ) : null}
          <span className="min-w-0 break-words">
            {member.url ? <ExternalLink href={member.url}>{member.name}</ExternalLink> : member.name}
          </span>
        </p>
        {subtitle.length > 0 ? (
          <p className="m-0 mt-0.5 text-xs font-semibold text-ink-soft">{subtitle.join(' · ')}</p>
        ) : null}
        {aboard.length > 0 ? (
          <p className="m-0 mt-0.5 text-xs font-semibold text-ink-soft">{aboard.join(' · ')}</p>
        ) : null}
      </div>
    </li>
  );
}

function PatchFallback() {
  return (
    <span className="text-2xl" aria-hidden="true">
      🛰️
    </span>
  );
}

function ExpeditionHeader({ crew }: { crew: CrewInfo }) {
  const count = crew.people.length;
  const title = crew.expedition === null ? 'Current crew' : `Expedition ${crew.expedition}`;
  return (
    <div className="mb-3 flex items-center gap-3">
      <span className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-full border-2 border-line bg-paper">
        {crew.patchUrl ? (
          <CrewImage
            key={crew.patchUrl}
            url={crew.patchUrl}
            sourcePx={PATCH_SOURCE_PX}
            size={56}
            alt={
              crew.expedition === null
                ? 'Mission patch of the current ISS expedition'
                : `Mission patch of Expedition ${crew.expedition}`
            }
            className="h-full w-full object-contain"
            fallback={<PatchFallback />}
          />
        ) : (
          <PatchFallback />
        )}
      </span>
      <div className="min-w-0">
        <p className="m-0 font-display text-lg font-semibold leading-tight">{title}</p>
        <p className="m-0 text-xs font-semibold text-ink-soft">
          {count} {plural(count, 'person', 'people')} aboard right now
        </p>
        {crew.expeditionUrl ? (
          <p className="m-0 mt-0.5 text-xs font-bold">
            <ExternalLink href={crew.expeditionUrl}>About this expedition</ExternalLink>
          </p>
        ) : null}
      </div>
    </div>
  );
}

function CrewSkeleton() {
  return (
    <div aria-busy="true">
      <p role="status" className="sr-only">
        Loading the crew list.
      </p>
      <div aria-hidden="true">
        <div className="mb-3 flex items-center gap-3">
          <div className="toy-skeleton h-14 w-14 shrink-0 rounded-full" />
          <div className="space-y-2">
            <div className="toy-skeleton h-5 w-36" />
            <div className="toy-skeleton h-3.5 w-28" />
          </div>
        </div>
        <div className="space-y-2">
          {[0, 1, 2].map((row) => (
            <div key={row} className="toy-skeleton h-[4.5rem] w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}

/** Who is on the ISS right now. A failed feed shows a small note, never an error page. */
export function CrewCard({ className }: CrewCardProps) {
  const { data, isError, isFetching, refetch } = useCrew();
  const nowMs = useCoarseNow();

  let body: ReactNode;
  if (data) {
    body =
      data.people.length === 0 ? (
        <p className="m-0 text-sm font-semibold text-ink-soft">
          The crew list is empty in the feed right now. Check back soon.
        </p>
      ) : (
        <>
          <ExpeditionHeader crew={data} />
          <ul className="m-0 list-none space-y-2 p-0">
            {data.people.map((member, index) => (
              <CrewRow key={`${member.name}-${index}`} member={member} nowMs={nowMs} />
            ))}
          </ul>
        </>
      );
  } else if (isError) {
    body = (
      <div role="status" className="rounded-2xl border-2 border-blush bg-peach/50 px-3 py-3">
        <p className="m-0 text-sm font-bold text-ink">Crew feed unavailable</p>
        <p className="m-0 mt-1 text-xs font-semibold text-ink">
          The astronauts are still up there. We just cannot fetch their names right now.
        </p>
        <button
          type="button"
          className="toy-btn toy-btn-sm mt-3"
          disabled={isFetching}
          onClick={() => void refetch()}
        >
          <IconRefresh className="h-3.5 w-3.5" />
          {isFetching ? 'Trying again' : 'Try again'}
        </button>
      </div>
    );
  } else {
    body = <CrewSkeleton />;
  }

  return (
    <Card title="Crew aboard" icon={<IconUsers className="h-5 w-5" />} className={className}>
      {body}
    </Card>
  );
}
