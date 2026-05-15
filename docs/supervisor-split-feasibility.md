# Supervisor Split Feasibility Analysis

**Date:** 2026-05-15
**Target:** `extensions/jobs/supervisor.ts` (789 lines)
**Goal:** Assess whether splitting into `scheduler.ts` + `batch-finalizer.ts` is practical and beneficial.

---

## 1. Current Responsibilities in supervisor.ts

Reading top-to-bottom, the file contains roughly four layers:

| Layer | Lines | Functions | Responsibility |
|-------|-------|-----------|--------------|
| **A. UI Snapshot / Rendering** | ~1–220 | `buildLiveResultText`, `renderSnapshotLines`, `renderActivitySummaryLines`, `statusIcon`, `iconForActivity`, `renderColoredFromText`, etc. | Convert `BatchArtifact + JobArtifact[]` into human-readable terminal text and colored live snapshots |
| **B. Orchestration & Dispatch** | ~221–550 | `executeSupervisedJobs`, `mapWithDynamicConcurrency`, `settleJob`, `abortQueuedJob`, `startSupervisorHeartbeat`, `emitSupervisorUpdate` | Normalize jobs, create batch, dispatch attempts, handle retries, run heartbeat, collect results |
| **C. Finalization & Acceptance** | ~551–700 | `finalizeBatch`, `evaluateAcceptanceForJob`, `deriveFinalOutcome`, `buildAttemptRecord`, `writeSummaryMarkdown` | Compute batch status, run acceptance checks, classify failures, write summary.md |
| **D. Write-Audit Helpers** | ~701–789 | `gitStatusSnapshot`, `diffStatusSnapshots`, `filterFilesByAllowedZone`, `isSupervisorArtifactPath` | Git diff snapshots, file filtering, write-boundary zone checks |

**Observation:** Layer A is already mostly pure (no side effects) and could be extracted today with minimal risk. Layer D is already isolated helper territory. The hard question is B vs C.

---

## 2. Proposed Split

### `scheduler.ts` — "What runs and when"

**What moves here:**
- `executeSupervisedJobs` (the public entrypoint)
- `mapWithDynamicConcurrency` (concurrency engine)
- `settleJob` (single attempt lifecycle: launch → wait → record)
- `abortQueuedJob`
- `startSupervisorHeartbeat` / `emitSupervisorUpdate`
- `recordJobActivity`
- `runAttempt` invocation and retry loop logic

**What it owns:**
- Batch creation via `audit-log.ts`
- Job dispatch loop with retry backoff
- Throttle integration
- Live UI heartbeat

**What it delegates:**
- Final outcome computation → `batch-finalizer.ts`
- Acceptance evaluation → `batch-finalizer.ts`
- Summary generation → `batch-finalizer.ts`
- UI text rendering → stays in `supervisor.ts` (or a new `snapshot.ts`)

### `batch-finalizer.ts` — "What happened and was it good enough"

**What moves here:**
- `finalizeBatch`
- `evaluateAcceptanceForJob`
- `deriveFinalOutcome` (already lives in `decision.ts`, but finalizer calls it)
- `buildAttemptRecord` (already in `worker-runner.ts`, but finalizer consumes it)
- Summary artifact writing

**What it owns:**
- Post-run classification: success / error / incomplete
- Acceptance contract evaluation
- Failure classification (provider_transient, worker_incomplete, etc.)
- `summary.md` generation

---

## 3. Cross-Module Dependencies

### Data structures that must be shared

| Structure | Current location | Would move to |
|-----------|-----------------|---------------|
| `SupervisorContext` | `supervisor.ts` | `scheduler.ts` |
| `SupervisorDependencies` | `supervisor.ts` | `scheduler.ts` (entrypoint), `batch-finalizer.ts` (finalization subset) |
| `SupervisedJobsResult` | `supervisor.ts` | Both modules (scheduler produces it, finalizer enriches it) |
| `AuditBatchHandle` | `audit-log.ts` | Already shared |
| `JobArtifact` / `BatchArtifact` | `types.ts` | Already shared |

### Function call graph after split

```
index.ts ──► scheduler.executeSupervisedJobs()
                │
                ├──► worker-runner.runWorkerAttempt()
                │       (unchanged)
                │
                ├──► audit-log.createBatch / writeJobArtifact
                │       (unchanged)
                │
                └──► batch-finalizer.finalizeBatch()
                        │
                        ├──► acceptance.evaluateAcceptance()
                        ├──► decision.deriveFinalOutcome()
                        └──► summary.writeSummaryMarkdown()
```

### Risk: The `settleJob` → `finalizeBatch` boundary

The tricky part is that `settleJob` currently mutates the `JobArtifact` inline:

```ts
jobArtifact.status = "running";
jobArtifact.timeline.push({ ... });
// ... after attempt returns ...
jobArtifact.finalStatus = runtime.status;
```

If we split `scheduler` and `finalizer`, the scheduler would need to pass a **mutable artifact reference** to the finalizer, or the finalizer would need to re-read the artifact from disk. The latter is cleaner (artifact is source of truth) but adds file I/O overhead.

**Mitigation:** Keep artifact mutation in scheduler, pass the fully settled artifact to finalizer for read-only classification and summary generation. Finalizer returns classification results; scheduler writes them back.

---

## 4. Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| Splitting mid-flight breaks existing open batches | 🔴 High | Only split in a major version or when no active batches exist; maintain backward-compatible artifact layout |
| `settleJob` and `finalizeBatch` need tight coupling for retry state | 🟡 Medium | Define a `JobSettlement` intermediate type that carries both artifact and runtime result; both modules depend on it |
| Extracting UI rendering first is safer and gives immediate value | 🟢 Low | Do Layer A extraction first (snapshot.ts) before touching B/C |
| Test coverage relies on `supervisor.ts` integration tests | 🟡 Medium | After split, keep `integration-supervisor.test.mjs` as a cross-module smoke test; add focused unit tests for scheduler and finalizer |
| Circular imports between scheduler ↔ finalizer | 🟢 Low | Use interface types from `types.ts`; avoid importing concrete modules bidirectionally |

---

## 5. Recommendation

**Short term (now):**
- ✅ **Extract Layer A (UI snapshot rendering)** into `snapshot.ts`. This is ~200 lines of pure, stateless functions with zero side effects. Immediate win: `supervisor.ts` drops to ~590 lines.

**Medium term (next 2–4 weeks):**
- ⏳ **Evaluate `scheduler.ts` extraction** after running 3–5 more real-world batches through the current code. If retry/throttle logic stabilizes (no more hotfixes to `settleJob`), the boundary will be clearer.

**Long term (only if needed):**
- ⏳ **Extract `batch-finalizer.ts`** only if we add new finalization features (e.g., custom acceptance plugins, post-batch hooks, external notification). Currently the finalization logic is stable and well-covered by `decision.ts` + `acceptance.ts` + `summary.ts`.

**Verdict:** Split the UI layer now. Keep orchestration + finalization together until the retry/throttle surface stops changing.
