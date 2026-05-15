/**
 * Scene 01: Concurrent worker resource usage
 * Launch N parallel jobs via jobs_plan and sample system state during execution.
 */
import * as path from "node:path";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import { expandJobsPlan, type JobsPlanInput } from "../extensions/jobs/jobs-plan.ts";
import { runExperiment, type ExperimentResult } from "./lib/runner.ts";
import { writeMarkdownReport, type SceneReport } from "./lib/report.ts";

const SCENE_NAME = "scene-01-concurrent-resource";
const DEFAULT_JOB_COUNT = 8;
const TMP_DIR = path.join(os.tmpdir(), "pi-experiments", SCENE_NAME);

function parseCountArg(): number {
  const idx = process.argv.indexOf("--count");
  if (idx !== -1 && process.argv[idx + 1]) {
    const n = Number.parseInt(process.argv[idx + 1], 10);
    if (Number.isInteger(n) && n >= 1 && n <= 20) return n;
  }
  return DEFAULT_JOB_COUNT;
}

function parseModelArg(): string | undefined {
  const idx = process.argv.indexOf("--model");
  return idx !== -1 && process.argv[idx + 1] ? process.argv[idx + 1] : undefined;
}

function parseThinkingArg(): string | undefined {
  const idx = process.argv.indexOf("--thinking");
  return idx !== -1 && process.argv[idx + 1] ? process.argv[idx + 1] : undefined;
}

async function main() {
  await fs.mkdir(TMP_DIR, { recursive: true });
  const experimentCwd = TMP_DIR;

  const jobCount = parseCountArg();
  const matrix = Array.from({ length: jobCount }, (_, i) => ({
    id: `j${String(i + 1).padStart(2, "0")}`,
    vars: { index: String(i + 1) },
  }));

  const plan: JobsPlanInput = {
    batchName: SCENE_NAME,
    matrix,
    promptTemplate: `Create a text file at ${TMP_DIR}/test-{{index}}.txt with the single line "hello from job {{index}}". Then call the job_report tool with status completed and a brief summary.`,
    // nameTemplate defaults to `${batchName} ${id}` when omitted
    acceptanceTemplate: {
      requiredPaths: [`${TMP_DIR}/test-{{index}}.txt`],
    },
  };

  const dryRun = process.argv.includes("--dry-run");
  const model = parseModelArg();
  const thinking = parseThinkingArg();
  const extraExtensions = model?.startsWith("accounts/fireworks") || model?.startsWith("fireworks/")
    ? [path.join(os.homedir(), ".pi/agent/git/github.com/lulucatdev/pi-fireworks-provider/extensions/fireworks")]
    : undefined;
  console.log(`[${SCENE_NAME}] Starting ${jobCount} concurrent jobs (dryRun=${dryRun}, model=${model ?? "default"}, thinking=${thinking ?? "default"})...`);

  const expanded = expandJobsPlan(plan);
  const result = await runExperiment(expanded.params, {
    experimentName: SCENE_NAME,
    cwd: experimentCwd,
    toolName: "jobs",
    dryRun,
    model,
    thinking,
    extraExtensions,
  });

  const report = buildSceneReport(result, jobCount);
  await writeMarkdownReport(report, path.join("experiments", "reports"));
  console.log(`[${SCENE_NAME}] Report written.`);
}

function buildSceneReport(result: ExperimentResult, jobCount: number): SceneReport {
  const elapsedMs = result.finishedAt - result.startedAt;
  const maxPiProcesses = Math.max(...result.timeline.map((s) => s.piProcessCount), 0);
  const maxPorts = Math.max(...result.timeline.map((s) => s.listeningPortCount), 0);
  const totalTokens = result.attemptMetrics.reduce((sum, m) => sum + (m.sessionUsage?.totalTokens ?? 0), 0);

  return {
    sceneName: SCENE_NAME,
    title: "Concurrent Worker Resource Usage",
    description: `Launched ${jobCount} parallel jobs via jobs_plan to measure child process count, port usage, and elapsed time under full concurrency.`,
    metrics: {
      jobCount,
      concurrency: jobCount,
      elapsedMs,
      successRate: result.batch.summary.success / result.batch.summary.total,
      maxPiProcesses,
      maxPorts,
      totalTokens,
      totalCost: result.attemptMetrics.reduce((sum, m) => sum + (m.sessionUsage?.cost ?? 0), 0),
    },
    details: [
      `Batch status: ${result.batch.status}`,
      `Success: ${result.batch.summary.success}, Error: ${result.batch.summary.error}, Aborted: ${result.batch.summary.aborted}`,
      `Timeline samples: ${result.timeline.length}`,
      `Peak pi processes: ${maxPiProcesses}`,
      `Peak listening ports: ${maxPorts}`,
      ...(result.attemptMetrics.length > 0
        ? [`Per-attempt token usage (first 3): ${result.attemptMetrics.slice(0, 3).map((m) => m.sessionUsage?.totalTokens ?? "N/A").join(", ")}`]
        : []),
    ],
    raw: {
      startedAt: new Date(result.startedAt).toISOString(),
      finishedAt: new Date(result.finishedAt).toISOString(),
      timelineSummary: result.timeline.map((s) => `${s.timestamp}: pi=${s.piProcessCount}, ports=${s.listeningPortCount}`),
    },
  };
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
