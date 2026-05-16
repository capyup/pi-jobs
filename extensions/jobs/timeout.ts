export const DEFAULT_JOB_TIMEOUT_MS = 600_000;
export const MIN_JOB_TIMEOUT_MS = 15_000;
export const MAX_JOB_TIMEOUT_MS = 86_400_000;

export function normalizeJobTimeoutMs(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return DEFAULT_JOB_TIMEOUT_MS;
  if (value < MIN_JOB_TIMEOUT_MS) return MIN_JOB_TIMEOUT_MS;
  if (value > MAX_JOB_TIMEOUT_MS) return MAX_JOB_TIMEOUT_MS;
  return Math.trunc(value);
}
