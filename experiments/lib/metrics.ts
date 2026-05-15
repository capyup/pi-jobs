import { execSync } from "node:child_process";
import * as fs from "node:fs/promises";

export interface SystemSample {
  timestamp: number;
  piProcessCount: number;
  listeningPortCount: number;
  totalChildProcessCount: number;
}

export interface UsageSnapshot {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  totalTokens: number;
  cost: number;
}

export function sampleSystemState(): SystemSample {
  const timestamp = Date.now();
  let piProcessCount = 0;
  let listeningPortCount = 0;
  let totalChildProcessCount = 0;

  try {
    // Count processes whose command line contains 'pi' ( heuristic )
    const psOutput = execSync("ps aux | grep -E 'pi ' | grep -v grep || true", { encoding: "utf-8", timeout: 2000 });
    piProcessCount = psOutput.trim().split("\n").filter((l) => l.trim()).length;
  } catch {
    piProcessCount = 0;
  }

  try {
    // Count listening ports (heuristic, counts all LISTEN sockets)
    const lsofOutput = execSync("lsof -i -P -n | grep LISTEN | wc -l || echo 0", { encoding: "utf-8", timeout: 2000 });
    listeningPortCount = Number.parseInt(lsofOutput.trim(), 10) || 0;
  } catch {
    listeningPortCount = 0;
  }

  try {
    // Total child processes spawned by current user (approximate)
    const childOutput = execSync("ps -o pid= --ppid $(echo $$) 2>/dev/null | wc -l || echo 0", { encoding: "utf-8", timeout: 2000 });
    totalChildProcessCount = Number.parseInt(childOutput.trim(), 10) || 0;
  } catch {
    totalChildProcessCount = 0;
  }

  return { timestamp, piProcessCount, listeningPortCount, totalChildProcessCount };
}

export async function readSessionUsage(sessionPath: string): Promise<UsageSnapshot | undefined> {
  try {
    const lines = (await fs.readFile(sessionPath, "utf-8")).trim().split("\n");
    let total: UsageSnapshot = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: 0 };
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const event = JSON.parse(line);
        const usage = event?.message?.usage;
        if (usage && typeof usage === "object") {
          total.input += usage.input ?? 0;
          total.output += usage.output ?? 0;
          total.cacheRead += usage.cacheRead ?? 0;
          total.cacheWrite += usage.cacheWrite ?? 0;
          total.totalTokens += usage.totalTokens ?? 0;
          total.cost += usage.cost?.total ?? 0;
        }
      } catch {
        // ignore malformed lines
      }
    }
    return total.totalTokens > 0 ? total : undefined;
  } catch {
    return undefined;
  }
}

export interface TimelineCollector {
  start(): void;
  stop(): SystemSample[];
}

export function createTimelineCollector(intervalMs = 500): TimelineCollector {
  const samples: SystemSample[] = [];
  let timer: NodeJS.Timeout | undefined;
  return {
    start() {
      samples.length = 0;
      timer = setInterval(() => samples.push(sampleSystemState()), intervalMs);
    },
    stop() {
      if (timer) clearInterval(timer);
      timer = undefined;
      return samples.slice();
    },
  };
}
