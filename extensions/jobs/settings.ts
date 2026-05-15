import * as fs from "node:fs";
import * as path from "node:path";

export const REPORT_POLICY_ID = "acceptance_optional_report_else_report_or_visible_terminal" as const;
export interface WorkerExtensionsSettings {
  include: string[];
}

export interface JobsSettings {
  reportPolicy: typeof REPORT_POLICY_ID;
  waveGuidance: {
    enabled: boolean;
    min: number;
    max: number;
  };
  syncFirstGuidance: boolean;
  workerExtensions: WorkerExtensionsSettings;
}

export const DEFAULT_WORKER_EXTENSIONS: WorkerExtensionsSettings = {
  include: [],
};

export const DEFAULT_JOBS_SETTINGS: JobsSettings = {
  reportPolicy: REPORT_POLICY_ID,
  waveGuidance: { enabled: true, min: 4, max: 6 },
  syncFirstGuidance: true,
  workerExtensions: DEFAULT_WORKER_EXTENSIONS,
};

export function jobsSettingsPath(cwd: string): string {
  return path.join(cwd, ".pi", "jobs-settings.json");
}

function clampWave(value: unknown, fallback: number): number {
  return Number.isInteger(value) && (value as number) >= 1 && (value as number) <= 100 ? value as number : fallback;
}

function normalizeWorkerExtensionInclude(value: unknown): string[] {
  if (!Array.isArray(value)) return DEFAULT_WORKER_EXTENSIONS.include;
  const seen = new Set<string>();
  const include: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") continue;
    const trimmed = item.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    include.push(trimmed);
  }
  return include;
}

function normalizeWorkerExtensions(value: unknown): WorkerExtensionsSettings {
  const record = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return {
    include: normalizeWorkerExtensionInclude(record.include),
  };
}

export function normalizeJobsSettings(raw: unknown): JobsSettings {
  if (!raw || typeof raw !== "object") return DEFAULT_JOBS_SETTINGS;
  const record = raw as Record<string, unknown>;
  const wave = record.waveGuidance && typeof record.waveGuidance === "object"
    ? record.waveGuidance as Record<string, unknown>
    : {};
  const min = clampWave(wave.min, DEFAULT_JOBS_SETTINGS.waveGuidance.min);
  const max = Math.max(min, clampWave(wave.max, DEFAULT_JOBS_SETTINGS.waveGuidance.max));
  return {
    reportPolicy: REPORT_POLICY_ID,
    waveGuidance: {
      enabled: typeof wave.enabled === "boolean" ? wave.enabled : DEFAULT_JOBS_SETTINGS.waveGuidance.enabled,
      min,
      max,
    },
    syncFirstGuidance: typeof record.syncFirstGuidance === "boolean" ? record.syncFirstGuidance : DEFAULT_JOBS_SETTINGS.syncFirstGuidance,
    workerExtensions: normalizeWorkerExtensions(record.workerExtensions),
  };
}

export function resolveWorkerExtensionIncludes(cwd: string, include: string[]): string[] {
  return include.map((entry) => entry.startsWith(".") ? path.resolve(cwd, entry) : entry);
}

export function loadJobsSettings(cwd: string): JobsSettings {
  try {
    return normalizeJobsSettings(JSON.parse(fs.readFileSync(jobsSettingsPath(cwd), "utf-8")));
  } catch {
    return DEFAULT_JOBS_SETTINGS;
  }
}

export function saveJobsSettings(cwd: string, settings: JobsSettings): void {
  const filePath = jobsSettingsPath(cwd);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(normalizeJobsSettings(settings), null, 2), "utf-8");
}

export function formatReportPolicy(): string {
  return "with acceptance, report is optional audit evidence; without acceptance, require either a valid report or visible terminal completion";
}

export function formatWaveGuidance(settings: JobsSettings): string {
  if (!settings.waveGuidance.enabled) return "wave guidance disabled";
  return `large jobs_plan batches should be split into explicit waves of about ${settings.waveGuidance.min}-${settings.waveGuidance.max} jobs unless the user asks for full concurrency`;
}

export function formatWorkerExtensions(settings: WorkerExtensionsSettings): string {
  const count = settings.include.length;
  const entries = count ? `: ${settings.include.join(", ")}` : "";
  return `worker-only allowlist; job-worker-runtime plus ${count} configured include${count === 1 ? "" : "s"}${entries}`;
}

export function formatJobsSettings(settings: JobsSettings): string {
  return [
    "jobs-settings",
    `report policy: ${formatReportPolicy()}`,
    `jobs_plan waves: ${formatWaveGuidance(settings)}`,
    `sync-first guidance: ${settings.syncFirstGuidance ? "enabled" : "disabled"}`,
    `worker extensions: ${formatWorkerExtensions(settings.workerExtensions)}`,
  ].join("\n");
}
