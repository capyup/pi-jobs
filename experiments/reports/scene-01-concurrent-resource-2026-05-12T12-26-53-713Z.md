# Concurrent Worker Resource Usage

**Scene:** `scene-01-concurrent-resource`
**Generated:** 2026-05-12T12:26:53.713Z

## Description

Launched 1 parallel jobs via jobs_plan to measure child process count, port usage, and elapsed time under full concurrency.

## Metrics

| Metric | Value |
|--------|-------|
| jobCount | 1 |
| concurrency | 1 |
| elapsedMs | 25502 |
| successRate | 1 |
| maxPiProcesses | 11 |
| maxPorts | 68 |
| totalTokens | 20291 |
| totalCost | 0 |

## Details

- Batch status: success
- Success: 1, Error: 0, Aborted: 0
- Timeline samples: 50
- Peak pi processes: 11
- Peak listening ports: 68
- Per-attempt token usage (first 3): 20291

## Raw Data

```json
{
  "startedAt": "2026-05-12T12:26:28.211Z",
  "finishedAt": "2026-05-12T12:26:53.713Z",
  "timelineSummary": [
    "1778588788712: pi=11, ports=68",
    "1778588789215: pi=11, ports=68",
    "1778588789717: pi=11, ports=68",
    "1778588790219: pi=11, ports=68",
    "1778588790721: pi=11, ports=68",
    "1778588791223: pi=11, ports=68",
    "1778588791724: pi=11, ports=68",
    "1778588792226: pi=11, ports=68",
    "1778588792728: pi=11, ports=68",
    "1778588793231: pi=11, ports=68",
    "1778588793731: pi=11, ports=68",
    "1778588794232: pi=11, ports=68",
    "1778588794734: pi=11, ports=68",
    "1778588795236: pi=11, ports=68",
    "1778588795738: pi=11, ports=68",
    "1778588796240: pi=11, ports=68",
    "1778588796742: pi=11, ports=68",
    "1778588797243: pi=11, ports=68",
    "1778588797746: pi=11, ports=68",
    "1778588798248: pi=11, ports=68",
    "1778588798749: pi=11, ports=68",
    "1778588799250: pi=11, ports=68",
    "1778588799753: pi=11, ports=68",
    "1778588800255: pi=11, ports=68",
    "1778588800755: pi=11, ports=68",
    "1778588801258: pi=11, ports=68",
    "1778588801760: pi=11, ports=68",
    "1778588802262: pi=11, ports=68",
    "1778588802763: pi=11, ports=68",
    "1778588803265: pi=11, ports=68",
    "1778588803766: pi=11, ports=68",
    "1778588804269: pi=11, ports=68",
    "1778588804771: pi=11, ports=68",
    "1778588805271: pi=11, ports=68",
    "1778588805773: pi=11, ports=68",
    "1778588806273: pi=11, ports=68",
    "1778588806773: pi=11, ports=68",
    "1778588807276: pi=11, ports=68",
    "1778588807777: pi=11, ports=68",
    "1778588808278: pi=11, ports=68",
    "1778588808781: pi=11, ports=68",
    "1778588809283: pi=11, ports=68",
    "1778588809783: pi=11, ports=68",
    "1778588810285: pi=11, ports=68",
    "1778588810787: pi=11, ports=68",
    "1778588811289: pi=11, ports=68",
    "1778588811791: pi=11, ports=68",
    "1778588812293: pi=11, ports=68",
    "1778588812796: pi=11, ports=68",
    "1778588813298: pi=11, ports=68"
  ]
}
```
