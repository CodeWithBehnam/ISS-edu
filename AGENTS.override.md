# AGENTS OVERRIDE

## How to reply to user questions
- analyse my request first, then based on it, attached personality to the request, create one clear goal, find the exact requirments, if needed use the ref and exa mcp server, find the accurate version for any package,, break down somplex into simple tasks and sub tasks.
- DO not generate more than 300 lines of codes on each file
- keep track of what you have learned from your mistake and record them on .learned.md file, create it if doesnt exist.
- add needed constraint 
- Always think hard, Plan, 5-6 tasks list each with 3 -4 sub tasks, then think again, validate, and implement
- Always use Ref mcp server and EXA mcp server to get the information you need
- Always use bun as package manager
- Always use Vite as build tool
- Always use React as UI library
- Always use Tailwind as CSS framework
- Always use TypeScript as programming language
- Always use ESLint as linter
- Always use Prettier as formatter
- Always use Vitest as testing framework
- Always use Chromatic as visual regression testing
- Always use Storybook as component library
- Always use React Router as routing library
- Always use React Query as data fetching library

## How to build the project

- Always use bun run dev to start the development server
- Always use bun run build to build the project
- Always use bun run preview to preview the project
- Always use bun run lint to lint the project
- Always use bun run test to test the project
- Always use bun run format to format the project
- Always use bun run build to build the project
- Always use bun run preview to preview the project
- Always use bun run test:watch to watch the tests
- Always use bun run test:coverage to get the test coverage
- Always use bun run test:ui to get the test UI
- Always use bun run test:e2e to run the e2e tests
- Always use bun run test:e2e:ui to get the e2e test UI
- Always use bun run test:e2e:ui:watch to watch the e2e test UI
- Always use bun run test:e2e:ui:watch:debug to watch the e2e test UI and debug the tests
- Always use bun run test:e2e:ui:watch:debug:full to watch the e2e test UI and debug the tests and full output
- Always use bun run test:e2e:ui:watch:debug:full:verbose to watch the e2e test UI and debug the tests and full output and verbose output
 
# 🧠 Problem-Solving & Issue Handling

## 0) Principles

* **Bias to stabilise first**, then diagnose.
* **Hypothesis-driven troubleshooting**: solve via small, reversible experiments.
* **One clear owner** at any time; shared context in docs, not DMs.
* **Write it down**: every non-trivial incident produces documentation (see templates).

---

## 1) Issue Triage & Response (SEV model)

**Classify severity quickly**

* **SEV1**: Production outage / security breach / data loss. Immediate all-hands.
* **SEV2**: Major user impact or degraded core path; workarounds exist.
* **SEV3**: Minor impact, contained or edge; schedule fix.
* **SEV4**: Cosmetic / low risk; backlog.

**Triage checklist**

* Define **impact** (who/what/how many), **time started**, **blast radius**.
* Decide **rollback** / **feature flag off** / **rate-limit** / **degrade gracefully**.
* Create an **Incident Doc** (use template below) and link everywhere.
* Assign **Incident Lead** (IL) + **Scribe**.

---

## 2) Stabilise → Diagnose → Fix → Verify → Learn (SDFVL)

### A) Stabilise (containment)

* Roll back to last known good build (Vite artefacts / Bun release).
* Disable suspect feature flag, or serve static safe page.
* Apply **circuit-breakers** / **timeouts** / **retries** on critical paths.
* Raise **temporary budgets** (CPU/memory) if needed to keep service alive.

### B) Diagnose (hypothesis loop)

* **State the symptom** clearly (metrics/logs/user reports).
* **Generate hypotheses** (3–5). Prioritise by likelihood × impact.
* **Design a minimal test** for each hypothesis (log/trace/probe).
* **Run one experiment at a time**, record result, update beliefs.

Useful signals:

* Time-series diffs across **deploys**, **traffic spikes**, **config changes**.
* Golden signals: **latency**, **errors**, **saturation**, **traffic**.
* Compare **good vs bad** cohorts (browser, region, version).

### C) Fix

* Prefer **small, reversible** changes.
* Add/extend **tests** (Vitest) that would have caught the issue.
* Keep per-file changes under **300 lines**.

### D) Verify

* **Local** → **Storybook** visual check → **preview** (`bun run preview`) → **canary** → **full rollout**.
* Watch dashboards for **30–60 min** or 2× peak traffic windows.
* Confirm **user-visible** recovery (support tickets/social/analytics).

### E) Learn (RCA & prevention)

* Perform **RCA** within 24–48h (5 Whys + A3 summary).
* Add **permanent countermeasures** (tests, lint rules, CI checks, runbooks).
* Update **`.learned.md`** and link the incident.

---

## 3) Debugging Playbook (quick paths)

* **Build breaks**: clean cache (`bun pm cache rm`), reinstall, re-gen types, re-run ESLint/Prettier.
* **React runtime error**: check component boundaries, React Query stale times, suspense boundaries, error boundaries.
* **Styling**: Tailwind class conflicts → inspect computed styles, ensure `content` paths correct in `tailwind.config`.
* **Routing**: Confirm React Router route order, dynamic params, basename in Vite preview vs prod.
* **Data**: React Query keys stable? Cache invalidation after mutations? Network tab + devtools.
* **E2E flakes**: Add deterministic waits, mock network, isolate time with fake timers.

---

## 4) Decision Frameworks

* **5 Whys** (root cause clarity).
* **A3** (concise end-to-end problem narrative).
* **OODA** (when fast, iterative response is needed).
* **PDCA** (continuous improvement; suits recurring issues).
* **Decision Matrix** (impact vs effort; pick the smallest effective fix first).

---

## 5) Documentation Artifacts (create on every incident)

### A) Incident / Issue Report (copy this into `docs/incidents/YYYY-MM-DD-slug.md`)

```md
# Incident: <short title>
**SEV**: SEV1 | SEV2 | SEV3 | SEV4  
**Status**: Open | Mitigated | Resolved  
**Owner**: <name/handle>  
**Timeline (UTC)**:
- Detected: yyyy-mm-dd hh:mm
- Mitigated: yyyy-mm-dd hh:mm
- Resolved: yyyy-mm-dd hh:mm

## Impact
- Affected users/services:
- Symptoms (metrics, errors, user reports):
- Blast radius:

## Stabilisation Actions
- Rollbacks/flags/limits applied:
- Current residual risk:

## Hypotheses & Experiments
- H1:
  - Test:
  - Result:
- H2:
  - Test:
  - Result:

## Root Cause (5 Whys)
1. Why 1:
2. Why 2:
3. Why 3:
4. Why 4:
5. Why 5:
**True root cause**:

## Fix & Verification
- Code changes (links to PRs/commits):
- Tests added/updated:
- Verification steps & dashboards:
- Rollout plan:

## Follow-ups (with owners & dates)
- [ ] Action 1 — Owner — Due
- [ ] Action 2 — Owner — Due

## Links
- Dashboards:
- Logs/Traces:
- Support tickets:
```

### B) A3 Problem-Solving Sheet (`docs/a3/<slug>.md`)

```md
# A3: <problem title>
## Background
Context, constraints, why this matters.

## Current Condition
Facts, metrics, screenshots, user quotes.

## Goal / Target
Single measurable outcome (SMART).

## Root Cause Analysis
Diagram or bullets; include 5 Whys summary.

## Countermeasures
- CM1:
- CM2:

## Plan (PDCA)
- Plan: tasks, owners, dates
- Do: implementation notes/PRs
- Check: metrics/tests to verify
- Act: bake into standards, runbooks

## Results
Before/after metrics; residual risks.

## Follow-through
What we’ll monitor; future triggers.
```

### C) Decision Log (`docs/decisions/ADR-YYYY-NN.md`)

```md
# ADR-YYYY-NN: <Decision title>
**Status**: Proposed | Accepted | Superseded  
**Context**:  
**Options considered**:  
**Decision**:  
**Consequences** (positive/negative):  
**Review date**:
```

### D) `.learned.md` (append after every notable issue)

```md
# 📘 Learned Log

## yyyy-mm-dd — <slug>
**Context**: link to incident/A3/PR  
**What surprised us**:  
**What we’ll do differently next time**:  
**Guardrails added**: tests/lint/rules/runbooks  
**Residual risks**:  
```

---

## 6) Runbook Conventions

* Place runbooks in `docs/runbooks/<area>.md` (e.g., `payments.md`, `deploys.md`).
* Each runbook includes: **Symptoms → Checks → Fixes → Validations → Rollback**.
* Keep steps **copy-pastable**; prefer `bun run <script>` tasks for repeatable ops.

---

## 7) CI/CD & Quality Gates (tie into the fix/verify stage)

* **Pre-merge**: ESLint, Prettier, TypeScript strict, Vitest unit + coverage thresholds.
* **Visual**: Chromatic check must pass for UI-facing changes.
* **Storybook**: must build; critical stories smoke-tested.
* **E2E**: critical paths tagged `@smoke` run on each PR; full suite nightly.
* **Size guard**: fail build if any file > **300 LOC**.

---

## 8) Folder Layout for Docs

```
docs/
  incidents/
  a3/
  decisions/
  runbooks/
.learned.md
```

---

### How this plugs into your existing standards

* Uses your **“think hard, plan, validate, implement”** loop with explicit SDFVL stages.
* Keeps everything inside the same **Bun + Vite + React + TS + Tailwind** workflow.
* Ensures every incident results in **actionable artefacts** and **preventative guardrails**.

If you want, I can also generate the **four markdown files** above with today’s date and starter content so you can drop them straight into your repo.
