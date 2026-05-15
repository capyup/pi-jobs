# Changelog

All notable changes to the `pi-jobs` supervised job runtime extension.

## [Unreleased]

## [0.3.0] - 2026-05-15

### Added
- Worker extension allowlist via `.pi/jobs-settings.json` `workerExtensions.include`, with an empty default include list while still loading the internal `job-worker-runtime` extension.
- Added support for dynamically loaded prompt files and template files under `extensions/jobs/prompts/`, backed by a prompt-loader.

### Changed
- Child workers now launch with `--no-extensions` plus the explicit allowlist for extension isolation, while preserving the `PI_CHILD_TYPE` nested-jobs guard.
- Narrowed `job`, `jobs`, and `jobs_plan` guidance to reduce duplicate live UI and keep worker instructions focused.
- Simplified JOBS headings in live, final, and fallback output by removing lifecycle glyph counters.

### Fixed
- Updated docs and tests for the worker extension allowlist, prompt loading, isolation behavior, and UI guidance changes.

## [0.2.0] - 2026-05-15

### Added
- Test coverage for `run-jobs.ts` (44 tests covering validation, fanout guards, inline limits, normalization, result text)
- Test coverage for `jobs-plan.ts` (31 tests covering plan input validation, template expansion, acceptance expansion)
- `tsconfig.json` with strict TypeScript compilation settings
- GitHub Actions CI workflow (test, typecheck, smoke)
- Documentation hub at `docs/README.md`
- Experiments summary at `docs/experiments-summary.md`
- Supervisor split feasibility analysis at `docs/supervisor-split-feasibility.md`

## [0.1.0] — 2026-05-15

### Added
- `job` tool — launch one supervised isolated worker
- `jobs` tool — launch ≤4 inline supervised workers (small-batch escape hatch)
- `jobs_plan` tool — compact matrix + template fan-out for large batches (up to 100 jobs)
- `/jobs-start` command — insert job-oriented guidance into editor
- `/jobs-ui` command — batch/job/attempt drill-down with rerun preparation
- `/jobs-settings` command — toggle wave guidance and sync-first policy
- Acceptance contracts — path checks, regex checks, write-boundary validation, deliverables evidence
- Structured `job-report.json` protocol with deliverables, evidence, summary, internal retries
- Parent retry boundary — retry on provider_transient, launch_error, worker_incomplete
- Dynamic throttling — opt-in failure-aware concurrency reduction
- Artifact audit under `.pi/jobs/<batchId>/` with batch.json, events.jsonl, summary.md, plan.json, per-attempt sessions

### Changed
- Renamed extension from `tasks` to `jobs` to clarify supervised-job semantics

### Fixed
- Lighten jobs supervision artifacts to reduce disk I/O overhead
- Harden child worker runtime boundaries (PI_CHILD_TYPE, tool restrictions)
- Guard child worker context growth with session compaction per attempt
- Remove hidden default concurrency cap (now explicit opt-in only)
- Accept trailing-slash write allowlists and ignore supervisor artifacts in write audit
- Reset task state on retry start so live UI shows ◐ + "retry N" instead of stale ✗
- Thinking-only stop no longer counted as success; retryable worker_incomplete classification
- Clearer protocol_error reasons and tighter worker submission prompts
- Stop false acceptance failures from missing telemetry and stale JOB_STATUS markers
- Stop requireDeliverablesEvidence from rejecting valid reports

### Refactored
- Run task workers as full child pi sessions with own session/compaction boundary
- Materialize task views and freeze jobs_plan DSL (no conditionals, loops, or nested workflow)
- Split decision, write evidence, and terminal state into focused modules
- Split UI rendering into job-view, thinking-steps, job-ui modules
