# Concurrent Worker Resource Usage

**Scene:** `scene-01-concurrent-resource`
**Generated:** 2026-05-12T12:23:29.195Z

## Description

Launched 8 parallel jobs via jobs_plan to measure child process count, port usage, and elapsed time under full concurrency.

## Metrics

| Metric | Value |
|--------|-------|
| jobCount | 8 |
| concurrency | 8 |
| elapsedMs | 724 |
| successRate | 0 |
| maxPiProcesses | 10 |
| maxPorts | 68 |
| totalTokens | 0 |
| totalCost | 0 |

## Details

- Batch status: error
- Success: 0, Error: 8, Aborted: 0
- Timeline samples: 1
- Peak pi processes: 10
- Peak listening ports: 68

## Raw Data

```json
{
  "startedAt": "2026-05-12T12:23:28.471Z",
  "finishedAt": "2026-05-12T12:23:29.195Z",
  "timelineSummary": [
    "1778588608973: pi=10, ports=68"
  ]
}
```
