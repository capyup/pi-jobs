# Concurrent Worker Resource Usage

**Scene:** `scene-01-concurrent-resource`
**Generated:** 2026-05-12T12:53:59.850Z

## Description

Launched 1 parallel jobs via jobs_plan to measure child process count, port usage, and elapsed time under full concurrency.

## Metrics

| Metric | Value |
|--------|-------|
| jobCount | 1 |
| concurrency | 1 |
| elapsedMs | 1351 |
| successRate | 0 |
| maxPiProcesses | 11 |
| maxPorts | 68 |
| totalTokens | 0 |
| totalCost | 0 |

## Details

- Batch status: error
- Success: 0, Error: 1, Aborted: 0
- Timeline samples: 2
- Peak pi processes: 11
- Peak listening ports: 68
- Per-attempt token usage (first 3): N/A

## Raw Data

```json
{
  "startedAt": "2026-05-12T12:53:58.498Z",
  "finishedAt": "2026-05-12T12:53:59.849Z",
  "timelineSummary": [
    "1778590438998: pi=11, ports=68",
    "1778590439640: pi=10, ports=68"
  ]
}
```
