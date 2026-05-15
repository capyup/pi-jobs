import * as path from "node:path";
import * as fs from "node:fs/promises";
import { runWorkerAttempt, type RunWorkerAttemptInput, type AttemptRuntimeResult } from "../../extensions/jobs/worker-runner.ts";
import { executeSupervisedJobs, type SupervisorContext, type SupervisorDependencies, type SupervisedJobsResult } from "../../extensions/jobs/supervisor.ts";
import type { JobsToolParams } from "../../extensions/jobs/types.ts";
import { buildWorkerPrompt, buildWorkerSystemPrompt } from "../../extensions/jobs/worker-protocol.ts";
import { sampleSystemState, createTimelineCollector, readSessionUsage, type SystemSample, type UsageSnapshot } from "./metrics.ts";

export interface ExperimentAttemptMetrics {
  attemptId: string;
  jobId: string;
  startSample: SystemSample;
  endSample: SystemSample;
  sessionUsage?: UsageSnapshot;
}

export interface ExperimentResult extends SupervisedJobsResult {
  experimentName: string;
  startedAt: number;
  finishedAt: number;
  timeline: SystemSample[];
  attemptMetrics: ExperimentAttemptMetrics[];
}

export interface ExperimentRunnerOptions {
  experimentName: string;
  cwd: string;
  toolName: "job" | "jobs";
  model?: string;
  thinking?: string;
  dryRun?: boolean;
  extraExtensions?: string[];
}

export async function runExperiment(
  params: JobsToolParams,
  options: ExperimentRunnerOptions,
): Promise<ExperimentResult> {
  const startedAt = Date.now();
  const timeline = createTimelineCollector(500);
  timeline.start();

  const attemptMetrics: ExperimentAttemptMetrics[] = [];

  const wrappedRunAttempt = async (input: RunWorkerAttemptInput): Promise<AttemptRuntimeResult> => {
    const startSample = sampleSystemState();
    const result = await runWorkerAttempt({ ...input, extraExtensions: options.extraExtensions });
    const endSample = sampleSystemState();
    const sessionUsage = input.paths.sessionPath ? await readSessionUsage(input.paths.sessionPath) : undefined;
    attemptMetrics.push({ attemptId: input.attemptId, jobId: input.job.id, startSample, endSample, sessionUsage });
    return result;
  };

  const ctx: SupervisorContext = {
    cwd: options.cwd,
    toolName: options.toolName,
    model: options.model,
    thinking: options.thinking,
  };

  const deps: SupervisorDependencies = {
    runAttempt: options.dryRun ? createDryRunAttempt() : wrappedRunAttempt,
    liveUpdateIntervalMs: 1000,
    onUpdate: (snapshot) => {
      // console.log(`[${options.experimentName}] ${snapshot.batch.status} ${snapshot.jobs.length} jobs`);
    },
  };

  const result = await executeSupervisedJobs(params, ctx, deps);
  const finishedAt = Date.now();
  const timelineSamples = timeline.stop();

  return {
    ...result,
    experimentName: options.experimentName,
    startedAt,
    finishedAt,
    timeline: timelineSamples,
    attemptMetrics,
  };
}

function createDryRunAttempt() {
  return async (input: RunWorkerAttemptInput): Promise<AttemptRuntimeResult> => {
    const startedAt = new Date().toISOString();

    // Write prompt files so scene-03 can inspect them
    await fs.mkdir(input.paths.attemptDir, { recursive: true });
    const systemPromptPath = path.join(input.paths.attemptDir, "system-prompt.md");
    const workerPromptPath = path.join(input.paths.attemptDir, "worker-prompt.md");
    await fs.writeFile(systemPromptPath, buildWorkerSystemPrompt(), "utf-8");
    await fs.writeFile(workerPromptPath, buildWorkerPrompt({
      job: input.job,
      attemptId: input.attemptId,
      workerLogPath: input.paths.workerLogPath,
      reportPath: input.paths.reportPath,
    }), "utf-8");
    await fs.writeFile(input.paths.workerLogPath, "", "utf-8");
    await fs.writeFile(input.paths.stderrPath, "", "utf-8");

    // Create required files so acceptance passes in dry-run mode
    if (input.job.acceptance?.requiredPaths) {
      for (const p of input.job.acceptance.requiredPaths) {
        try {
          await fs.mkdir(path.dirname(p), { recursive: true });
          await fs.writeFile(p, "dry-run stub\n", "utf-8");
        } catch {
          // ignore
        }
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 200 + Math.random() * 300));
    const finishedAt = new Date().toISOString();
    return {
      attemptId: input.attemptId,
      jobId: input.job.id,
      status: "success",
      exitCode: 0,
      sawTerminalAssistantMessage: true,
      stderrTail: "",
      stdoutMalformedLines: 0,
      failureKind: "none",
      error: null,
      startedAt,
      finishedAt,
    };
  };
}
