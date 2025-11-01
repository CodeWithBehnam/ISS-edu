# Runbook: Live Telemetry Lag

- **Impact**: Users see stale ISS position, pass predictor drift exceeds tolerance, status panel reports cache miss streak.
- **Detection**: Monitor `telemetry.cron.failure` events, Redis TTL breaches, and drift telemetry >10 km.
- **Primary Checks**:
  1. Ensure Vercel cron executed within past minute (`vercel cron ls`).
  2. Inspect Logtail for upstream latency spikes (`event:"telemetry.fetch.failure"`).
  3. Validate Redis connectivity via `pnpm telemetry:ingest` locally with production credentials.
- **Mitigation**:
  - Restart cron or trigger manual ingestion.
  - Temporarily increase cache TTL to 60 seconds via environment override.
  - Enable SGP4 fallback by forcing `allowInsecure=false` and verifying propagation.
- **Escalation**: Notify Technical Lead on Slack `#orbital-ops` after 10 minutes unresolved.

