# Concurrent Worker Resource Usage

**Scene:** `scene-01-concurrent-resource`
**Generated:** 2026-05-12T12:31:00.210Z

## Description

Launched 8 parallel jobs via jobs_plan to measure child process count, port usage, and elapsed time under full concurrency.

## Metrics

| Metric | Value |
|--------|-------|
| jobCount | 8 |
| concurrency | 8 |
| elapsedMs | 35717 |
| successRate | 1 |
| maxPiProcesses | 18 |
| maxPorts | 69 |
| totalTokens | 203742 |
| totalCost | 0 |

## Details

- Batch status: success
- Success: 8, Error: 0, Aborted: 0
- Timeline samples: 67
- Peak pi processes: 18
- Peak listening ports: 69
- Per-attempt token usage (first 3): 20192, 27072, 27260

## Raw Data

```json
{
  "startedAt": "2026-05-12T12:30:24.493Z",
  "finishedAt": "2026-05-12T12:31:00.210Z",
  "timelineSummary": [
    "1778589025134: pi=10, ports=69",
    "1778589026018: pi=10, ports=69",
    "1778589026629: pi=10, ports=69",
    "1778589027131: pi=18, ports=69",
    "1778589028338: pi=18, ports=69",
    "1778589029062: pi=18, ports=69",
    "1778589029564: pi=18, ports=69",
    "1778589030064: pi=18, ports=69",
    "1778589030566: pi=18, ports=69",
    "1778589031065: pi=18, ports=69",
    "1778589031566: pi=18, ports=69",
    "1778589032066: pi=18, ports=69",
    "1778589032567: pi=18, ports=69",
    "1778589033068: pi=18, ports=69",
    "1778589033569: pi=18, ports=69",
    "1778589034069: pi=18, ports=69",
    "1778589034571: pi=18, ports=69",
    "1778589035071: pi=18, ports=69",
    "1778589035573: pi=18, ports=69",
    "1778589036073: pi=18, ports=69",
    "1778589036575: pi=18, ports=69",
    "1778589037075: pi=18, ports=69",
    "1778589037576: pi=18, ports=69",
    "1778589038078: pi=18, ports=69",
    "1778589038579: pi=18, ports=69",
    "1778589039079: pi=18, ports=69",
    "1778589039580: pi=18, ports=69",
    "1778589040080: pi=18, ports=69",
    "1778589040582: pi=18, ports=69",
    "1778589041082: pi=18, ports=69",
    "1778589041583: pi=18, ports=69",
    "1778589042084: pi=18, ports=69",
    "1778589042585: pi=18, ports=69",
    "1778589043085: pi=18, ports=69",
    "1778589043585: pi=18, ports=69",
    "1778589044085: pi=18, ports=69",
    "1778589044586: pi=18, ports=69",
    "1778589045087: pi=18, ports=69",
    "1778589045587: pi=18, ports=69",
    "1778589046087: pi=18, ports=69",
    "1778589046588: pi=18, ports=69",
    "1778589047088: pi=18, ports=69",
    "1778589047590: pi=18, ports=69",
    "1778589048090: pi=18, ports=69",
    "1778589048591: pi=18, ports=69",
    "1778589049093: pi=18, ports=69",
    "1778589049593: pi=18, ports=69",
    "1778589050097: pi=17, ports=69",
    "1778589050598: pi=17, ports=69",
    "1778589051097: pi=17, ports=69",
    "1778589051599: pi=17, ports=69",
    "1778589052099: pi=17, ports=69",
    "1778589052600: pi=17, ports=69",
    "1778589053100: pi=17, ports=69",
    "1778589053599: pi=17, ports=69",
    "1778589054100: pi=17, ports=69",
    "1778589054601: pi=16, ports=69",
    "1778589055101: pi=15, ports=69",
    "1778589055603: pi=15, ports=69",
    "1778589056237: pi=12, ports=69",
    "1778589056738: pi=12, ports=69",
    "1778589057238: pi=12, ports=69",
    "1778589057740: pi=12, ports=69",
    "1778589058240: pi=12, ports=69",
    "1778589058740: pi=12, ports=69",
    "1778589059241: pi=11, ports=69",
    "1778589059742: pi=11, ports=69"
  ]
}
```
