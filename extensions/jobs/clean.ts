/**
 * /jobs-clean implementation: delete all supervised job artifacts under
 * <cwd>/.pi/jobs/. Does not touch <cwd>/.pi/jobs-settings.json (that file
 * holds persistent config, not run artifacts).
 */

import * as fs from "node:fs/promises";
import type { Dirent } from "node:fs";
import * as path from "node:path";

export interface CleanResult {
  jobsDir: string;
  existed: boolean;
  batchCount: number;
  bytesFreed: number;
}

async function directorySize(dir: string): Promise<number> {
  let entries: Dirent[];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return 0;
  }
  let total = 0;
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      total += await directorySize(full);
    } else if (entry.isFile() || entry.isSymbolicLink()) {
      try {
        const stat = await fs.lstat(full);
        total += stat.size;
      } catch {
        // Ignore stat failures; the file may have been removed concurrently.
      }
    }
  }
  return total;
}

export async function cleanJobsArtifacts(cwd: string): Promise<CleanResult> {
  const jobsDir = path.join(path.resolve(cwd), ".pi", "jobs");
  let entries: Dirent[];
  try {
    entries = await fs.readdir(jobsDir, { withFileTypes: true });
  } catch {
    return { jobsDir, existed: false, batchCount: 0, bytesFreed: 0 };
  }
  const batchCount = entries.filter((entry) => entry.isDirectory()).length;
  const bytesFreed = await directorySize(jobsDir);
  await fs.rm(jobsDir, { recursive: true, force: true });
  return { jobsDir, existed: true, batchCount, bytesFreed };
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export function formatCleanResult(result: CleanResult): string {
  if (!result.existed) {
    return `jobs-clean: nothing to clean (${result.jobsDir} does not exist)`;
  }
  const noun = result.batchCount === 1 ? "batch" : "batches";
  return `jobs-clean: removed ${result.batchCount} ${noun} from ${result.jobsDir} (freed ${formatBytes(result.bytesFreed)})`;
}
