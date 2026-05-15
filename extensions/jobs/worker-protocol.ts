import * as fs from "node:fs/promises";
import { renderPromptFile } from "./prompt-loader.ts";
import type { NormalizedJobSpec, JobDeliverable, JobEvidence, JobReport } from "./types.ts";

const REPORT_STATUSES = new Set(["completed", "partial", "blocked", "error"]);
const DELIVERABLE_KINDS = new Set(["file", "dir", "note", "command"]);
const EVIDENCE_KINDS = new Set(["file", "command", "text"]);

export interface ReportValidationResult {
  ok: boolean;
  report?: JobReport;
  errors: string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function validateDeliverables(value: unknown): { ok: boolean; value: JobDeliverable[]; errors: string[] } {
  if (!Array.isArray(value)) return { ok: false, value: [], errors: ["deliverables must be an array"] };
  const errors: string[] = [];
  const deliverables: JobDeliverable[] = [];
  value.forEach((item, index) => {
    if (!isRecord(item)) {
      errors.push(`deliverables[${index}] must be an object`);
      return;
    }
    if (typeof item.path !== "string" || !item.path.trim()) errors.push(`deliverables[${index}].path must be a non-empty string`);
    if (typeof item.kind !== "string" || !DELIVERABLE_KINDS.has(item.kind)) errors.push(`deliverables[${index}].kind is invalid`);
    if (errors.length === 0 || (typeof item.path === "string" && typeof item.kind === "string" && DELIVERABLE_KINDS.has(item.kind))) {
      deliverables.push({ path: String(item.path ?? ""), kind: item.kind as JobDeliverable["kind"], description: typeof item.description === "string" ? item.description : undefined });
    }
  });
  return { ok: errors.length === 0, value: deliverables, errors };
}

function validateEvidence(value: unknown): { ok: boolean; value: JobEvidence[]; errors: string[] } {
  if (!Array.isArray(value)) return { ok: false, value: [], errors: ["evidence must be an array"] };
  const errors: string[] = [];
  const evidence: JobEvidence[] = [];
  value.forEach((item, index) => {
    if (!isRecord(item)) {
      errors.push(`evidence[${index}] must be an object`);
      return;
    }
    if (typeof item.value !== "string" || !item.value.trim()) errors.push(`evidence[${index}].value must be a non-empty string`);
    if (typeof item.kind !== "string" || !EVIDENCE_KINDS.has(item.kind)) errors.push(`evidence[${index}].kind is invalid`);
    if (typeof item.value === "string" && typeof item.kind === "string" && EVIDENCE_KINDS.has(item.kind)) {
      evidence.push({ kind: item.kind as JobEvidence["kind"], value: item.value });
    }
  });
  return { ok: errors.length === 0, value: evidence, errors };
}

export function validateJobReport(value: unknown, expected?: { jobId?: string; attemptId?: string }): ReportValidationResult {
  const errors: string[] = [];
  if (!isRecord(value)) return { ok: false, errors: ["report must be an object"] };

  if (value.schemaVersion !== 1) errors.push("schemaVersion must be 1");
  if (typeof value.jobId !== "string" || !value.jobId.trim()) errors.push("jobId must be a non-empty string");
  if (typeof value.attemptId !== "string" || !value.attemptId.trim()) errors.push("attemptId must be a non-empty string");
  if (expected?.jobId && value.jobId !== expected.jobId) errors.push(`jobId must be ${expected.jobId}`);
  if (expected?.attemptId && value.attemptId !== expected.attemptId) errors.push(`attemptId must be ${expected.attemptId}`);
  if (typeof value.status !== "string" || !REPORT_STATUSES.has(value.status)) errors.push("status is invalid");
  if (typeof value.summary !== "string" || !value.summary.trim()) errors.push("summary must be a non-empty string");

  const deliverables = validateDeliverables(value.deliverables);
  const evidence = validateEvidence(value.evidence);
  errors.push(...deliverables.errors, ...evidence.errors);

  if (errors.length > 0) return { ok: false, errors };

  return {
    ok: true,
    errors: [],
    report: {
      schemaVersion: 1,
      jobId: value.jobId as string,
      attemptId: value.attemptId as string,
      status: value.status as JobReport["status"],
      summary: value.summary as string,
      deliverables: deliverables.value,
      evidence: evidence.value,
      internalRetries: Array.isArray(value.internalRetries) ? value.internalRetries as JobReport["internalRetries"] : undefined,
      userActionRequired: typeof value.userActionRequired === "string" ? value.userActionRequired : null,
      error: typeof value.error === "string" ? value.error : null,
    },
  };
}

export async function readJobReport(reportPath: string, expected?: { jobId?: string; attemptId?: string }): Promise<ReportValidationResult> {
  try {
    const raw = await fs.readFile(reportPath, "utf-8");
    return validateJobReport(JSON.parse(raw), expected);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    if (/ENOENT|no such file/i.test(reason)) {
      return { ok: false, errors: ["No job report submitted: the worker ended its turn without calling job_report or writing job-report.json"] };
    }
    if (error instanceof SyntaxError) {
      return { ok: false, errors: [`Job report is not valid JSON: ${reason}`] };
    }
    return { ok: false, errors: [`Could not read job report: ${reason}`] };
  }
}

export function buildWorkerSystemPrompt(): string {
  return renderPromptFile("worker-system.md");
}

export function buildWorkerPrompt(input: {
  job: NormalizedJobSpec;
  attemptId: string;
  workerLogPath: string;
  reportPath: string;
}): string {
  const reportExampleJson = renderPromptFile("worker-report-example.json", {
    jobId: input.job.id,
    attemptId: input.attemptId,
  });

  return renderPromptFile("worker-prompt.md", {
    jobId: input.job.id,
    attemptId: input.attemptId,
    jobName: input.job.name,
    workerLogPath: input.workerLogPath,
    reportPath: input.reportPath,
    jobPrompt: input.job.prompt,
    reportExampleJson,
  });
}
