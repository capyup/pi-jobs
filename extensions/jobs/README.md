# Jobs Extension

Root-only supervised job workers for pi.

## Tools

- Use job workers narrowly: not for ordinary main-quest work the root agent can handle well, not when parallelism is unnecessary, not when workers could touch the same files or need tight shared state, and not when the root agent should directly learn/debug the process details. Use them when the user explicitly requests parallel jobs/agents, when the work would consume lots of context and only final deliverables matter, or for separable research/reporting/audit/review directions.
- `jobs_plan` launches a fan-out batch of supervised job workers from a compact `matrix + promptTemplate + acceptanceTemplate` payload. The extension expands rows locally into per-row prompts/acceptance/metadata, then runs them under the same audited supervisor as `jobs`. Prefer this for fan-out and repeated/templated independent work (every chapter, every report, every file).
- `jobs` launches a small inline batch of supervised job workers (escape hatch for <=4 ad-hoc jobs). It rejects payloads larger than `MAX_INLINE_JOBS=4` jobs or `MAX_INLINE_PROMPT_BYTES=8000` prompt bytes and tells the caller to use `jobs_plan` instead. It also rejects one-job meta-fanout payloads where the prompt asks for multiple workers.
- `job` launches one isolated supervised job worker.
- `/jobs-start` inserts job-oriented guidance into the editor without triggering an LLM turn.
- `/jobs-ui` reads batch artifacts, shows failure triage, opens job/attempt details, and prepares rerun payloads.
- `/jobs-clean` deletes every supervised batch directory under `<cwd>/.pi/jobs/` in one shot and reports how many batches and bytes were freed. It preserves `<cwd>/.pi/jobs-settings.json`. No dry-run, no confirmation, no filters.

## Prompt files

User-facing guidance, tool descriptions/snippets/guidelines, and worker prompt templates live in `extensions/jobs/prompts/` and are dynamically loaded from disk through `prompt-loader.ts` with `import.meta.url`-relative paths. Edit these files when tuning prompts; worker prompts and `/jobs-start` guidance are read per call, while tool metadata is read when the extension registers tools.

- `jobs-start.md` - `/jobs-start` guidance with report policy and wave guidance placeholders.
- `tools/*.json` - `job`, `jobs`, and `jobs_plan` descriptions, snippets, and prompt guidelines.
- `worker-system.md`, `worker-prompt.md`, and `worker-report-example.json` - child worker system prompt, per-job worker prompt template, and optional compatibility report JSON example.

## Why `jobs_plan` exists

Inline `jobs({ jobs: [...] })` requires the model to stream the entire batch as one tool-call argument. With many long per-job prompts, that argument can be tens of KB and the model/provider can be `terminated` mid-stream. When that happens, `execute()` is never called: there is no `JOBS starting`, no `.pi/jobs/<batchId>`, no heartbeat, and no logs. `jobs_plan` keeps the streamed argument tiny (one shared template + N short rows) so the supervisor reaches `execute()` quickly and produces visible artifacts.

## Input model

```ts
type JobSpecInput = {
  id?: string;
  name: string;
  prompt: string;
  cwd?: string;
  timeoutMs?: number;                    // default 600000, clamped to 15000..86400000
  acceptance?: AcceptanceContract;
  metadata?: Record<string, string>;
};

type JobsToolParams = {
  jobs: JobSpecInput[];                  // <= 4 inline jobs
  concurrency?: number;
  retry?: ParentRetryPolicy;
  throttle?: ThrottlePolicy;
  acceptanceDefaults?: AcceptanceContract;
  parentBatchId?: string;
  rerunOfJobIds?: string[];
};

type JobsPlanRow = {
  id: string;                            // unique within batch, [A-Za-z0-9._-]
  name?: string;                         // overrides nameTemplate
  cwd?: string;                          // overrides cwdTemplate
  timeoutMs?: number;                    // overrides top-level timeoutMs
  vars?: Record<string, string | string[]>;
};

type JobsPlanInput = {
  batchName: string;
  concurrency?: number;
  matrix: JobsPlanRow[];
  promptTemplate: string;                // {{key}} substitutions per row
  nameTemplate?: string;                 // default: '{{batchName}} {{id}}'
  cwdTemplate?: string;
  acceptanceTemplate?: AcceptanceContract;
  metadataTemplate?: Record<string, string>;
  timeoutMs?: number;                    // applied to every row unless row.timeoutMs is set
  retry?: ParentRetryPolicy;
  throttle?: ThrottlePolicy;
  acceptanceDefaults?: AcceptanceContract;
  synthesis?: { mode?: "parent" | "report-only"; instructions?: string };
  parentBatchId?: string;
  rerunOfJobIds?: string[];
};
```

## Timeout and concurrency semantics

- Every job has a finite hard timeout. Set `timeoutMs` to about 2x expected work duration; omitted or invalid values default to 10 minutes (600000 ms), with a clamp range of 15 seconds..24 hours.
- In `jobs_plan`, top-level `timeoutMs` applies to every expanded row unless a row provides its own `timeoutMs` override.
- A timeout terminates only the child worker attempt, first with SIGTERM and then SIGKILL after the abort kill delay; the parent/root agent stays alive and records `worker_stalled`.
- There is no hidden default concurrency cap. If `concurrency` is omitted, the supervisor starts all supplied leaf jobs concurrently (`jobs.length` or `matrix.length`).
- Set `concurrency: N` only when you want an explicit local cap for that batch.
- Dynamic throttling is opt-in: set `throttle: { enabled: true, ... }` to let the supervisor reduce/recover concurrency after transient provider/session failures. When `throttle` is omitted, the supervisor does not auto-throttle.
- Agent-driven waves are preferred: split a large job into multiple `jobs_plan` calls when you want phases, dependency boundaries, or manual provider load control. For large batches, default to explicit waves of about 4-6 jobs unless the user asks for full concurrency.

### `jobs_plan` template rules

- `{{key}}` lookups resolve in this order: row.id, row.name, row.cwd, row.vars.
- In a string field, an array value joins with `\n`.
- In an array string field (e.g. `acceptanceTemplate.allowedWritePaths`), an entry that is exactly `{{key}}` and whose row value is an array splats into multiple list entries.
- `requiredPaths` accepts both bare strings and `PathCheck` objects; `path`, `requiredRegex`, and `forbiddenRegex` are all template-substituted.
- Unknown variables raise an error before any worker spawns.
- `jobs_plan` is frozen as compact input transport, not a workflow engine: unknown top-level keys, unknown row keys, conditionals, loops, dependency graphs, and nested workflow steps are rejected.
- `synthesis` is experimental metadata for parent post-batch summary; it is not executable workflow logic.

### `jobs_plan` example

```ts
jobs_plan({
  batchName: "oracle-chapter-fixes",
  concurrency: 6,
  matrix: [
    { id: "ch01", vars: { chapter: "01", report: "oracle/reports/ch01.md", allowedWritePaths: ["chapters/ch01/"] } },
  ],
  promptTemplate: `
You are the chapter {{chapter}} worker.
Read: {{report}}
Edit only files matching:
{{allowedWritePaths}}
Finish with a short visible plain-text summary of what changed, where to verify it, and any blockers.
`,
  acceptanceTemplate: {
    requiredPaths: [{ path: "{{report}}", minBytes: 200 }],
    allowedWritePaths: ["{{allowedWritePaths}}"],
  },
  metadataTemplate: { chapter: "{{chapter}}", report: "{{report}}" },
});
```

## Completion protocol

A worker should finish with a short visible plain-text assistant message in natural language. There is no fixed final-report template; useful details can include what changed, how to verify it, files intentionally left untouched, tests run, and caveats.

The report policy is: success requires runtime success, a visible final assistant message, acceptance pass when an acceptance contract exists, and finalized audit artifacts. The child-only `job_report` tool and fallback `job-report.json` remain optional compatibility/audit artifacts, but they do not replace visible final text. Thinking-only final turns and tool-only endings are `worker_incomplete` and parent-retryable.

## Worker child sessions

Each worker attempt launches a full child Pi process: `pi --mode json -p --session <attemptDir>/session.jsonl --extension job-worker-runtime.ts`. The child owns its own session and Pi auto-compaction boundary; the parent does not mutate child context. The parent supervises stdout JSONL events, write telemetry, process lifecycle, and artifacts, while the small worker runtime extension exposes `job_report`. Nested child-process jobs remain blocked by the jobs extension's existing `PI_CHILD_TYPE` guard. Worker prompts still tell agents to avoid huge dumps and prefer targeted reads/greps plus durable notes to files.

Worker extension loading is configured in `.pi/jobs-settings.json` as a worker-only allowlist. Job agents always load the internal `job-worker-runtime.ts` extension, then only the entries listed in `workerExtensions.include`; the default empty list loads no regular/discovered extensions into job agents. If a worker model needs provider, OAuth, custom-model, fetch/search, repo-map, or read-block support from an extension, add that extension or package to `workerExtensions.include`. Entries may be local files, local package directories, npm sources, or git URLs; relative paths that start with `.` resolve from the job call cwd. For example, from `/Users/lucas/Developer/pi-jobs`, `../../Developer/pi-basic-tools` loads the local `@capyup/pi-basic-tools` package manifest. Nested child-process jobs remain blocked by the jobs extension's existing `PI_CHILD_TYPE=job-worker` guard even when the jobs extension is listed.

## Acceptance contracts

Acceptance can require files, forbid paths, check worker-log/report regexes, validate minimum sizes, and audit changed files against allowed/forbidden write paths. Git diff files and worker telemetry first become normalized `WriteEvidence[]`; `.pi/jobs/**` supervisor artifacts are ignored, exact paths match exactly, trailing slash patterns mean directory prefixes, and `*`/`**` keep glob behavior.

Do not add `JOB_STATUS: completed` (or similar log-marker regexes) as an acceptance requirement: completion requires the worker's visible final assistant message, and log markers only produce false negatives. Do not list `job-report.json` or `worker.md` in `requiredPaths`: the supervisor writes those itself in the batch artifact directory, not under the job's cwd. Prefer explicit filesystem checks such as required output paths, minimum sizes, regexes, and write boundaries.

Example:

```ts
jobs({
  concurrency: 4,
  jobs: [{
    name: "stage9-ch05",
    prompt: "Process chapter 05...",
    acceptance: {
      requiredPaths: [{ path: "Stage9/ch05_delivery.md", minBytes: 200 }],
      forbiddenPaths: ["ch05_delivery.md"],
      forbiddenOutputRegex: ["已开始|待执行|TODO"],
      allowedWritePaths: ["Stage9/**"],
    }
  }]
});
```

## Artifacts

```text
.pi/jobs/<batchId>/
  batch.json
  events.jsonl
  summary.md
  plan.json                  # only present when jobs_plan was used
  jobs/<jobId>.json
  attempts/<jobId>/attempt-N/
    session.jsonl
    system-prompt.md
    worker-prompt.md
    worker.md
    job-report.json
    worker-events.jsonl
    stdout.jsonl
    stderr.txt
    attempt.json
```

`summary.md` is the quickest human entry point after a run. When `jobs_plan` ran the batch, `plan.json` records the matrix, templates, jobNames, and optional experimental synthesis metadata that produced it.

Treat `.pi/jobs/**` as a sensitive local audit directory. It can contain full worker prompts, system prompt fragments, child `session.jsonl` transcripts, stdout/stderr, file paths, and structured reports. Do not publish or attach it wholesale without reviewing/redacting it first.

## Settings UI

Use `/jobs-settings` to inspect or update the focused policy controls. File-only settings live in `.pi/jobs-settings.json`:

```json
{
  "workerExtensions": {
    "include": []
  }
}
```

- report policy: fixed default; require a visible plain-text final assistant summary. Structured reports, deliverables, and evidence arrays are optional compatibility/audit artifacts, not default completion gates;
- jobs_plan wave guidance: default enabled, about 4-6 jobs per explicit wave for large batches;
- sync-first guidance: default enabled, keeps the extension oriented around blocking parent-tool runs and avoids scheduler/background/steer/resume complexity;
- worker extensions: worker-only allowlist; job agents load `job-worker-runtime.ts` plus only `workerExtensions.include` entries. The default empty list loads no regular/discovered extensions into job agents, so provider, OAuth, or custom-model extensions required by worker models must be listed here. Nested jobs remain blocked by the `PI_CHILD_TYPE=job-worker` guard even when the jobs extension is allowlisted.

## Artifact UI

```text
/jobs-ui
/jobs-ui help
/jobs-ui <batchId|batchDir>
/jobs-ui <batchId|batchDir> job <jobId>
/jobs-ui <batchId|batchDir> attempt <jobId> <attemptId|latest>
/jobs-ui rerun failed <batchId|batchDir>
/jobs-ui rerun acceptance-failed <batchId|batchDir>
/jobs-ui rerun provider-transient <batchId|batchDir>
/jobs-ui rerun selected <batchId|batchDir> <jobId> [jobId...]
```

Batch detail shows failed jobs first with reason, retryability, and artifact inspection commands. Job detail shows prompt/cwd, timeline, acceptance/report state, deliverables, evidence, recent thinking/tool activity, and latest attempt paths. Attempt detail shows runtime status, exit/stop reason, stderr tail, malformed stdout count, thinking/tool activity, and every attempt artifact path. Live `job` / `jobs` updates show the latest per-job thinking/activity lines while workers run.

## Retry boundary

Workers should retry recoverable work errors internally and record them in `internalRetries`.

The parent supervisor retries only launch/session/provider/worker-incomplete failures that did not reach the required visible final assistant text: `launch_error`, `provider_transient`, `provider_stalled`, `worker_stalled`, and `worker_incomplete` (for example `429`, `5xx`, `overloaded`, `Internal server error`, `terminated`, timeout, connection reset, thinking-only stop, or a tool-only final turn).

Acceptance failures, malformed reports, invalid contracts, and user aborts are not parent-retryable by default.
