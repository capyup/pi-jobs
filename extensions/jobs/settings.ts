import * as fs from "node:fs";
import * as path from "node:path";

export const REPORT_POLICY_ID = "acceptance_optional_report_else_report_or_visible_terminal" as const;

export interface JobsSettings {
  reportPolicy: typeof REPORT_POLICY_ID;
  waveGuidance: {
    enabled: boolean;
    min: number;
    max: number;
  };
  syncFirstGuidance: boolean;
}

export const DEFAULT_JOBS_SETTINGS: JobsSettings = {
  reportPolicy: REPORT_POLICY_ID,
  waveGuidance: { enabled: true, min: 4, max: 6 },
  syncFirstGuidance: true,
};

export function jobsSettingsPath(cwd: string): string {
  return path.join(cwd, ".pi", "jobs-settings.json");
}

function clampWave(value: unknown, fallback: number): number {
  return Number.isInteger(value) && (value as number) >= 1 && (value as number) <= 100 ? value as number : fallback;
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
  };
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

export function formatJobsSettings(settings: JobsSettings): string {
  return [
    "jobs-settings",
    `report policy: ${formatReportPolicy()}`,
    `jobs_plan waves: ${formatWaveGuidance(settings)}`,
    `sync-first guidance: ${settings.syncFirstGuidance ? "enabled" : "disabled"}`,
  ].join("\n");
}
