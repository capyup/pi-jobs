/**
 * Scene 02: Wave vs Full Concurrency
 * Run the same 12 lightweight jobs with full concurrency (12) and wave (4)
 * to compare elapsed time, success rate, and token cost.
 */
import * as path from "node:path";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import { expandJobsPlan, type JobsPlanInput } from "../extensions/jobs/jobs-plan.ts";
import { runExperiment, type ExperimentResult } from "./lib/runner.ts";
import { writeMarkdownReport, type SceneReport } from "./lib/report.ts";

const SCENE_NAME = "scene-02-wave-vs-full";
const DEFAULT_JOB_COUNT = 12;
const TMP_DIR = path.join(os.tmpdir(), "pi-experiments", SCENE_NAME);

function parseCountArg(): number {
  const idx = process.argv.indexOf("--count");
  if (idx !== -1 && process.argv[idx + 1]) {
    const n = Number.parseInt(process.argv[idx + 1], 10);
    if (Number.isInteger(n) && n >= 2 && n <= 20) return n;
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

function buildPlan(concurrency: number, jobCount: number): JobsPlanInput {
  const matrix = Array.from({ length: jobCount }, (_, i) => ({
    id: `j${String(i + 1).padStart(2, "0")}`,
    vars: { index: String(i + 1) },
  }));

  return {
    batchName: `${SCENE_NAME}-c${concurrency}-n${jobCount}`,
    matrix,
    promptTemplate: `Create a text file at ${TMP_DIR}/test-{{index}}.txt with the single line "hello from job {{index}}". Then call the job_report tool with status completed and a brief summary.`,
    // nameTemplate defaults to `${batchName} ${id}` when omitted
    concurrency,
    acceptanceTemplate: {
      requiredPaths: [`${TMP_DIR}/test-{{index}}.txt`],
    },
  };
}

async function main() {
  await fs.mkdir(TMP_DIR, { recursive: true });
  const experimentCwd = TMP_DIR;
  const dryRun = process.argv.includes("--dry-run");
  const jobCount = parseCountArg();
  const model = parseModelArg();
  const thinking = parseThinkingArg();
  const extraExtensions = model?.startsWith("accounts/fireworks") || model?.startsWith("fireworks/")
    ? [path.join(os.homedir(), ".pi/agent/git/github.com/lulucatdev/pi-fireworks-provider/extensions/fireworks")]
    : undefined;

  const runs: { label: string; concurrency: number; result: ExperimentResult }[] = [];

  for (const concurrency of [jobCount, 4]) {
    const label = concurrency === jobCount ? "full" : "wave-4";
    console.log(`[${SCENE_NAME}] Running ${label} (${concurrency} concurrency, count=${jobCount}, dryRun=${dryRun}, model=${model ?? "default"}, thinking=${thinking ?? "default"})...`);
    const plan = buildPlan(concurrency, jobCount);
    const expanded = expandJobsPlan(plan);
    const result = await runExperiment(expanded.params, {
      experimentName: `${SCENE_NAME}-${label}`,
      cwd: experimentCwd,
      toolName: "jobs",
      dryRun,
      model,
      thinking,
      extraExtensions,
    });
    runs.push({ label, concurrency, result });
    console.log(`[${SCENE_NAME}] ${label} done in ${result.finishedAt - result.startedAt}ms`);
  }

  const report = buildSceneReport(runs, jobCount);
  await writeMarkdownReport(report, path.join("experiments", "reports"));
  console.log(`[${SCENE_NAME}] Report written.`);
}

function buildSceneReport(runs: { label: string; concurrency: number; result: ExperimentResult }[], jobCount: number): SceneReport {
  const details: string[] = [];
  for (const run of runs) {
    const elapsedMs = run.result.finishedAt - run.result.startedAt;
    const maxPi = Math.max(...run.result.timeline.map((s) => s.piProcessCount), 0);
    const tokens = run.result.attemptMetrics.reduce((sum, m) => sum + (m.sessionUsage?.totalTokens ?? 0), 0);
    details.push(
      `${run.label}: elapsed=${elapsedMs}ms, success=${run.result.batch.summary.success}/${run.result.batch.summary.total}, maxPi=${maxPi}, tokens=${tokens}`,
    );
  }

  const full = runs.find((r) => r.label === "full")!;
  const wave = runs.find((r) => r.label === "wave-4")!;
  const fullMs = full.result.finishedAt - full.result.startedAt;
  const waveMs = wave.result.finishedAt - wave.result.startedAt;

  return {
    sceneName: SCENE_NAME,
    title: "Wave vs Full Concurrency",
    description: `Ran ${jobCount} identical lightweight jobs under full concurrency (${jobCount}) and wave concurrency (4) to compare elapsed time, success rate, and resource usage.`,
    metrics: {
      jobCount,
      fullElapsedMs: fullMs,
      waveElapsedMs: waveMs,
      speedup: waveMs > 0 ? Number((fullMs / waveMs).toFixed(2)) : 0,
      fullSuccessRate: full.result.batch.summary.success / full.result.batch.summary.total,
      waveSuccessRate: wave.result.batch.summary.success / wave.result.batch.summary.total,
      fullMaxPiProcesses: Math.max(...full.result.timeline.map((s) => s.piProcessCount), 0),
      waveMaxPiProcesses: Math.max(...wave.result.timeline.map((s) => s.piProcessCount), 0),
      fullTotalTokens: full.result.attemptMetrics.reduce((sum, m) => sum + (m.sessionUsage?.totalTokens ?? 0), 0),
      waveTotalTokens: wave.result.attemptMetrics.reduce((sum, m) => sum + (m.sessionUsage?.totalTokens ?? 0), 0),
    },
    details,
    raw: {
      runs: runs.map((r) => ({
        label: r.label,
        concurrency: r.concurrency,
        elapsedMs: r.result.finishedAt - r.result.startedAt,
        timelineLength: r.result.timeline.length,
        attemptCount: r.result.attemptMetrics.length,
      })),
    },
  };
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
