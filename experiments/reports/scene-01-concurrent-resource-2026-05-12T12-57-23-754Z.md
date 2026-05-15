# Concurrent Worker Resource Usage

**Scene:** `scene-01-concurrent-resource`
**Generated:** 2026-05-12T12:57:23.754Z

## Description

Launched 4 parallel jobs via jobs_plan to measure child process count, port usage, and elapsed time under full concurrency.

## Metrics

| Metric | Value |
|--------|-------|
| jobCount | 4 |
| concurrency | 4 |
| elapsedMs | 9420 |
| successRate | 1 |
| maxPiProcesses | 14 |
| maxPorts | 67 |
| totalTokens | 52469 |
| totalCost | 0 |

## Details

- Batch status: success
- Success: 4, Error: 0, Aborted: 0
- Timeline samples: 17
- Peak pi processes: 14
- Peak listening ports: 67
- Per-attempt token usage (first 3): 13130, 13083, 13066

## Raw Data

```json
{
  "startedAt": "2026-05-12T12:57:14.334Z",
  "finishedAt": "2026-05-12T12:57:23.754Z",
  "timelineSummary": [
    "1778590634984: pi=10, ports=67",
    "1778590635485: pi=14, ports=67",
    "1778590636221: pi=14, ports=67",
    "1778590636720: pi=14, ports=67",
    "1778590637223: pi=14, ports=67",
    "1778590637724: pi=14, ports=67",
    "1778590638225: pi=14, ports=67",
    "1778590638726: pi=14, ports=67",
    "1778590639227: pi=14, ports=67",
    "1778590639729: pi=14, ports=67",
    "1778590640230: pi=14, ports=67",
    "1778590640731: pi=14, ports=67",
    "1778590641232: pi=14, ports=67",
    "1778590641733: pi=14, ports=67",
    "1778590642233: pi=13, ports=67",
    "1778590642884: pi=11, ports=67",
    "1778590643536: pi=10, ports=67"
  ]
}
```
