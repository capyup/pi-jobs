# Settings Toggle Impact on Worker Prompt

**Scene:** `scene-03-settings-prompt`
**Generated:** 2026-05-12T12:25:02.195Z

## Description

Captured worker-prompt.md under different /jobs-settings configurations to observe how toggles affect prompt content.

## Metrics

| Metric | Value |
|--------|-------|
| snapshots | 3 |
| baselineLines | 44 |
| baselineChars | 2134 |

## Details

- default: 44 lines, 2134 chars
- wave-disabled: 44 lines, 2140 chars
-   diff: +5 lines, -5 lines
- sync-first-disabled: 44 lines, 2146 chars
-   diff: +5 lines, -5 lines

## Raw Data

```json
{
  "diffs": {
    "wave-disabled": "+5 lines, -5 lines",
    "sync-first-disabled": "+5 lines, -5 lines"
  },
  "prompts": [
    {
      "label": "default",
      "path": "/var/folders/8l/_44t6q0s34n49pkxn6m4txhc0000gn/T/pi-experiments/scene-03-settings-prompt/.pi/jobs/2026-05-12T12-25-01-182Z-ff9fee/attempts/test01/attempt-1/worker-prompt.md",
      "preview": "Job id: test01\nAttempt id: test01-a1\nJob name: scene-03-settings-prompt-default test01\nWorker log path: /var/folders/8l/_44t6q0s34n49pkxn6m4txhc0000gn/T/pi-experiments/scene-03-settings-prompt/.pi/jobs/2026-05-12T12-25-01-182Z-ff9fee/attempts/test01/attempt-1/worker.md\nJob report path: /var/folders/8l/_44t6q0s34n49pkxn6m4txhc0000gn/T/pi-experiments/scene-03-settings-prompt/.pi/jobs/2026-05-12T12-25-01-182Z-ff9fee/attempts/test01/attempt-1/job-report.json\n\n## Job prompt\n\nCreate a file at /var/folders/8l/_44t6q0s34n49pkxn6m4txhc0000gn/T/pi-experiments/scene-03-settings-prompt/test.txt with content \"settings test\". Then call job_report with status completed.\n\n## Completion notes\n\nComplete the assigned work first. A structured report is useful audit evidence. If this job has no explicit accept"
    },
    {
      "label": "wave-disabled",
      "path": "/var/folders/8l/_44t6q0s34n49pkxn6m4txhc0000gn/T/pi-experiments/scene-03-settings-prompt/.pi/jobs/2026-05-12T12-25-01-463Z-202366/attempts/test01/attempt-1/worker-prompt.md",
      "preview": "Job id: test01\nAttempt id: test01-a1\nJob name: scene-03-settings-prompt-wave-disabled test01\nWorker log path: /var/folders/8l/_44t6q0s34n49pkxn6m4txhc0000gn/T/pi-experiments/scene-03-settings-prompt/.pi/jobs/2026-05-12T12-25-01-463Z-202366/attempts/test01/attempt-1/worker.md\nJob report path: /var/folders/8l/_44t6q0s34n49pkxn6m4txhc0000gn/T/pi-experiments/scene-03-settings-prompt/.pi/jobs/2026-05-12T12-25-01-463Z-202366/attempts/test01/attempt-1/job-report.json\n\n## Job prompt\n\nCreate a file at /var/folders/8l/_44t6q0s34n49pkxn6m4txhc0000gn/T/pi-experiments/scene-03-settings-prompt/test.txt with content \"settings test\". Then call job_report with status completed.\n\n## Completion notes\n\nComplete the assigned work first. A structured report is useful audit evidence. If this job has no explicit "
    },
    {
      "label": "sync-first-disabled",
      "path": "/var/folders/8l/_44t6q0s34n49pkxn6m4txhc0000gn/T/pi-experiments/scene-03-settings-prompt/.pi/jobs/2026-05-12T12-25-01-813Z-7ea1cf/attempts/test01/attempt-1/worker-prompt.md",
      "preview": "Job id: test01\nAttempt id: test01-a1\nJob name: scene-03-settings-prompt-sync-first-disabled test01\nWorker log path: /var/folders/8l/_44t6q0s34n49pkxn6m4txhc0000gn/T/pi-experiments/scene-03-settings-prompt/.pi/jobs/2026-05-12T12-25-01-813Z-7ea1cf/attempts/test01/attempt-1/worker.md\nJob report path: /var/folders/8l/_44t6q0s34n49pkxn6m4txhc0000gn/T/pi-experiments/scene-03-settings-prompt/.pi/jobs/2026-05-12T12-25-01-813Z-7ea1cf/attempts/test01/attempt-1/job-report.json\n\n## Job prompt\n\nCreate a file at /var/folders/8l/_44t6q0s34n49pkxn6m4txhc0000gn/T/pi-experiments/scene-03-settings-prompt/test.txt with content \"settings test\". Then call job_report with status completed.\n\n## Completion notes\n\nComplete the assigned work first. A structured report is useful audit evidence. If this job has no exp"
    }
  ]
}
```
