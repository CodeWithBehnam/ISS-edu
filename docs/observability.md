# Observability and Reliability Playbook

## Logging Strategy

- Use the structured `log` helper (`lib/observability/logger.ts`) to emit JSON events enriched with trace identifiers.
- All telemetry-related events are prefixed with `telemetry.` to simplify Logtail queries.
- Console output is compatible with Vercel Edge and Node runtimes; Logtail ingestion uses the same structure via deployment configuration.

## Tracing

- `instrumentation.ts` registers OpenTelemetry via `@vercel/otel` so that API routes and server components participate in distributed traces by default.
- Custom spans can be introduced using `const span = trace.getTracer('orbital-hub').startSpan('operation')` where deeper inspection is required.
- Ensure sensitive metadata is excluded from span attributes.

## Metrics and Alerts

- Target metrics:
  - Cache hit ratio for `iss:state` > 0.6 (alert if below for 5 minutes).
  - Upstream fetch latency < 2 s P95.
  - Telemetry drift < 10 km sustained.
- Configure Logtail alerts keyed to `telemetry.fetch.failure` and `telemetry.cron.failure` events.
- Vercel Analytics provides Core Web Vitals; complement with Playwright synthetic runs.

## Runbooks

- Publish operational runbooks in `docs/runbooks/*.md`. Initial templates should cover telemetry lag, pass prediction anomalies, and localisation issues.
- Each runbook must list impact radius, detection signals, mitigation steps, and escalation contacts.

## Local Diagnostics

- Use `pnpm telemetry:ingest` to run the ingestion cron locally with structured logs.
- Pipe output to tools like `jq` for filtering, e.g. `pnpm telemetry:ingest | jq '.event'`.
- For tracing locally, set `OTEL_EXPORTER_OTLP_ENDPOINT` to a collector or use Lightstep sandbox.

