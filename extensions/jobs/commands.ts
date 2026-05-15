import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { renderPromptFile } from "./prompt-loader.ts";
import { DEFAULT_JOBS_SETTINGS, formatJobsSettings, formatReportPolicy, formatWaveGuidance, loadJobsSettings, saveJobsSettings, type JobsSettings } from "./settings.ts";

export function getJobsStartGuidance(): string {
  return renderPromptFile("jobs-start.md", {
    reportPolicy: formatReportPolicy(),
    waveGuidance: formatWaveGuidance(DEFAULT_JOBS_SETTINGS),
  });
}

export const JOBS_START_GUIDANCE = getJobsStartGuidance();

function buildJobsStartText(description: string): string {
  const guidance = getJobsStartGuidance();
  const trimmed = description.trim();
  return trimmed ? `${guidance}\n\nUser request:\n${trimmed}` : guidance;
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
