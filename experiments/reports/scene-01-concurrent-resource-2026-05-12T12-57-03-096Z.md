# Concurrent Worker Resource Usage

**Scene:** `scene-01-concurrent-resource`
**Generated:** 2026-05-12T12:57:03.096Z

## Description

Launched 1 parallel jobs via jobs_plan to measure child process count, port usage, and elapsed time under full concurrency.

## Metrics

| Metric | Value |
|--------|-------|
| jobCount | 1 |
| concurrency | 1 |
| elapsedMs | 7811 |
| successRate | 1 |
| maxPiProcesses | 11 |
| maxPorts | 67 |
| totalTokens | 13066 |
| totalCost | 0 |

## Details

- Batch status: success
- Success: 1, Error: 0, Aborted: 0
- Timeline samples: 15
- Peak pi processes: 11
- Peak listening ports: 67
- Per-attempt token usage (first 3): 13066

## Raw Data

```json
{
  "startedAt": "2026-05-12T12:56:55.285Z",
  "finishedAt": "2026-05-12T12:57:03.096Z",
  "timelineSummary": [
    "1778590615786: pi=11, ports=67",
    "1778590616287: pi=11, ports=67",
    "1778590616788: pi=11, ports=67",
    "1778590617289: pi=11, ports=67",
    "1778590617790: pi=11, ports=67",
    "1778590618291: pi=11, ports=67",
    "1778590618793: pi=11, ports=67",
    "1778590619293: pi=11, ports=67",
    "1778590619793: pi=11, ports=67",
    "1778590620293: pi=11, ports=67",
    "1778590620794: pi=11, ports=67",
    "1778590621294: pi=11, ports=67",
    "1778590621796: pi=11, ports=67",
    "1778590622296: pi=11, ports=67",
    "1778590622878: pi=10, ports=67"
  ]
}
```
