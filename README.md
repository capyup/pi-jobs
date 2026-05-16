# pi-jobs

Local pi package for the supervised job runtime exposed through `job`, `jobs`, and `jobs_plan`.

This repository is the source of truth for job-related pi work.
Do not maintain the live runtime copy by syncing from `pi-tools` anymore.

## What lives here

- `extensions/jobs/` - the job extension and supervisor runtime modules
- `extensions/jobs/prompts/` - dynamically loaded guidance, tool prompt text, and worker prompt templates for easy local debugging
- `tests/jobs/` - focused Node tests for status, audit artifacts, supervisor behavior, retry, throttle, UI helpers, and smoke fixtures
- `scripts/jobs-audit-smoke.sh` - end-to-end temp-workspace smoke validation
- `docs/specs/` - job design specs, including `jobs-supervisor-v3.md`
- `docs/plans/` - implementation plans for job runtime work

## Runtime model

Jobs Supervisor V3 treats each job as a supervised worker attempt.

- The root process owns planning, scheduling, retry classification, acceptance checks, and synthesis.
- Use job workers narrowly: not for ordinary main-quest work the root agent can handle well, not when parallelism is unnecessary, not when workers could touch the same files or need tight shared state, and not when the root agent should directly learn/debug the process details.
- Use job workers when the user explicitly requests parallel jobs/agents, when the work would consume lots of context and only final deliverables matter, or for separable research/reporting/audit/review directions.
- Fan-out is explicit. Prefer `jobs_plan`: a compact `matrix + promptTemplate + acceptanceTemplate` payload that the extension expands locally into N supervised jobs. Inline `jobs` is a small-batch escape hatch (<=4 jobs, <=8000 prompt bytes) and rejects oversized payloads with a pointer to `jobs_plan`.
- Concurrency is explicit when capped: omitting `concurrency` runs every supplied leaf job concurrently; root agents should split large batches into explicit `jobs_plan` waves of about 4-6 jobs unless the user asks for full concurrency. Dynamic throttling is opt-in via `throttle.enabled: true`.
- Every job has a finite hard timeout. Set `timeoutMs` to about 2x expected work duration; omitted or invalid values default to 10 minutes (600000 ms), with a clamp range of 15 seconds..24 hours.
- Each worker is a full child `pi --mode json -p --session <attempt>/session.jsonl` process with its own session/compaction boundary; the parent supervises stdout JSONL, artifacts, visible final assistant text, and optional compatibility reports.
- Workers handle recoverable work-level errors themselves and finish with a short visible plain-text final summary. Optional `job_report` / `job-report.json` artifacts are kept for compatibility and audit only.
- Parent retry is reserved for launch/session/provider transient failures and no-signal worker incompletion.
- `success` requires runtime success, a visible final assistant message, acceptance pass when an acceptance contract exists, and finalized audit artifacts.
- Legacy `JOB_STATUS` markers and structured reports are not completion substitutes.

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

Use `/jobs-settings` to inspect the focused policy controls. Persistent project settings live in `.pi/jobs-settings.json` at the repository/workspace root where `job`, `jobs`, or `jobs_plan` is called.

The most important setting is `workerExtensions.include`. Worker processes start with `--no-extensions`, then load the internal `job-worker-runtime.ts`, then load only the entries in this allowlist. This keeps job workers isolated from normal/discovered extensions and prevents accidental tool inheritance. Nested jobs remain blocked by the `PI_CHILD_TYPE=job-worker` guard even if the jobs extension is listed.

Minimal config:

```json
{
  "workerExtensions": {
    "include": []
  }
}
```

Example config for workers that need provider extensions plus local basic tools:

```json
{
  "waveGuidance": { "enabled": true, "min": 4, "max": 6 },
  "syncFirstGuidance": true,
  "workerExtensions": {
    "include": [
      "https://github.com/lulucatdev/pi-fireworks-provider",
      "https://github.com/lulucatdev/pi-kimi-coding-plan-provider",
      "https://github.com/lulucatdev/pi-google-ai-studio-provider.git",
      "https://github.com/lulucatdev/pi-glm-coding-plan-provider@v0.1.0",
      "https://github.com/lulucatdev/pi-opencode-go-provider",
      "https://github.com/lulucatdev/pi-baseten-provider.git",
      "../../Developer/pi-basic-tools"
    ]
  }
}
```

`workerExtensions.include` accepts the same source shapes as `pi --extension` / package resolution:

- relative paths starting with `.` resolve from the job call `cwd`; for this repo, `../../Developer/pi-basic-tools` resolves to `/Users/lucas/Developer/pi-basic-tools` when jobs are launched from `/Users/lucas/Developer/pi-jobs`;
- local extension files such as `./extensions/provider-oauth.ts` load that one file;
- local package directories such as `../../Developer/pi-basic-tools` load the package's `pi.extensions` manifest entries;
- npm sources such as `npm:@example/pi-worker-provider` and git URLs such as `https://github.com/org/pi-provider.git` are resolved by pi's package manager.

Setting meanings:

- report policy: fixed default; require a visible plain-text final assistant summary. Structured reports, deliverables, and evidence arrays are optional compatibility/audit artifacts, not default completion gates;
- jobs_plan wave guidance: default enabled, about 4-6 jobs per explicit wave for large batches;
- sync-first guidance: default enabled, keeps the extension oriented around blocking parent-tool runs and avoids scheduler/background/steer/resume complexity;
- worker extensions: worker-only allowlist. The default empty list loads no regular/discovered extensions into job agents, so provider, OAuth, custom-model, search, fetch, repo-map, or read-block support required by worker models must be listed here explicitly.

`timeoutMs` is not a `.pi/jobs-settings.json` setting. It is supplied per `job`, per inline `jobs[]` item, or as top-level / row-level `jobs_plan.timeoutMs`. Omitted or invalid values default to 10 minutes, clamp to 15 seconds..24 hours, and only terminate the child worker attempt on timeout.

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

Use `/jobs-clean` to delete all supervised job artifacts under `<cwd>/.pi/jobs/` in one shot. It removes every batch directory unconditionally and reports how many batches and bytes were freed. `<cwd>/.pi/jobs-settings.json` is preserved because it holds persistent config, not run artifacts. There is no dry-run, no confirmation, and no filter by status or age — if you need any of those, inspect with `/jobs-ui` first or delete specific paths by hand.

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

Prompt and template text is intentionally kept outside TypeScript under `extensions/jobs/prompts/`. Those files are dynamically loaded from disk with `import.meta.url`-relative paths, so local edits can be tested by restarting/reloading pi without rebuilding a bundled prompt string.

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
