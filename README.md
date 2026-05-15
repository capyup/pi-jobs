# pi-jobs

Local pi package for the supervised job runtime exposed through `job`, `jobs`, and `jobs_plan`.

This repository is the source of truth for job-related pi work.
Do not maintain the live runtime copy by syncing from `pi-tools` anymore.

## What lives here

- `extensions/jobs/` - the job extension and supervisor runtime modules
- `tests/jobs/` - focused Node tests for status, audit artifacts, supervisor behavior, retry, throttle, UI helpers, and smoke fixtures
- `scripts/jobs-audit-smoke.sh` - end-to-end temp-workspace smoke validation
- `docs/specs/` - job design specs, including `jobs-supervisor-v3.md`
- `docs/plans/` - implementation plans for job runtime work

## Runtime model

Jobs Supervisor V3 treats each job as a supervised worker attempt.

- The root process owns planning, scheduling, retry classification, acceptance checks, and synthesis.
- Fan-out is explicit. The primary fan-out tool is `jobs_plan`: a compact `matrix + promptTemplate + acceptanceTemplate` payload that the extension expands locally into N supervised jobs. Inline `jobs` is a small-batch escape hatch (<=4 jobs, <=8000 prompt bytes) and rejects oversized payloads with a pointer to `jobs_plan`.
- Concurrency is explicit when capped: omitting `concurrency` runs every supplied leaf job concurrently; root agents should split large batches into explicit waves of about 4-6 jobs unless the user asks for full concurrency. Dynamic throttling is opt-in via `throttle.enabled: true`.
- Each worker is a full child `pi --mode json -p --session <attempt>/session.jsonl` process with its own session/compaction boundary; the parent only supervises stdout JSONL, artifacts, and the structured report protocol.
- Workers handle recoverable work-level errors themselves and should submit `job-report.json` via the child-only `job_report` tool or file fallback when practical.
- Parent retry is reserved for launch/session/provider transient failures and no-signal worker incompletion.
- `success` requires runtime success, acceptance pass when an acceptance contract exists, either a completed report or visible terminal completion when no acceptance contract exists, and finalized audit artifacts.
- Legacy `JOB_STATUS` markers are only warning signals; they are not a completion protocol.

Batch artifacts live under:

```text
.pi/jobs/<batchId>/
  batch.json
  events.jsonl
  summary.md
  plan.json                  # only present when jobs_plan was used
  jobs/<jobId>.json
  attempts/<jobId>/attempt-N/
```

`.pi/jobs/**` is a sensitive audit directory and may include full prompts, child sessions, stdout/stderr, and local paths.

## Settings UI

Use `/jobs-settings` to inspect or update the focused policy controls:

- report policy: fixed default, with acceptance report is optional audit evidence; without acceptance require report or visible terminal completion;
- jobs_plan wave guidance: default enabled, about 4-6 jobs per explicit wave for large batches;
- sync-first guidance: default enabled, keeps the extension oriented around blocking parent-tool runs and avoids scheduler/background/steer/resume complexity.

## Artifact UI

Use `/jobs-ui` to navigate persisted artifacts:

```text
/jobs-ui
/jobs-ui help
/jobs-ui <batchId>
/jobs-ui <batchId> job <jobId>
/jobs-ui <batchId> attempt <jobId> <attemptId|latest>
/jobs-ui rerun failed <batchId>
/jobs-ui rerun acceptance-failed <batchId>
/jobs-ui rerun provider-transient <batchId>
/jobs-ui rerun selected <batchId> <jobId> [jobId...]
```

The UI is artifact-first: batch detail groups failures, job detail shows acceptance/report state, attempt detail shows runtime fields, thinking/tool activity, and artifact paths, and rerun preparation preserves parent batch provenance. Live `job` / `jobs` updates also show recent per-job thinking/activity lines while workers run.

## Load it in pi

Install the published package from npm:

```bash
pi install npm:@capyup/pi-jobs
```

For local development, add this repository as a local package in `~/.pi/agent/settings.json`, or install it directly:

```bash
pi install /Users/lucas/Developer/pi-jobs
```

Pi will load the extension from:

- `extensions/jobs/index.ts`

## Local validation

```bash
cd /Users/lucas/Developer/pi-jobs
npm run test
npm run smoke
```

## Key docs

- `docs/specs/jobs-supervisor-v3.md` - authoritative V3 design history
- `docs/job-failure-audit-2026-04-26.md` - incident audit and V3 replacement notes
- `extensions/jobs/README.md` - tool usage and artifact overview
