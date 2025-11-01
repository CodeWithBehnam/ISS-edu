# Runbook: Pass Prediction Errors

- **Impact**: Users receive inaccurate pass windows or magnitude estimates; educator exports misalign with actual sightings.
- **Detection**: Automated regression tests comparing predictions with reference NASA data fail; logs show `pass-predictor.drift` events; support tickets referencing missed passes.
- **Primary Checks**:
  1. Verify latest TLE ingestion timestamp (`telemetry.cron.persisted` context).
  2. Re-run `scripts/generate-pass-tiles.ts` (to be implemented) in staging with verbose logging.
  3. Confirm `TELEMETRY_DRIFT_THRESHOLD_KM` hasn't been exceeded, prompting fallback propagation.
- **Mitigation**:
  - Force refresh of CelesTrak TLE dataset.
  - Invalidate Redis cache for affected location buckets (`iss:passes:*`).
  - Compare outputs with `skyfield` reference script; adjust atmospheric refraction model if diverging.
- **Escalation**: Loop in Data Engineer when delta persists beyond 3 passes or if divergence exceeds 15 minutes.

