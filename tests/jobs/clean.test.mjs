import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

import {
  cleanJobsArtifacts,
  formatBytes,
  formatCleanResult,
} from "../../extensions/jobs/clean.ts";
import { registerJobsCleanCommand } from "../../extensions/jobs/commands.ts";

// ── cleanJobsArtifacts ──

test("cleanJobsArtifacts deletes .pi/jobs/ and reports batch count + bytes", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "pi-clean-"));
  const jobsDir = path.join(root, ".pi", "jobs");
  await fs.mkdir(path.join(jobsDir, "batch-1", "jobs"), { recursive: true });
  await fs.mkdir(path.join(jobsDir, "batch-2", "attempts", "t001", "attempt-1"), { recursive: true });
  await fs.writeFile(path.join(jobsDir, "batch-1", "batch.json"), "{\"a\":1}", "utf-8");
  await fs.writeFile(path.join(jobsDir, "batch-1", "jobs", "t001.json"), "x".repeat(200), "utf-8");
  await fs.writeFile(path.join(jobsDir, "batch-2", "attempts", "t001", "attempt-1", "session.jsonl"), "y".repeat(500), "utf-8");

  const result = await cleanJobsArtifacts(root);
  assert.strictEqual(result.existed, true);
  assert.strictEqual(result.batchCount, 2);
  assert.ok(result.bytesFreed >= 700, `expected >=700 bytes, got ${result.bytesFreed}`);
  assert.strictEqual(result.jobsDir, path.join(path.resolve(root), ".pi", "jobs"));

  await assert.rejects(fs.access(jobsDir), /ENOENT/);
});

test("cleanJobsArtifacts preserves jobs-settings.json", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "pi-clean-settings-"));
  const settingsPath = path.join(root, ".pi", "jobs-settings.json");
  await fs.mkdir(path.dirname(settingsPath), { recursive: true });
  await fs.writeFile(settingsPath, '{"workerExtensions":{"include":["keep-me"]}}', "utf-8");
  await fs.mkdir(path.join(root, ".pi", "jobs", "batch-1"), { recursive: true });

  const result = await cleanJobsArtifacts(root);
  assert.strictEqual(result.existed, true);
  assert.strictEqual(result.batchCount, 1);

  const preserved = await fs.readFile(settingsPath, "utf-8");
  assert.strictEqual(preserved, '{"workerExtensions":{"include":["keep-me"]}}');
});

test("cleanJobsArtifacts returns existed=false when nothing to clean", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "pi-clean-empty-"));
  const result = await cleanJobsArtifacts(root);
  assert.strictEqual(result.existed, false);
  assert.strictEqual(result.batchCount, 0);
  assert.strictEqual(result.bytesFreed, 0);
  assert.ok(result.jobsDir.endsWith(path.join(".pi", "jobs")));
});

test("cleanJobsArtifacts handles empty .pi/jobs/ directory", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "pi-clean-empty-dir-"));
  await fs.mkdir(path.join(root, ".pi", "jobs"), { recursive: true });
  const result = await cleanJobsArtifacts(root);
  assert.strictEqual(result.existed, true);
  assert.strictEqual(result.batchCount, 0);
  assert.strictEqual(result.bytesFreed, 0);
  await assert.rejects(fs.access(path.join(root, ".pi", "jobs")), /ENOENT/);
});

// ── formatters ──

test("formatBytes scales B / KB / MB / GB", () => {
  assert.strictEqual(formatBytes(0), "0 B");
  assert.strictEqual(formatBytes(512), "512 B");
  assert.strictEqual(formatBytes(2048), "2.0 KB");
  assert.strictEqual(formatBytes(5 * 1024 * 1024), "5.0 MB");
  assert.strictEqual(formatBytes(3 * 1024 * 1024 * 1024), "3.00 GB");
});

test("formatCleanResult produces human-friendly text for each state", () => {
  assert.match(
    formatCleanResult({ jobsDir: "/tmp/x/.pi/jobs", existed: false, batchCount: 0, bytesFreed: 0 }),
    /nothing to clean/,
  );
  const single = formatCleanResult({ jobsDir: "/tmp/x/.pi/jobs", existed: true, batchCount: 1, bytesFreed: 1024 });
  assert.match(single, /removed 1 batch /);
  assert.match(single, /1\.0 KB/);
  const many = formatCleanResult({ jobsDir: "/tmp/x/.pi/jobs", existed: true, batchCount: 4, bytesFreed: 5 * 1024 * 1024 });
  assert.match(many, /removed 4 batches /);
  assert.match(many, /5\.0 MB/);
});

// ── registerJobsCleanCommand ──

test("registerJobsCleanCommand registers 'jobs-clean' command", () => {
  const registered = [];
  const mockPi = { registerCommand: (name, config) => registered.push({ name, config }) };
  registerJobsCleanCommand(mockPi);
  assert.strictEqual(registered.length, 1);
  assert.strictEqual(registered[0].name, "jobs-clean");
  assert.ok(registered[0].config.description.includes("Delete all supervised job artifacts"));
});

test("jobs-clean handler deletes artifacts and notifies summary", async () => {
  const registered = [];
  const mockPi = { registerCommand: (name, config) => registered.push({ name, config }) };
  registerJobsCleanCommand(mockPi);
  const handler = registered[0].config.handler;

  const root = await fs.mkdtemp(path.join(os.tmpdir(), "pi-clean-cmd-"));
  await fs.mkdir(path.join(root, ".pi", "jobs", "batch-1"), { recursive: true });
  await fs.writeFile(path.join(root, ".pi", "jobs", "batch-1", "batch.json"), "{}", "utf-8");

  const notifications = [];
  await handler("", {
    hasUI: true,
    cwd: root,
    ui: { notify: (msg, type) => notifications.push({ msg, type }) },
  });

  assert.strictEqual(notifications.length, 1);
  assert.strictEqual(notifications[0].type, "info");
  assert.match(notifications[0].msg, /removed 1 batch /);
  await assert.rejects(fs.access(path.join(root, ".pi", "jobs")), /ENOENT/);
});

test("jobs-clean handler notifies nothing-to-clean when dir is missing", async () => {
  const registered = [];
  const mockPi = { registerCommand: (name, config) => registered.push({ name, config }) };
  registerJobsCleanCommand(mockPi);
  const handler = registered[0].config.handler;

  const root = await fs.mkdtemp(path.join(os.tmpdir(), "pi-clean-cmd-empty-"));
  const notifications = [];
  await handler("", {
    hasUI: true,
    cwd: root,
    ui: { notify: (msg, type) => notifications.push({ msg, type }) },
  });

  assert.strictEqual(notifications.length, 1);
  assert.strictEqual(notifications[0].type, "info");
  assert.match(notifications[0].msg, /nothing to clean/);
});
