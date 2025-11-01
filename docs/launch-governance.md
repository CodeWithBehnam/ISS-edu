# Launch Governance and Readiness

## Stage Gates

| Gate | Timing | Criteria |
| --- | --- | --- |
| **Beta Exit** | Week 18 | Telemetry drift < 10 km; Mission Academy episodes ≥ 3; Accessibility audit passed; Educator feedback incorporated |
| **Launch Readiness Review (LRR)** | Week 23 | CI pipeline green; Core Web Vitals ≥ P75 90th percentile; observability dashboards configured; runbooks approved |
| **Launch** | Week 24 | Stakeholder sign-off, support rota staffed, marketing assets scheduled |

## Testing Matrix

- **Unit**: Vitest suites covering telemetry utilities, state stores, localisation helpers (target ≥ 80% branch coverage).
- **Integration**: Playwright tests for Orbital Panorama controls, Mission Academy locale toggles, API error states.
- **Visual Regression**: Chromatic snapshots for primary routes with `prefers-reduced-motion` enforced.
- **Performance**: Lighthouse CI budgets (LCP ≤ 2.0 s mobile, TBT ≤ 200 ms), WebGL frame benchmarks using puppeteer harness.
- **Accessibility**: axe-core in Storybook CI; manual audits with ScreenReader trio (VoiceOver, NVDA, Narrator).
- **Security**: OWASP ZAP scan in staging; dependency scanning via Dependabot/Snyk; rate-limit validation.

## Pre-launch Checklist

- [ ] Finalise environment secrets (`NASA_API_KEY`, Upstash credentials) in Vercel production.
- [ ] Populate CMS with launch content and enable webhook revalidation.
- [ ] Configure Vercel cron for telemetry ingestion (15 s) and content refresh (hourly).
- [ ] Confirm analytics connectors (Vercel Analytics, PostHog) capturing anonymised data.
- [ ] Execute disaster recovery drill: restore Redis snapshot + PlanetScale backup into staging.
- [ ] Prepare educator comms pack (lesson PDFs, kiosk instructions).

## Post-launch Next Actions

1. Instrument Observation Exchange moderation workflow (Beta +3 months scope).
2. Expand localisation to French and seed translation memory.
3. Prototype SGP4 WebAssembly module for client-side visualisations.
4. Publish public API documentation via Docusaurus.
5. Schedule quarterly governance review to reassess risk register.

