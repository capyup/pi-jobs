/**
 * Scene 03: Settings Toggle Impact on Prompt
 * Observe how /jobs-settings toggles change the generated worker prompt.
 */
import * as path from "node:path";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import { saveJobsSettings, loadJobsSettings, DEFAULT_JOBS_SETTINGS, type JobsSettings } from "../extensions/jobs/settings.ts";
import { expandJobsPlan, type JobsPlanInput } from "../extensions/jobs/jobs-plan.ts";
import { runExperiment, type ExperimentResult } from "./lib/runner.ts";
import { writeMarkdownReport, type SceneReport } from "./lib/report.ts";

const SCENE_NAME = "scene-03-settings-prompt";
const TMP_DIR = path.join(os.tmpdir(), "pi-experiments", SCENE_NAME);

interface PromptSnapshot {
  label: string;
  settings: JobsSettings;
  promptPath: string;
  content: string;
}

async function capturePrompt(label: string, settings: JobsSettings, cwd: string, model?: string, thinking?: string): Promise<PromptSnapshot> {
  saveJobsSettings(cwd, settings);
  const plan: JobsPlanInput = {
    batchName: `${SCENE_NAME}-${label}`,
    matrix: [{ id: "test01" }],
    promptTemplate: `Create a file at ${TMP_DIR}/test.txt with content "settings test". Then call job_report with status completed.`,
    // nameTemplate defaults to `${batchName} ${id}` when omitted
  };
  const expanded = expandJobsPlan(plan);
  const extraExtensions = model?.startsWith("accounts/fireworks") || model?.startsWith("fireworks/")
    ? [path.join(os.homedir(), ".pi/agent/git/github.com/lulucatdev/pi-fireworks-provider/extensions/fireworks")]
    : undefined;
  const result = await runExperiment(expanded.params, {
    experimentName: `${SCENE_NAME}-${label}`,
    cwd,
    toolName: "jobs",
    dryRun: true, // only care about prompt generation, not LLM execution
    model,
    thinking,
    extraExtensions,
  });
  // Find the worker prompt path from the first job's first attempt
  const job = result.jobs[0];
  const attemptDir = job?.attempts?.[0]?.attemptDir ?? path.join(result.batch.batchDir, "jobs", "test01", "attempts", "test01-a1");
  const promptPath = path.join(attemptDir, "worker-prompt.md");
  const content = await fs.readFile(promptPath, "utf-8").catch(() => "");
  return { label, settings, promptPath, content };
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
  const model = parseModelArg();
  const thinking = parseThinkingArg();

  const snapshots: PromptSnapshot[] = [];

  // Baseline: default settings
  console.log(`[${SCENE_NAME}] Capturing default settings prompt...`);
  snapshots.push(await capturePrompt("default", DEFAULT_JOBS_SETTINGS, experimentCwd, model, thinking));

  // Wave guidance disabled
  console.log(`[${SCENE_NAME}] Capturing wave-disabled prompt...`);
  snapshots.push(await capturePrompt("wave-disabled", {
    ...DEFAULT_JOBS_SETTINGS,
    waveGuidance: { enabled: false, min: 4, max: 6 },
  }, experimentCwd, model, thinking));

  // Sync-first disabled
  console.log(`[${SCENE_NAME}] Capturing sync-first-disabled prompt...`);
  snapshots.push(await capturePrompt("sync-first-disabled", {
    ...DEFAULT_JOBS_SETTINGS,
    syncFirstGuidance: false,
  }, experimentCwd, model, thinking));

  // Restore defaults
  saveJobsSettings(experimentCwd, DEFAULT_JOBS_SETTINGS);

  const report = buildSceneReport(snapshots, model, thinking);
  await writeMarkdownReport(report, path.join("experiments", "reports"));
  console.log(`[${SCENE_NAME}] Report written.`);
}

function buildSceneReport(snapshots: PromptSnapshot[], model?: string, thinking?: string): SceneReport {
  const baseline = snapshots.find((s) => s.label === "default")!;
  const details: string[] = [];
  const diffs: Record<string, string> = {};

  for (const snap of snapshots) {
    const lines = snap.content.split("\n").length;
    details.push(`${snap.label}: ${lines} lines, ${snap.content.length} chars`);
    if (snap.label !== "default") {
      const diff = extractDifferences(baseline.content, snap.content);
      diffs[snap.label] = diff;
      details.push(`  diff: ${diff}`);
    }
  }

  return {
    sceneName: SCENE_NAME,
    title: "Settings Toggle Impact on Worker Prompt",
    description: `Captured worker-prompt.md under different /jobs-settings configurations to observe how toggles affect prompt content.`,
    metrics: {
      snapshots: snapshots.length,
      baselineLines: baseline.content.split("\n").length,
      baselineChars: baseline.content.length,
      ...(model ? { model } : {}),
      ...(thinking ? { thinking } : {}),
    },
    details,
    raw: {
      diffs,
      prompts: snapshots.map((s) => ({ label: s.label, path: s.promptPath, preview: s.content.slice(0, 800) })),
    },
  };
}

function extractDifferences(a: string, b: string): string {
  const aLines = a.split("\n");
  const bLines = b.split("\n");
  const onlyInB = bLines.filter((line) => !aLines.includes(line));
  const onlyInA = aLines.filter((line) => !bLines.includes(line));
  if (onlyInB.length === 0 && onlyInA.length === 0) return "identical";
  return `+${onlyInB.length} lines, -${onlyInA.length} lines`;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
