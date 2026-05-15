# pi-jobs Documentation

This directory contains the design specifications, implementation plans, incident audits, and experiment records for the `pi-jobs` supervised job runtime extension.

## Getting Started

**New contributors** should read in this order:
1. [`../README.md`](../README.md) — Project overview, runtime model, and tool usage
2. [`../extensions/jobs/README.md`](../extensions/jobs/README.md) — Tool API, artifact layout, UI commands
3. [`jobs-supervisor-v3.md`](specs/jobs-supervisor-v3.md) — Authoritative V3 design specification

## Design Specifications

| Document | Status | Summary |
|----------|--------|---------|
| [`jobs-supervisor-v3.md`](specs/jobs-supervisor-v3.md) | Implementation spec | V3 supervisor architecture: child sessions, acceptance contracts, structured reports, retry boundaries |
| [`jobs-v2-spec.md`](specs/jobs-v2-spec.md) | Final pre-implementation | Predecessor design for root-only parallel jobs (replaced by V3) |
| [`2026-03-18-job-session-audit-design.md`](specs/2026-03-18-job-session-audit-design.md) | Approved design | Phase 1 job-session ergonomics: `/jobs-start`, durable artifacts, discoverable incomplete batches |

## Implementation Plans

| Document | Scope |
|----------|-------|
| [`2026-03-18-job-session-audit.md`](plans/2026-03-18-job-session-audit.md) | File structure, module split, test plan, smoke script for job-session auditability |

## Incident Audits

| Document | Date | Summary |
|----------|------|---------|
| [`job-failure-audit-2026-04-26.md`](job-failure-audit-2026-04-26.md) | 2026-04-26 | MICRO102 Stage 9 batch run audit: hard provider errors vs false-positive successes under high concurrency |

## Experiment Records

All experimental findings are recorded in `../experiments/reports/`. A distilled summary is available at:

- [`experiments-summary.md`](experiments-summary.md) — Key conclusions from concurrent-resource, wave-vs-full, and settings-prompt scenes

## Architecture Notes

- [`supervisor-split-feasibility.md`](supervisor-split-feasibility.md) — Feasibility analysis for splitting `supervisor.ts` into smaller modules

## Code Locations

| Concern | Path |
|---------|------|
| Extension entrypoint | [`../extensions/jobs/index.ts`](../extensions/jobs/index.ts) |
| Supervisor runtime | [`../extensions/jobs/supervisor.ts`](../extensions/jobs/supervisor.ts) |
| Worker runner | [`../extensions/jobs/worker-runner.ts`](../extensions/jobs/worker-runner.ts) |
| Jobs plan expansion | [`../extensions/jobs/jobs-plan.ts`](../extensions/jobs/jobs-plan.ts) |
| Acceptance contracts | [`../extensions/jobs/acceptance.ts`](../extensions/jobs/acceptance.ts) |
| Artifact audit log | [`../extensions/jobs/audit-log.ts`](../extensions/jobs/audit-log.ts) |
| Tests | [`../tests/jobs/`](../tests/jobs/) |
