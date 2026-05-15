# Concurrent Worker Resource Usage

**Scene:** `scene-01-concurrent-resource`
**Generated:** 2026-05-12T12:58:05.235Z

## Description

Launched 8 parallel jobs via jobs_plan to measure child process count, port usage, and elapsed time under full concurrency.

## Metrics

| Metric | Value |
|--------|-------|
| jobCount | 8 |
| concurrency | 8 |
| elapsedMs | 17013 |
| successRate | 1 |
| maxPiProcesses | 18 |
| maxPorts | 67 |
| totalTokens | 104903 |
| totalCost | 0 |

## Details

- Batch status: success
- Success: 8, Error: 0, Aborted: 0
- Timeline samples: 30
- Peak pi processes: 18
- Peak listening ports: 67
- Per-attempt token usage (first 3): 13151, 13142, 13045

## Raw Data

```json
{
  "startedAt": "2026-05-12T12:57:48.221Z",
  "finishedAt": "2026-05-12T12:58:05.234Z",
  "timelineSummary": [
    "1778590669096: pi=10, ports=67",
    "1778590669737: pi=10, ports=67",
    "1778590670367: pi=10, ports=67",
    "1778590670868: pi=18, ports=67",
    "1778590672037: pi=18, ports=67",
    "1778590672582: pi=18, ports=67",
    "1778590673084: pi=18, ports=67",
    "1778590673584: pi=18, ports=67",
    "1778590674086: pi=18, ports=67",
    "1778590674586: pi=18, ports=67",
    "1778590675087: pi=18, ports=67",
    "1778590675587: pi=18, ports=67",
    "1778590676088: pi=18, ports=67",
    "1778590676589: pi=18, ports=67",
    "1778590677089: pi=18, ports=67",
    "1778590677606: pi=17, ports=67",
    "1778590678106: pi=16, ports=67",
    "1778590678606: pi=16, ports=67",
    "1778590679108: pi=15, ports=67",
    "1778590679607: pi=15, ports=67",
    "1778590680161: pi=13, ports=67",
    "1778590680801: pi=11, ports=67",
    "1778590681303: pi=11, ports=67",
    "1778590681803: pi=11, ports=67",
    "1778590682304: pi=11, ports=67",
    "1778590682803: pi=11, ports=67",
    "1778590683305: pi=11, ports=67",
    "1778590683805: pi=11, ports=67",
    "1778590684306: pi=11, ports=67",
    "1778590684806: pi=10, ports=67"
  ]
}
```
