import { NextResponse } from 'next/server';
import { getTelemetryState, fetchLatestTelemetry } from '@/lib/api/telemetry';
import { log } from '@/lib/observability/logger';

export const runtime = 'edge';
export const revalidate = 0;

export async function GET() {
  const cached = await getTelemetryState();

  if (cached) {
    log({
      event: 'telemetry.cache.hit',
      context: { source: cached.envelope.data.source },
    });
    return NextResponse.json({
      ...cached,
      envelope: {
        ...cached.envelope,
        cacheStatus: 'hit',
      },
    });
  }

  log({ event: 'telemetry.cache.miss' });
  const latest = await fetchLatestTelemetry({ allowInsecure: false });

  if (!latest) {
    log({
      event: 'telemetry.fetch.failure',
      level: 'error',
      context: { endpoint: '/api/iss/live' },
    });
    return NextResponse.json(
      {
        error: 'Unable to retrieve ISS telemetry from upstream sources.',
      },
      { status: 503 }
    );
  }

  log({
    event: 'telemetry.fetch.success',
    context: { source: latest.envelope.data.source },
  });
  return NextResponse.json(latest, {
    headers: {
      'Cache-Control': 's-maxage=5, stale-while-revalidate=10',
    },
  });
}

