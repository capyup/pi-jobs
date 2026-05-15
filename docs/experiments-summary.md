# Experiments Summary

Distilled findings from the `pi-jobs` experiment suite (run 2026-05-12).

## Scene 01: Concurrent Worker Resource Usage

**What was tested:** Launched 8 parallel jobs via `jobs_plan` under full concurrency to measure child process count, port usage, and elapsed time.

**Key findings:**
- **Peak pi processes:** 18 (more than 8 jobs because some workers spawn additional helper processes or retry attempts)
- **Peak listening ports:** 69
- **Total tokens:** ~204K across 8 jobs
- **Success rate:** 100% (8/8)
- **Elapsed time:** ~36 seconds

**Implications:** Full concurrency is viable for small-to-medium batches on capable hardware, but process/port overhead scales super-linearly. The default wave guidance (4–6 jobs per wave) is conservative and appropriate for typical workloads.

## Scene 02: Wave vs Full Concurrency

**What was tested:** Ran 12 identical lightweight jobs under two modes:
- **Full concurrency:** all 12 jobs at once
- **Wave concurrency:** batches of 4 at a time

**Key findings:**
- **Full concurrency elapsed:** 710ms
- **Wave concurrency elapsed:** 1,214ms
- **Speedup of full vs wave:** ~1.7x faster
- **Success rate:** 100% in both modes
- **Peak pi processes:** 10 in both (the wave run still had some overlap)

**Implications:** For lightweight jobs (short prompts, fast completion), full concurrency is meaningfully faster with no reliability penalty. For heavy/long jobs or limited provider quotas, waves remain the safer default. The guidance should be context-aware: light jobs → full concurrency OK; heavy jobs → explicit waves.

## Scene 03: Settings Toggle Impact on Worker Prompt

**What was tested:** Captured `worker-prompt.md` under three `/jobs-settings` configurations:
- Default (wave guidance + sync-first enabled)
- Wave guidance disabled
- Sync-first guidance disabled

**Key findings:**
- **Baseline prompt size:** 44 lines, 2,134 chars
- **Wave-disabled diff:** +5 / −5 lines (removes wave guidance paragraph)
- **Sync-first-disabled diff:** +5 / −5 lines (removes sync-first paragraph)

**Implications:** Settings toggles produce minimal, predictable prompt deltas (~0.5% size change). The prompt system is stable and the toggles work as intended without bloating the worker context.

## Overall Recommendations

1. **Keep wave guidance as default** — the 1.7x speedup of full concurrency for light jobs is not worth the risk for untrusted/unknown workloads.
2. **Add a "lightweight job" hint** — if the model can infer a job is trivial (e.g., grep/read/summary), allow it to bypass wave guidance.
3. **Monitor process/port overhead** — for batches >10, add a runtime warning when peak processes exceed a threshold (e.g., 20).
4. **Settings system is mature** — no further prompt-size optimization needed; focus on semantic quality instead.
