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
  formatWorkerExtensions,
  formatJobsSettings,
  resolveWorkerExtensionIncludes,
  DEFAULT_JOBS_SETTINGS,
  DEFAULT_WORKER_EXTENSIONS,
  REPORT_POLICY_ID,
} from "../../extensions/jobs/settings.ts";

// ── DEFAULT_JOBS_SETTINGS ──

test("DEFAULT_JOBS_SETTINGS has correct shape and values", () => {
  assert.strictEqual(REPORT_POLICY_ID, "visible_plain_text_final_summary");
  assert.strictEqual(DEFAULT_JOBS_SETTINGS.reportPolicy, REPORT_POLICY_ID);
  assert.strictEqual(DEFAULT_JOBS_SETTINGS.waveGuidance.enabled, true);
  assert.strictEqual(DEFAULT_JOBS_SETTINGS.waveGuidance.min, 4);
  assert.strictEqual(DEFAULT_JOBS_SETTINGS.waveGuidance.max, 6);
  assert.strictEqual(DEFAULT_JOBS_SETTINGS.syncFirstGuidance, true);
  assert.deepStrictEqual(DEFAULT_WORKER_EXTENSIONS, { include: [] });
  assert.deepStrictEqual(DEFAULT_JOBS_SETTINGS.workerExtensions, { include: [] });
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
    workerExtensions: { include: ["./child.ts", " npm:@scope/ext "] },
  };
  const result = normalizeJobsSettings(raw);
  assert.strictEqual(result.waveGuidance.enabled, false);
  assert.strictEqual(result.waveGuidance.min, 2);
  assert.strictEqual(result.waveGuidance.max, 8);
  assert.strictEqual(result.syncFirstGuidance, false);
  assert.deepStrictEqual(result.workerExtensions, { include: ["./child.ts", "npm:@scope/ext"] });
});

// ── workerExtensions normalization ──

test("normalizeJobsSettings trims, dedupes, and drops invalid worker extension includes", () => {
  const result = normalizeJobsSettings({
    workerExtensions: { include: [" ./a.ts ", "", "./a.ts", 12, null, "npm:pkg", "npm:pkg", "../b.ts"] },
  });
  assert.deepStrictEqual(result.workerExtensions.include, ["./a.ts", "npm:pkg", "../b.ts"]);
});

test("normalizeJobsSettings falls back to empty include for non-array worker extension includes", () => {
  const result = normalizeJobsSettings({ workerExtensions: { include: "./bad.ts" } });
  assert.deepStrictEqual(result.workerExtensions.include, []);
});

test("resolveWorkerExtensionIncludes resolves local relative paths only", () => {
  const root = path.join(os.tmpdir(), "pi-settings-root");
  assert.deepStrictEqual(resolveWorkerExtensionIncludes(root, ["./a.ts", "../b.ts", "/abs/c.ts", "~/d.ts", "npm:pkg", "@scope/pkg", "https://example.test/ext.js"]), [
    path.resolve(root, "./a.ts"),
    path.resolve(root, "../b.ts"),
    "/abs/c.ts",
    "~/d.ts",
    "npm:pkg",
    "@scope/pkg",
    "https://example.test/ext.js",
  ]);
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
  await fs.writeFile(filePath, JSON.stringify({ waveGuidance: { enabled: false }, workerExtensions: { include: [" ./worker.ts "] } }), "utf-8");
  const result = loadJobsSettings(root);
  assert.strictEqual(result.waveGuidance.enabled, false);
  assert.deepStrictEqual(result.workerExtensions, { include: ["./worker.ts"] });
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
    workerExtensions: { include: ["./child.ts", "npm:extra"] },
  };
  saveJobsSettings(root, settings);
  const filePath = path.join(root, ".pi", "jobs-settings.json");
  const content = JSON.parse(await fs.readFile(filePath, "utf-8"));
  assert.strictEqual(content.waveGuidance.enabled, false);
  assert.strictEqual(content.waveGuidance.min, 2);
  assert.strictEqual(content.waveGuidance.max, 3);
  assert.strictEqual(content.syncFirstGuidance, false);
  assert.deepStrictEqual(content.workerExtensions, { include: ["./child.ts", "npm:extra"] });
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
    workerExtensions: { include: [" ./ok.ts ", "", "./ok.ts", 7] },
  };
  saveJobsSettings(root, badSettings);
  const readBack = loadJobsSettings(root);
  assert.strictEqual(readBack.waveGuidance.enabled, true);
  assert.strictEqual(readBack.waveGuidance.min, 4); // fallback to default
  assert.strictEqual(readBack.waveGuidance.max, 6); // fallback to default
  assert.strictEqual(readBack.syncFirstGuidance, true);
  assert.deepStrictEqual(readBack.workerExtensions, { include: ["./ok.ts"] });
});

// ── formatReportPolicy ──

test("formatReportPolicy returns expected text", () => {
  const policy = formatReportPolicy();
  assert.ok(policy.includes("visible plain-text final assistant summary"));
  assert.ok(policy.includes("optional compatibility or audit artifacts"));
  assert.ok(policy.includes("acceptance contracts"));
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

// ── formatWorkerExtensions ──

test("formatWorkerExtensions describes allowlist loading", () => {
  const text = formatWorkerExtensions({ include: ["./a.ts", "npm:pkg"] });
  assert.ok(text.includes("worker-only allowlist"));
  assert.ok(text.includes("job-worker-runtime"));
  assert.ok(text.includes("2 configured includes"));
  assert.ok(text.includes("./a.ts, npm:pkg"));
});

test("formatWorkerExtensions describes empty allowlist", () => {
  const text = formatWorkerExtensions({ include: [] });
  assert.ok(text.includes("worker-only allowlist"));
  assert.ok(text.includes("0 configured includes"));
});

// ── formatJobsSettings ──

test("formatJobsSettings includes all settings lines", () => {
  const text = formatJobsSettings(DEFAULT_JOBS_SETTINGS);
  assert.ok(text.includes("jobs-settings"));
  assert.ok(text.includes("report policy"));
  assert.ok(text.includes("visible plain-text final assistant summary"));
  assert.ok(text.includes("optional compatibility or audit artifacts"));
  assert.ok(text.includes("jobs_plan waves"));
  assert.ok(text.includes("sync-first"));
  assert.ok(text.includes("worker extensions"));
});
