#!/usr/bin/env node
import { fetchLatestTelemetry, getTelemetryState } from '../lib/api/telemetry';
import { log } from '../lib/observability/logger';

async function main() {
  const state = await getTelemetryState();
  if (state) {
    log({ event: 'telemetry.cron.cache_hit', context: state.envelope });
    return;
  }

  log({ event: 'telemetry.cron.cache_miss' });
  const latest = await fetchLatestTelemetry({ allowInsecure: true });
  if (!latest) {
    log({
      event: 'telemetry.cron.failure',
      level: 'error',
      context: { message: 'Unable to fetch data from any upstream source' },
    });
    process.exitCode = 1;
    return;
  }

  log({
    event: 'telemetry.cron.persisted',
    context: latest.envelope,
  });
}

main().catch((error) => {
  log({
    event: 'telemetry.cron.unhandled',
    level: 'error',
    context: { message: (error as Error).message },
  });
  process.exitCode = 1;
});

