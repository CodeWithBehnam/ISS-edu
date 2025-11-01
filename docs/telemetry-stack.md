# Telemetry Stack Implementation Notes

## Environment Variables

Set the following variables locally and in Vercel environment settings:

- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- `NASA_API_KEY`
- `TELEMETRY_CACHE_TTL_SECONDS` (optional, default 15)
- `TELEMETRY_DRIFT_THRESHOLD_KM` (optional, default 10)

## Operational Flow

1. `scripts/fetch-telemetry.ts` runs on a 15-second cadence via Vercel cron.
2. The script reuses `lib/api/telemetry.ts` to retrieve cached state or fetch from upstream sources.
3. Fresh telemetry is persisted to Upstash Redis under the `iss:state` key with the configured TTL.
4. Edge route `app/api/iss/live/route.ts` serves cached telemetry, fetching upstream only on cache miss.
5. Drift metrics compare authoritative source data against secondary feeds to detect divergence beyond the configured threshold.

## Monitoring Guidance

- Instrument logging around cache status and upstream latency.
- Alert if drift exceeds threshold for more than three consecutive samples.
- Track cache hit ratio; target >60% under steady traffic.

