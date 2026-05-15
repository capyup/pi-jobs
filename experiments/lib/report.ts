import * as fs from "node:fs/promises";
import * as path from "node:path";

export interface SceneReport {
  sceneName: string;
  title: string;
  description: string;
  metrics: Record<string, number | string | boolean>;
  details: string[];
  raw?: Record<string, unknown>;
}

export async function writeMarkdownReport(report: SceneReport, reportsDir: string): Promise<string> {
  const dir = path.resolve(reportsDir);
  await fs.mkdir(dir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const fileName = `${report.sceneName}-${timestamp}.md`;
  const filePath = path.join(dir, fileName);

  const lines: string[] = [
    `# ${report.title}`,
    "",
    `**Scene:** \`${report.sceneName}\``,
    `**Generated:** ${new Date().toISOString()}`,
    "",
    "## Description",
    "",
    report.description,
    "",
    "## Metrics",
    "",
    "| Metric | Value |",
    "|--------|-------|",
  ];

  for (const [key, value] of Object.entries(report.metrics)) {
    const formatted = typeof value === "number" && !Number.isInteger(value) ? value.toFixed(4) : String(value);
    lines.push(`| ${key} | ${formatted} |`);
  }

  lines.push("", "## Details", "");
  for (const detail of report.details) {
    lines.push(`- ${detail}`);
  }

  if (report.raw) {
    lines.push("", "## Raw Data", "", "```json");
    lines.push(JSON.stringify(report.raw, null, 2));
    lines.push("```");
  }

  lines.push("");
  await fs.writeFile(filePath, lines.join("\n"), "utf-8");
  return filePath;
}

export function writeSummaryReport(scenes: SceneReport[], reportsDir: string): Promise<string> {
  const summary: SceneReport = {
    sceneName: "summary",
    title: "Experiment Suite Summary",
    description: `Aggregated results from ${scenes.length} experiment scenes.`,
    metrics: {
      totalScenes: scenes.length,
    },
    details: scenes.map((s) => `${s.title}: ${Object.entries(s.metrics).map(([k, v]) => `${k}=${v}`).join(", ")}`),
  };
  return writeMarkdownReport(summary, reportsDir);
}
