/**
 * Jobs Supervisor V3 extension entrypoint.
 *
 * This file intentionally contains registration/wiring only. Runtime logic lives
 * in focused modules such as supervisor.ts, worker-runner.ts, and audit-log.ts.
 */

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import { Type } from "@sinclair/typebox";
import { registerJobsCleanCommand, registerJobsSettingsCommand, registerJobsStartCommand } from "./commands.ts";
import { buildRerunParamsFromBatchDir, isRerunFilter, RERUN_FILTERS } from "./rerun.ts";
import { buildResultText, enforceInlineJobsLimit, validateJobsFanoutUsage } from "./run-jobs.ts";
import { executeSupervisedJobs, renderColoredFromText, type SupervisedJobsResult } from "./supervisor.ts";
import { listBatches, loadBatchDetail, renderAttemptDetailLines, renderBatchDetailLines, renderBatchListLines, renderJobDetailLines, renderJobsUiHelpLines, resolveBatchDir } from "./job-ui.ts";
import { registerJobReportTool } from "./job-report-tool.ts";
import { buildPlanStartingText, decoratePlanResultText, expandJobsPlan, validateJobsPlanInput, writePlanArtifact, type JobsPlanInput } from "./jobs-plan.ts";
import { loadToolPrompt } from "./prompt-loader.ts";
import { DEFAULT_JOBS_SETTINGS, formatReportPolicy } from "./settings.ts";
import type { JobsToolParams } from "./types.ts";

const MAX_JOBS = 100;

const PathCheckSchema = Type.Union([
  Type.String(),
  Type.Object({
    path: Type.String(),
    type: Type.Optional(Type.Union([Type.Literal("file"), Type.Literal("dir"), Type.Literal("glob")])),
    minBytes: Type.Optional(Type.Number()),
    requiredRegex: Type.Optional(Type.Array(Type.String())),
    forbiddenRegex: Type.Optional(Type.Array(Type.String())),
  }),
]);

const AcceptanceSchema = Type.Object({
  requiredPaths: Type.Optional(Type.Array(PathCheckSchema)),
  forbiddenPaths: Type.Optional(Type.Array(Type.String())),
  requiredOutputRegex: Type.Optional(Type.Array(Type.String())),
  forbiddenOutputRegex: Type.Optional(Type.Array(Type.String())),
  requiredReportRegex: Type.Optional(Type.Array(Type.String())),
  forbiddenReportRegex: Type.Optional(Type.Array(Type.String())),
  minWorkerLogBytes: Type.Optional(Type.Number()),
  minReportSummaryChars: Type.Optional(Type.Number()),
  allowedWritePaths: Type.Optional(Type.Array(Type.String())),
  forbiddenWritePaths: Type.Optional(Type.Array(Type.String())),
  requireDeliverablesEvidence: Type.Optional(Type.Boolean()),
  auditOnly: Type.Optional(Type.Boolean()),
});

const RetrySchema = Type.Object({
  maxAttempts: Type.Optional(Type.Number()),
  retryOn: Type.Optional(Type.Array(Type.String())),
  backoffMs: Type.Optional(Type.Object({
    initial: Type.Optional(Type.Number()),
    max: Type.Optional(Type.Number()),
    multiplier: Type.Optional(Type.Number()),
    jitter: Type.Optional(Type.Boolean()),
  })),
});

const ThrottleSchema = Type.Object({
  enabled: Type.Optional(Type.Boolean({ description: "Dynamic failure-aware throttling is off by default; set true to let the supervisor reduce/recover concurrency after transient failures." })),
  minConcurrency: Type.Optional(Type.Number()),
  maxConcurrency: Type.Optional(Type.Number()),
  transientFailureThreshold: Type.Optional(Type.Number()),
  windowSize: Type.Optional(Type.Number()),
});

const MetadataSchema = Type.Record(Type.String(), Type.String());

const JobItemSchema = Type.Object({
  id: Type.Optional(Type.String({ description: "Optional stable job id inside the batch" })),
  name: Type.String({ description: "Human-readable job name" }),
  prompt: Type.String({ description: "Job prompt for this supervised worker" }),
  cwd: Type.Optional(Type.String({ description: "Optional working directory override" })),
  timeoutMs: Type.Optional(Type.Number({ description: "Hard timeout in milliseconds for this worker. Default 600000; clamped to 15000..86400000; invalid values use the default." })),
  acceptance: Type.Optional(AcceptanceSchema),
  metadata: Type.Optional(MetadataSchema),
});

const JobParams = Type.Object({
  name: Type.String({ description: "Human-readable job name" }),
  prompt: Type.String({ description: "Job prompt for this supervised worker" }),
  cwd: Type.Optional(Type.String({ description: "Optional working directory override" })),
  timeoutMs: Type.Optional(Type.Number({ description: "Hard timeout in milliseconds for this worker. Default 600000; clamped to 15000..86400000; invalid values use the default." })),
  acceptance: Type.Optional(AcceptanceSchema),
  metadata: Type.Optional(MetadataSchema),
  concurrency: Type.Optional(Type.Number({ description: "Explicit concurrency cap. When omitted, the supervisor applies no hidden cap and runs all supplied jobs concurrently." })),
  retry: Type.Optional(RetrySchema),
  throttle: Type.Optional(ThrottleSchema),
});

const JobsParams = Type.Object({
  jobs: Type.Array(JobItemSchema, { description: "Job specs to launch under one supervised batch.", minItems: 1, maxItems: MAX_JOBS }),
  concurrency: Type.Optional(Type.Number({ description: "Explicit concurrency cap. When omitted, the supervisor applies no hidden cap and runs all supplied jobs concurrently." })),
  retry: Type.Optional(RetrySchema),
  throttle: Type.Optional(ThrottleSchema),
  acceptanceDefaults: Type.Optional(AcceptanceSchema),
  parentBatchId: Type.Optional(Type.String()),
  rerunOfJobIds: Type.Optional(Type.Array(Type.String())),
});

const PlanRowVarSchema = Type.Union([Type.String(), Type.Array(Type.String())]);

const JobsPlanRowSchema = Type.Object({
  id: Type.String({ description: "Stable, unique row id within the batch (matches the supervised job id). Use [A-Za-z0-9._-]." }),
  name: Type.Optional(Type.String({ description: "Optional job name override (default: '{{batchName}} {{id}}' or nameTemplate)." })),
  cwd: Type.Optional(Type.String({ description: "Optional cwd override for this row (default: cwdTemplate or context cwd)." })),
  timeoutMs: Type.Optional(Type.Number({ description: "Optional row hard timeout override in milliseconds. Default/top-level value is clamped to 15000..86400000; invalid values use the default." })),
  vars: Type.Optional(Type.Record(Type.String(), PlanRowVarSchema, { description: "Per-row template variables. Strings substitute directly; arrays join with newlines in string fields and splat when the entry is exactly {{key}} in array fields." })),
});

const JobsPlanParams = Type.Object({
  batchName: Type.String({ description: "Short batch label, used in default job names and stored in plan.json." }),
  concurrency: Type.Optional(Type.Number({ description: "Explicit concurrency cap. When omitted, all matrix rows run concurrently. Jobs with disjoint allowedWritePaths run truly in parallel; split the matrix into waves yourself when you want phased execution." })),
  matrix: Type.Array(JobsPlanRowSchema, { minItems: 1, maxItems: MAX_JOBS, description: "One row per leaf job. Keep rows compact: id + per-row vars only." }),
  promptTemplate: Type.String({ description: "Prompt template with {{key}} placeholders. Substituted per row using row.id, row.name, row.cwd, and row.vars." }),
  nameTemplate: Type.Optional(Type.String({ description: "Optional job name template (default: '{{batchName}} {{id}}')." })),
  cwdTemplate: Type.Optional(Type.String({ description: "Optional cwd template (default: row.cwd or supervisor cwd)." })),
  acceptanceTemplate: Type.Optional(AcceptanceSchema),
  metadataTemplate: Type.Optional(MetadataSchema),
  timeoutMs: Type.Optional(Type.Number({ description: "Hard timeout in milliseconds applied to every matrix row unless row.timeoutMs overrides it. Default 600000; clamped to 15000..86400000; invalid values use the default." })),
  retry: Type.Optional(RetrySchema),
  throttle: Type.Optional(ThrottleSchema),
  acceptanceDefaults: Type.Optional(AcceptanceSchema),
  synthesis: Type.Optional(Type.Object({
    mode: Type.Optional(Type.Union([Type.Literal("parent"), Type.Literal("report-only")], { description: "Experimental metadata only: who synthesizes after the batch finishes. Default: parent. Do not use jobs_plan as a workflow engine." })),
    instructions: Type.Optional(Type.String({ description: "Experimental metadata only: root agent post-batch synthesis hint, not executable workflow logic." })),
  })),
  parentBatchId: Type.Optional(Type.String()),
  rerunOfJobIds: Type.Optional(Type.Array(Type.String())),
});

function modelId(ctx: ExtensionContext): string | undefined {
  const model = ctx.model;
  if (!model?.id) return undefined;
  return model.provider ? `${model.provider}/${model.id}` : model.id;
}

function captureThinkingLevel(pi: ExtensionAPI): string | undefined {
  try {
    const level = pi.getThinkingLevel?.();
    if (typeof level === "string" && level.trim()) return level;
  } catch {}
  return undefined;
}

function buildStartingText(params: JobsToolParams, _ctx: ExtensionContext): string {
  const total = Array.isArray(params.jobs) ? params.jobs.length : 0;
  return `JOBS starting · preparing ${total} job${total === 1 ? "" : "s"}`;
}

async function runJobs(pi: ExtensionAPI, params: JobsToolParams, signal: AbortSignal | undefined, onUpdate: ((partialResult: any) => void) | undefined, ctx: ExtensionContext, toolName: "job" | "jobs") {
  if (toolName === "jobs") {
    validateJobsFanoutUsage(params);
    enforceInlineJobsLimit(params);
  }
  onUpdate?.({
    content: [{ type: "text", text: buildStartingText(params, ctx) }],
    details: { status: "starting", total: Array.isArray(params.jobs) ? params.jobs.length : 0, cwd: ctx.cwd },
    isError: false,
  });
  const result = await executeSupervisedJobs(params, {
    cwd: ctx.cwd,
    toolName,
    signal,
    model: modelId(ctx),
    thinking: captureThinkingLevel(pi),
  }, {
    onUpdate: (snapshot) => onUpdate?.({
      content: [{ type: "text", text: snapshot.text }],
      details: snapshot,
      isError: false,
    }),
  });
  return {
    content: [{ type: "text", text: result.text }],
    details: result,
    isError: result.batch.status !== "success",
  };
}

async function runJobsPlan(pi: ExtensionAPI, params: JobsPlanInput, signal: AbortSignal | undefined, onUpdate: ((partialResult: any) => void) | undefined, ctx: ExtensionContext) {
  validateJobsPlanInput(params);
  const expansion = expandJobsPlan(params);
  onUpdate?.({
    content: [{ type: "text", text: buildPlanStartingText(params, expansion, ctx.cwd) }],
    details: { status: "plan_starting", batchName: params.batchName, total: expansion.rowIds.length, rowIds: expansion.rowIds, cwd: ctx.cwd },
    isError: false,
  });
  const supervised: SupervisedJobsResult = await executeSupervisedJobs(expansion.params, {
    cwd: ctx.cwd,
    toolName: "jobs",
    signal,
    model: modelId(ctx),
    thinking: captureThinkingLevel(pi),
  }, {
    onUpdate: (snapshot) => onUpdate?.({
      content: [{ type: "text", text: snapshot.text }],
      details: snapshot,
      isError: false,
    }),
  });
  let planPath: string | undefined;
  try {
    planPath = await writePlanArtifact(supervised.batch.batchDir, supervised.batch.batchId, params, expansion);
  } catch {
    // Plan artifact write must not block returning a real supervisor result.
  }
  const finalText = planPath ? decoratePlanResultText(supervised.text, planPath, params) : supervised.text;
  return {
    content: [{ type: "text", text: finalText }],
    details: { ...supervised, plan: { batchName: params.batchName, rowIds: expansion.rowIds, jobNames: expansion.jobNames, synthesis: params.synthesis }, planPath },
    isError: supervised.batch.status !== "success",
  };
}

async function showJobsUi(args: string, ctx: ExtensionContext): Promise<void> {
  const trimmed = args.trim();
  if (!trimmed || trimmed === "help" || trimmed === "--help") {
    if (!trimmed) {
      const items = await listBatches(ctx.cwd);
      ctx.ui.notify(renderBatchListLines(items).join("\n"), "info");
      return;
    }
    ctx.ui.notify(renderJobsUiHelpLines().join("\n"), "info");
    return;
  }

  const tokens = trimmed.split(/\s+/);
  if (tokens[0] === "rerun") {
    const [, filter, batchDir, ...ids] = tokens;
    if (!filter || !isRerunFilter(filter) || !batchDir) {
      ctx.ui.notify([`Invalid rerun command. Filters: ${RERUN_FILTERS.join(", ")}`, ...renderJobsUiHelpLines()].join("\n"), "warning");
      return;
    }
    const payload = await buildRerunParamsFromBatchDir(resolveBatchDir(ctx.cwd, batchDir), filter, ids.length ? ids : undefined);
    if (payload.rerunOfJobIds.length === 0) {
      ctx.ui.notify(`No jobs matched rerun filter '${filter}'. Use /jobs-ui ${batchDir} to inspect the batch.`, "warning");
      return;
    }
    const { jobs: rerunJobs, ...rest } = payload;
    const text = JSON.stringify({ ...rest, jobs: rerunJobs }, null, 2);
    if (ctx.hasUI) ctx.ui.pasteToEditor(text);
    ctx.ui.notify(`Prepared rerun payload for ${payload.rerunOfJobIds.length} job(s): ${payload.rerunOfJobIds.join(", ")}`, "info");
    return;
  }

  const [batchInput, subcommand, jobId, attemptRef] = tokens;
  const detail = await loadBatchDetail(resolveBatchDir(ctx.cwd, batchInput));
  if (!subcommand) {
    ctx.ui.notify(renderBatchDetailLines(detail).join("\n"), detail.batch.status === "error" ? "warning" : "info");
    return;
  }
  if (subcommand === "job" && jobId) {
    ctx.ui.notify(renderJobDetailLines(detail, jobId).join("\n"), "info");
    return;
  }
  if (subcommand === "attempt" && jobId) {
    ctx.ui.notify(renderAttemptDetailLines(detail, jobId, attemptRef ?? "latest").join("\n"), "info");
    return;
  }
  ctx.ui.notify([`Unknown jobs-ui subcommand: ${subcommand}`, ...renderJobsUiHelpLines()].join("\n"), "warning");
}

export default function jobExtension(pi: ExtensionAPI) {
  if (process.env.PI_CHILD_TYPE) return;
  registerJobReportTool(pi);

  registerJobsStartCommand(pi);
  registerJobsSettingsCommand(pi);
  registerJobsCleanCommand(pi);

  pi.registerCommand("jobs-ui", {
    description: "Show supervised job batch artifacts or prepare rerun payloads",
    handler: async (args, ctx) => {
      try {
        await showJobsUi(args, ctx);
      } catch (error) {
        ctx.ui.notify(`jobs-ui failed: ${error instanceof Error ? error.message : String(error)}`, "error");
      }
    },
  });

  const toolPromptVars = {
    reportPolicy: formatReportPolicy(),
    waveMin: DEFAULT_JOBS_SETTINGS.waveGuidance.min,
    waveMax: DEFAULT_JOBS_SETTINGS.waveGuidance.max,
  };
  const jobPromptText = loadToolPrompt("job", toolPromptVars);
  const jobsPromptText = loadToolPrompt("jobs", toolPromptVars);
  const jobsPlanPromptText = loadToolPrompt("jobs_plan", toolPromptVars);

  pi.registerTool({
    name: "job",
    label: "Job",
    ...jobPromptText,
    parameters: JobParams,
    async execute(_toolCallId, params, signal, onUpdate, ctx) {
      const { name, prompt, cwd, timeoutMs, acceptance, metadata, concurrency, retry, throttle } = params as any;
      return runJobs(pi, { jobs: [{ name, prompt, cwd, timeoutMs, acceptance, metadata }], concurrency, retry, throttle }, signal, onUpdate, ctx, "job");
    },
    renderCall(args, theme) {
      return new Text(`${theme.fg("toolTitle", theme.bold("job "))}${theme.fg("accent", String((args as any).name ?? "job"))}`, 0, 0);
    },
    renderResult(result, _opts, theme) {
      const text = result.content[0]?.type === "text" ? result.content[0].text : buildResultText({ batchId: "unknown", batchDir: "unknown", status: "incomplete", total: 0, success: 0, error: 0, aborted: 0 });
      const details = (result as any).details;
      if (details?.batch && Array.isArray(details?.jobs)) {
        return new Text(renderColoredFromText(theme as any, text, details.batch, details.jobs), 0, 0);
      }
      const color = text.startsWith("JOBS running") || text.startsWith("JOBS starting") ? "warning" : result.isError ? "error" : "success";
      return new Text(theme.fg(color, text), 0, 0);
    },
  });

  pi.registerTool({
    name: "jobs",
    label: "Jobs",
    ...jobsPromptText,
    parameters: JobsParams,
    async execute(_toolCallId, params, signal, onUpdate, ctx) {
      const { jobs, concurrency, retry, throttle, acceptanceDefaults, parentBatchId, rerunOfJobIds } = params as any;
      return runJobs(pi, { jobs: jobs, concurrency, retry, throttle, acceptanceDefaults, parentBatchId, rerunOfJobIds }, signal, onUpdate, ctx, "jobs");
    },
    renderCall(args, theme) {
      const jobCount = Array.isArray((args as any).jobs) ? (args as any).jobs.length : 0;
      return new Text(`${theme.fg("toolTitle", theme.bold("jobs "))}${theme.fg("accent", `${jobCount} job${jobCount === 1 ? "" : "s"}`)}`, 0, 0);
    },
    renderResult(result, _opts, theme) {
      const text = result.content[0]?.type === "text" ? result.content[0].text : "(no job result)";
      const details = (result as any).details;
      if (details?.batch && Array.isArray(details?.jobs)) {
        return new Text(renderColoredFromText(theme as any, text, details.batch, details.jobs), 0, 0);
      }
      const color = text.startsWith("JOBS running") || text.startsWith("JOBS starting") ? "warning" : result.isError ? "error" : "success";
      return new Text(theme.fg(color, text), 0, 0);
    },
  });

  pi.registerTool({
    name: "jobs_plan",
    label: "Jobs Plan",
    ...jobsPlanPromptText,
    parameters: JobsPlanParams,
    async execute(_toolCallId, params, signal, onUpdate, ctx) {
      return runJobsPlan(pi, params as unknown as JobsPlanInput, signal, onUpdate, ctx);
    },
    renderCall(args, theme) {
      const matrix = Array.isArray((args as any).matrix) ? (args as any).matrix : [];
      const batchName = String((args as any).batchName ?? "plan");
      return new Text(`${theme.fg("toolTitle", theme.bold("jobs_plan "))}${theme.fg("accent", `${batchName} · ${matrix.length} job${matrix.length === 1 ? "" : "s"}`)}`, 0, 0);
    },
    renderResult(result, _opts, theme) {
      const text = result.content[0]?.type === "text" ? result.content[0].text : "(no plan result)";
      const details = (result as any).details;
      if (details?.batch && Array.isArray(details?.jobs)) {
        return new Text(renderColoredFromText(theme as any, text, details.batch, details.jobs), 0, 0);
      }
      const color = text.startsWith("JOBS running") || text.startsWith("JOBS starting") || text.startsWith("JOBS plan starting") ? "warning" : result.isError ? "error" : "success";
      return new Text(theme.fg(color, text), 0, 0);
    },
  });
}
