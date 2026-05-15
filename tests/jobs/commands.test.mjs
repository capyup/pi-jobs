import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

import {
  JOBS_START_GUIDANCE,
  registerJobsStartCommand,
  registerJobsSettingsCommand,
} from "../../extensions/jobs/commands.ts";

// ── JOBS_START_GUIDANCE ──

test("JOBS_START_GUIDANCE contains key guidance markers", () => {
  assert.ok(JOBS_START_GUIDANCE.includes("Report policy"));
  assert.ok(JOBS_START_GUIDANCE.includes("jobs_plan"));
  assert.ok(JOBS_START_GUIDANCE.includes("parent-tool experience synchronous"));
  assert.ok(JOBS_START_GUIDANCE.includes("Do not try to create nested jobs"));
});

// ── registerJobsStartCommand ──

test("registerJobsStartCommand registers 'jobs-start' command", () => {
  const registered = [];
  const mockPi = {
    registerCommand: (name, config) => registered.push({ name, config }),
  };
  registerJobsStartCommand(mockPi);
  assert.strictEqual(registered.length, 1);
  assert.strictEqual(registered[0].name, "jobs-start");
  assert.ok(registered[0].config.description.includes("Insert job-oriented guidance"));
});

test("jobs-start handler pastes to editor when pasteToEditor is available", async () => {
  const registered = [];
  const notifications = [];
  const mockPi = {
    registerCommand: (name, config) => registered.push({ name, config }),
  };
  registerJobsStartCommand(mockPi);
  const handler = registered[0].config.handler;

  let pastedText = null;
  const ctx = {
    hasUI: true,
    ui: {
      pasteToEditor: (text) => { pastedText = text; },
      notify: (msg, type) => notifications.push({ msg, type }),
    },
  };
  await handler("test description", ctx);
  assert.ok(pastedText.includes("test description"));
  assert.ok(pastedText.includes("Use `job` / `jobs`"));
  assert.strictEqual(notifications[0].msg, "Job guidance inserted into the editor.");
});

test("jobs-start handler falls back to setEditorText", async () => {
  const registered = [];
  const notifications = [];
  const mockPi = {
    registerCommand: (name, config) => registered.push({ name, config }),
  };
  registerJobsStartCommand(mockPi);
  const handler = registered[0].config.handler;

  let setText = null;
  const ctx = {
    hasUI: true,
    ui: {
      setEditorText: (text) => { setText = text; },
      notify: (msg, type) => notifications.push({ msg, type }),
    },
  };
  await handler("", ctx);
  assert.ok(setText.includes("Use `job` / `jobs`"));
  assert.strictEqual(notifications[0].msg, "Job guidance loaded into the editor.");
});

test("jobs-start handler falls back to notify when no UI paste methods", async () => {
  const registered = [];
  const notifications = [];
  const mockPi = {
    registerCommand: (name, config) => registered.push({ name, config }),
  };
  registerJobsStartCommand(mockPi);
  const handler = registered[0].config.handler;

  const ctx = {
    hasUI: true,
    ui: {
      notify: (msg, type) => notifications.push({ msg, type }),
    },
  };
  await handler("", ctx);
  assert.ok(notifications[0].msg.includes("Use `job` / `jobs`"));
  assert.strictEqual(notifications[0].type, "info");
});

// ── registerJobsSettingsCommand ──

test("registerJobsSettingsCommand registers 'jobs-settings' command", () => {
  const registered = [];
  const mockPi = {
    registerCommand: (name, config) => registered.push({ name, config }),
  };
  registerJobsSettingsCommand(mockPi);
  assert.strictEqual(registered.length, 1);
  assert.strictEqual(registered[0].name, "jobs-settings");
  assert.ok(registered[0].config.description.includes("Show or update"));
});

test("jobs-settings handler shows settings via notify when no UI select", async () => {
  const registered = [];
  const notifications = [];
  const mockPi = {
    registerCommand: (name, config) => registered.push({ name, config }),
  };
  registerJobsSettingsCommand(mockPi);
  const handler = registered[0].config.handler;

  const root = await fs.mkdtemp(path.join(os.tmpdir(), "pi-cmd-"));
  const ctx = {
    hasUI: true,
    cwd: root,
    ui: {
      notify: (msg, type) => notifications.push({ msg, type }),
    },
  };
  await handler("", ctx);
  assert.ok(notifications[0].msg.includes("jobs-settings"));
  assert.ok(notifications[0].msg.includes("report policy"));
  assert.ok(notifications[0].msg.includes("sync-first"));
});

test("jobs-settings handler sets wave guidance via select", async () => {
  const registered = [];
  const notifications = [];
  const mockPi = {
    registerCommand: (name, config) => registered.push({ name, config }),
  };
  registerJobsSettingsCommand(mockPi);
  const handler = registered[0].config.handler;

  const root = await fs.mkdtemp(path.join(os.tmpdir(), "pi-cmd-"));
  const ctx = {
    hasUI: true,
    cwd: root,
    ui: {
      select: async (_label, choices) => choices[1], // "Set wave guidance"
      notify: (msg, type) => notifications.push({ msg, type }),
    },
  };
  await handler("", ctx);
  const settingsPath = path.join(root, ".pi", "jobs-settings.json");
  const saved = JSON.parse(await fs.readFile(settingsPath, "utf-8"));
  assert.strictEqual(saved.waveGuidance.enabled, true);
  assert.strictEqual(saved.waveGuidance.min, 4);
  assert.strictEqual(saved.waveGuidance.max, 6);
});

test("jobs-settings handler disables wave guidance via select", async () => {
  const registered = [];
  const notifications = [];
  const mockPi = {
    registerCommand: (name, config) => registered.push({ name, config }),
  };
  registerJobsSettingsCommand(mockPi);
  const handler = registered[0].config.handler;

  const root = await fs.mkdtemp(path.join(os.tmpdir(), "pi-cmd-"));
  const ctx = {
    hasUI: true,
    cwd: root,
    ui: {
      select: async (_label, choices) => choices[2], // "Disable wave guidance"
      notify: (msg, type) => notifications.push({ msg, type }),
    },
  };
  await handler("", ctx);
  const settingsPath = path.join(root, ".pi", "jobs-settings.json");
  const saved = JSON.parse(await fs.readFile(settingsPath, "utf-8"));
  assert.strictEqual(saved.waveGuidance.enabled, false);
});

test("jobs-settings handler toggles sync-first guidance", async () => {
  const registered = [];
  const notifications = [];
  const mockPi = {
    registerCommand: (name, config) => registered.push({ name, config }),
  };
  registerJobsSettingsCommand(mockPi);
  const handler = registered[0].config.handler;

  const root = await fs.mkdtemp(path.join(os.tmpdir(), "pi-cmd-"));
  const ctx = {
    hasUI: true,
    cwd: root,
    ui: {
      select: async (_label, choices) => choices[3], // "Disable sync-first"
      notify: (msg, type) => notifications.push({ msg, type }),
    },
  };
  await handler("", ctx);
  const settingsPath = path.join(root, ".pi", "jobs-settings.json");
  const saved = JSON.parse(await fs.readFile(settingsPath, "utf-8"));
  assert.strictEqual(saved.syncFirstGuidance, false);
});

test("jobs-settings handler resets to defaults", async () => {
  const registered = [];
  const notifications = [];
  const mockPi = {
    registerCommand: (name, config) => registered.push({ name, config }),
  };
  registerJobsSettingsCommand(mockPi);
  const handler = registered[0].config.handler;

  const root = await fs.mkdtemp(path.join(os.tmpdir(), "pi-cmd-"));
  // First save non-default settings
  const settingsPath = path.join(root, ".pi", "jobs-settings.json");
  await fs.mkdir(path.dirname(settingsPath), { recursive: true });
  await fs.writeFile(settingsPath, JSON.stringify({ waveGuidance: { enabled: false, min: 1, max: 2 }, syncFirstGuidance: false }), "utf-8");

  const ctx = {
    hasUI: true,
    cwd: root,
    ui: {
      select: async (_label, choices) => choices[4], // "Reset to defaults"
      notify: (msg, type) => notifications.push({ msg, type }),
    },
  };
  await handler("", ctx);
  const saved = JSON.parse(await fs.readFile(settingsPath, "utf-8"));
  assert.strictEqual(saved.waveGuidance.enabled, true);
  assert.strictEqual(saved.waveGuidance.min, 4);
  assert.strictEqual(saved.waveGuidance.max, 6);
  assert.strictEqual(saved.syncFirstGuidance, true);
});

test("jobs-settings handler does nothing on 'Show current settings'", async () => {
  const registered = [];
  const notifications = [];
  const mockPi = {
    registerCommand: (name, config) => registered.push({ name, config }),
  };
  registerJobsSettingsCommand(mockPi);
  const handler = registered[0].config.handler;

  const root = await fs.mkdtemp(path.join(os.tmpdir(), "pi-cmd-"));
  const ctx = {
    hasUI: true,
    cwd: root,
    ui: {
      select: async (_label, choices) => choices[0], // "Show current"
      notify: (msg, type) => notifications.push({ msg, type }),
    },
  };
  await handler("", ctx);
  assert.ok(notifications[0].msg.includes("jobs-settings"));
  // No file should be created for "show"
  const settingsPath = path.join(root, ".pi", "jobs-settings.json");
  try {
    await fs.access(settingsPath);
    assert.fail("Expected settings file NOT to be created");
  } catch {
    // expected
  }
});
