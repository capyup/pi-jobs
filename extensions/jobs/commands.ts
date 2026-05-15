import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { DEFAULT_JOBS_SETTINGS, formatJobsSettings, formatReportPolicy, formatWaveGuidance, loadJobsSettings, saveJobsSettings, type JobsSettings } from "./settings.ts";

export const JOBS_START_GUIDANCE = [
  "Use `job` / `jobs` for the next stretch of work when isolated job workers would help.",
  "",
  "- The root agent stays responsible for planning, orchestration, and synthesis.",
  "- Use `jobs` when work can be split into parallel leaf job workers.",
  "- Use `job` when exactly one isolated job worker is enough.",
  `- Report policy: ${formatReportPolicy()}.`,
  `- jobs_plan guidance: ${formatWaveGuidance(DEFAULT_JOBS_SETTINGS)}.`,
  "- Keep the parent-tool experience synchronous: do not add scheduler, background notification, steer, or resume complexity.",
  "- Give jobs clear names and acceptance criteria when useful for audit.",
  "- Do not try to create nested jobs from inside a job worker.",
].join("\n");

function buildJobsStartText(description: string): string {
  const trimmed = description.trim();
  return trimmed ? `${JOBS_START_GUIDANCE}\n\nUser request:\n${trimmed}` : JOBS_START_GUIDANCE;
}

export function registerJobsStartCommand(pi: ExtensionAPI): void {
  pi.registerCommand("jobs-start", {
    description: "Insert job-oriented guidance into the editor without starting a turn",
    handler: async (args, ctx) => {
      const text = buildJobsStartText(args);
      const ui = ctx.ui as any;
      if (ctx.hasUI && typeof ui.pasteToEditor === "function") {
        ui.pasteToEditor(text);
        ctx.ui.notify("Job guidance inserted into the editor.", "info");
        return;
      }
      if (ctx.hasUI && typeof ui.setEditorText === "function") {
        ui.setEditorText(text);
        ctx.ui.notify("Job guidance loaded into the editor.", "info");
        return;
      }
      ctx.ui.notify(text, "info");
    },
  });
}

function setWave(settings: JobsSettings, min: number, max: number): JobsSettings {
  return { ...settings, waveGuidance: { ...settings.waveGuidance, enabled: true, min, max } };
}

export function registerJobsSettingsCommand(pi: ExtensionAPI): void {
  pi.registerCommand("jobs-settings", {
    description: "Show or update focused jobs policy settings",
    handler: async (_args, ctx) => {
      const ui = ctx.ui as any;
      let settings = loadJobsSettings(ctx.cwd);
      if (!ctx.hasUI || typeof ui.select !== "function") {
        ctx.ui.notify(formatJobsSettings(settings), "info");
        return;
      }

      const choices = [
        "Show current settings",
        `Set jobs_plan wave guidance to ${DEFAULT_JOBS_SETTINGS.waveGuidance.min}-${DEFAULT_JOBS_SETTINGS.waveGuidance.max}`,
        "Disable jobs_plan wave guidance",
        settings.syncFirstGuidance ? "Disable sync-first guidance" : "Enable sync-first guidance",
        "Reset to defaults",
      ];
      const choice = await ui.select("jobs-settings", choices);
      if (!choice) return;

      if (choice === choices[1]) settings = setWave(settings, DEFAULT_JOBS_SETTINGS.waveGuidance.min, DEFAULT_JOBS_SETTINGS.waveGuidance.max);
      else if (choice === choices[2]) settings = { ...settings, waveGuidance: { ...settings.waveGuidance, enabled: false } };
      else if (choice === choices[3]) settings = { ...settings, syncFirstGuidance: !settings.syncFirstGuidance };
      else if (choice === choices[4]) settings = DEFAULT_JOBS_SETTINGS;

      if (choice !== choices[0]) saveJobsSettings(ctx.cwd, settings);
      ctx.ui.notify(formatJobsSettings(settings), "info");
    },
  });
}
