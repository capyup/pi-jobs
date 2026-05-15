/**
 * Run all experiment scenes and produce a consolidated summary report.
 */
import { spawn } from "node:child_process";
import * as path from "node:path";
import { writeSummaryReport } from "./lib/report.ts";
import type { SceneReport } from "./lib/report.ts";

const scenes = [
  { name: "scene-01-concurrent-resource", script: "experiments/scene-01-concurrent-resource.ts", defaultDryRun: false },
  { name: "scene-02-wave-vs-full", script: "experiments/scene-02-wave-vs-full.ts", defaultDryRun: false },
  { name: "scene-03-settings-prompt", script: "experiments/scene-03-settings-prompt.ts", defaultDryRun: true },
];

const dryRunFlag = process.argv.includes("--dry-run");

function parseModelArg(): string | undefined {
  const idx = process.argv.indexOf("--model");
  return idx !== -1 && process.argv[idx + 1] ? process.argv[idx + 1] : undefined;
}

function parseThinkingArg(): string | undefined {
  const idx = process.argv.indexOf("--thinking");
  return idx !== -1 && process.argv[idx + 1] ? process.argv[idx + 1] : undefined;
}

async function runScene(scene: (typeof scenes)[number]): Promise<{ exitCode: number; output: string }> {
  return new Promise((resolve) => {
    const args: string[] = ["tsx", scene.script];
    if (dryRunFlag || scene.defaultDryRun) args.push("--dry-run");
    const model = parseModelArg();
    const thinking = parseThinkingArg();
    if (model) { args.push("--model", model); }
    if (thinking) { args.push("--thinking", thinking); }
    const proc = spawn("npx", args, {
      cwd: process.cwd(),
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    proc.stdout.on("data", (chunk: Buffer) => { output += chunk.toString(); });
    proc.stderr.on("data", (chunk: Buffer) => { output += chunk.toString(); });
    proc.on("close", (code) => resolve({ exitCode: code ?? 1, output }));
  });
}

async function main() {
  console.log("=== Experiment Suite ===");
  console.log(`Dry run mode: ${dryRunFlag}`);
  console.log("");

  const sceneOutputs: { name: string; exitCode: number; output: string }[] = [];

  for (const scene of scenes) {
    console.log(`[suite] Running ${scene.name}...`);
    const result = await runScene(scene);
    sceneOutputs.push({ name: scene.name, ...result });
    console.log(result.output);
    if (result.exitCode !== 0) {
      console.error(`[suite] ${scene.name} failed with exit code ${result.exitCode}`);
    }
  }

  // Build synthetic reports for summary (in a real run, we'd read the generated markdown)
  const syntheticReports: SceneReport[] = sceneOutputs.map((so) => ({
    sceneName: so.name,
    title: so.name,
    description: `Exit code ${so.exitCode}`,
    metrics: { exitCode: so.exitCode, outputLength: so.output.length },
    details: so.output.split("\n").filter((l) => l.trim()).slice(0, 10),
  }));

  const summaryPath = await writeSummaryReport(syntheticReports, path.join("experiments", "reports"));
  console.log(`[suite] Summary report: ${summaryPath}`);

  const allOk = sceneOutputs.every((s) => s.exitCode === 0);
  process.exit(allOk ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
