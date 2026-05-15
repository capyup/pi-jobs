import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

import {
  jobsSettingsPath,
  normalizeJobsSettings,
  loadJobsSettings,
  saveJobsSettings,
  formatReportPolicy,
  formatWaveGuidance,
  formatJobsSettings,
  DEFAULT_JOBS_SETTINGS,
  REPORT_POLICY_ID,
} from "../../extensions/jobs/settings.ts";

// ── DEFAULT_JOBS_SETTINGS ──

test("DEFAULT_JOBS_SETTINGS has correct shape and values", () => {
  assert.strictEqual(DEFAULT_JOBS_SETTINGS.reportPolicy, REPORT_POLICY_ID);
  assert.strictEqual(DEFAULT_JOBS_SETTINGS.waveGuidance.enabled, true);
  assert.strictEqual(DEFAULT_JOBS_SETTINGS.waveGuidance.min, 4);
  assert.strictEqual(DEFAULT_JOBS_SETTINGS.waveGuidance.max, 6);
  assert.strictEqual(DEFAULT_JOBS_SETTINGS.syncFirstGuidance, true);
});

// ── jobsSettingsPath ──

test("jobsSettingsPath returns correct path", () => {
  assert.strictEqual(jobsSettingsPath("/tmp"), path.join("/tmp", ".pi", "jobs-settings.json"));
});

// ── normalizeJobsSettings ──

test("normalizeJobsSettings returns default for null", () => {
  const result = normalizeJobsSettings(null);
  assert.deepStrictEqual(result, DEFAULT_JOBS_SETTINGS);
});

test("normalizeJobsSettings returns default for undefined", () => {
  const result = normalizeJobsSettings(undefined);
  assert.deepStrictEqual(result, DEFAULT_JOBS_SETTINGS);
});

test("normalizeJobsSettings returns default for non-object", () => {
  assert.deepStrictEqual(normalizeJobsSettings("string"), DEFAULT_JOBS_SETTINGS);
  assert.deepStrictEqual(normalizeJobsSettings(123), DEFAULT_JOBS_SETTINGS);
});

test("normalizeJobsSettings preserves valid custom values", () => {
  const raw = {
    waveGuidance: { enabled: false, min: 2, max: 8 },
    syncFirstGuidance: false,
  };
  const result = normalizeJobsSettings(raw);
  assert.strictEqual(result.waveGuidance.enabled, false);
  assert.strictEqual(result.waveGuidance.min, 2);
  assert.strictEqual(result.waveGuidance.max, 8);
  assert.strictEqual(result.syncFirstGuidance, false);
});

test("normalizeJobsSettings clamps wave min to at least 1", () => {
  const result = normalizeJobsSettings({ waveGuidance: { min: 0, max: 10 } });
  assert.strictEqual(result.waveGuidance.min, 4); // fallback to default
});

test("normalizeJobsSettings falls back wave max above 100 to default", () => {
  const result = normalizeJobsSettings({ waveGuidance: { min: 1, max: 200 } });
  assert.strictEqual(result.waveGuidance.max, 6);
});

test("normalizeJobsSettings ensures max >= min", () => {
  const result = normalizeJobsSettings({ waveGuidance: { min: 10, max: 5 } });
  assert.strictEqual(result.waveGuidance.min, 10);
  assert.strictEqual(result.waveGuidance.max, 10);
});

test("normalizeJobsSettings falls back for invalid wave values", () => {
  const result = normalizeJobsSettings({ waveGuidance: { min: "bad", max: null } });
  assert.strictEqual(result.waveGuidance.min, 4);
  assert.strictEqual(result.waveGuidance.max, 6);
});

test("normalizeJobsSettings falls back for non-boolean wave enabled", () => {
  const result = normalizeJobsSettings({ waveGuidance: { enabled: "yes" } });
  assert.strictEqual(result.waveGuidance.enabled, true);
});

test("normalizeJobsSettings falls back for non-boolean syncFirstGuidance", () => {
  const result = normalizeJobsSettings({ syncFirstGuidance: "yes" });
  assert.strictEqual(result.syncFirstGuidance, true);
});

// ── loadJobsSettings ──

test("loadJobsSettings returns default when file missing", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "pi-settings-"));
  const result = loadJobsSettings(root);
  assert.deepStrictEqual(result, DEFAULT_JOBS_SETTINGS);
});

test("loadJobsSettings reads and normalizes saved settings", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "pi-settings-"));
  const filePath = path.join(root, ".pi", "jobs-settings.json");
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify({ waveGuidance: { enabled: false } }), "utf-8");
  const result = loadJobsSettings(root);
  assert.strictEqual(result.waveGuidance.enabled, false);
});

test("loadJobsSettings returns default for malformed JSON", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "pi-settings-"));
  const filePath = path.join(root, ".pi", "jobs-settings.json");
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, "not-json", "utf-8");
  const result = loadJobsSettings(root);
  assert.deepStrictEqual(result, DEFAULT_JOBS_SETTINGS);
});

// ── saveJobsSettings ──

test("saveJobsSettings writes file that can be read back", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "pi-settings-"));
  const settings = {
    reportPolicy: REPORT_POLICY_ID,
    waveGuidance: { enabled: false, min: 2, max: 3 },
    syncFirstGuidance: false,
  };
  saveJobsSettings(root, settings);
  const filePath = path.join(root, ".pi", "jobs-settings.json");
  const content = JSON.parse(await fs.readFile(filePath, "utf-8"));
  assert.strictEqual(content.waveGuidance.enabled, false);
  assert.strictEqual(content.waveGuidance.min, 2);
  assert.strictEqual(content.waveGuidance.max, 3);
  assert.strictEqual(content.syncFirstGuidance, false);
});

test("saveJobsSettings creates .pi/ directory if needed", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "pi-settings-"));
  saveJobsSettings(root, DEFAULT_JOBS_SETTINGS);
  const dirPath = path.join(root, ".pi");
  const stat = await fs.stat(dirPath);
  assert.ok(stat.isDirectory());
});

test("saveJobsSettings normalizes before writing", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "pi-settings-"));
  const badSettings = {
    reportPolicy: REPORT_POLICY_ID,
    waveGuidance: { enabled: "yes", min: 0, max: 500 },
    syncFirstGuidance: "no",
  };
  saveJobsSettings(root, badSettings);
  const readBack = loadJobsSettings(root);
  assert.strictEqual(readBack.waveGuidance.enabled, true);
  assert.strictEqual(readBack.waveGuidance.min, 4); // fallback to default
  assert.strictEqual(readBack.waveGuidance.max, 6); // fallback to default
  assert.strictEqual(readBack.syncFirstGuidance, true);
});

// ── formatReportPolicy ──

test("formatReportPolicy returns expected text", () => {
  const policy = formatReportPolicy();
  assert.ok(policy.includes("with acceptance"));
  assert.ok(policy.includes("without acceptance"));
});

// ── formatWaveGuidance ──

test("formatWaveGuidance shows range when enabled", () => {
  const text = formatWaveGuidance({
    reportPolicy: REPORT_POLICY_ID,
    waveGuidance: { enabled: true, min: 4, max: 6 },
    syncFirstGuidance: true,
  });
  assert.ok(text.includes("4-6"));
});

test("formatWaveGuidance shows disabled when off", () => {
  const text = formatWaveGuidance({
    reportPolicy: REPORT_POLICY_ID,
    waveGuidance: { enabled: false, min: 4, max: 6 },
    syncFirstGuidance: true,
  });
  assert.strictEqual(text, "wave guidance disabled");
});

// ── formatJobsSettings ──

test("formatJobsSettings includes all three lines", () => {
  const text = formatJobsSettings(DEFAULT_JOBS_SETTINGS);
  assert.ok(text.includes("jobs-settings"));
  assert.ok(text.includes("report policy"));
  assert.ok(text.includes("jobs_plan waves"));
  assert.ok(text.includes("sync-first"));
});
