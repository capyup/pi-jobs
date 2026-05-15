import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

import { registerJobsSettingsCommand } from "../../extensions/jobs/commands.ts";
import { DEFAULT_JOBS_SETTINGS, formatJobsSettings, loadJobsSettings } from "../../extensions/jobs/settings.ts";

function createHarness({ hasUI = true, selected } = {}) {
  const commands = new Map();
  const notifications = [];
  const pi = {
    registerCommand(name, options) {
      commands.set(name, { name, ...options });
    },
  };
  registerJobsSettingsCommand(pi);
  const command = commands.get("jobs-settings");
  assert.ok(command, "jobs-settings command should be registered");
  return {
    async run(cwd) {
      await command.handler("", {
        cwd,
        hasUI,
        ui: {
          async select(_title, choices) {
            return typeof selected === "number" ? choices[selected] : selected;
          },
          notify(message, type) {
            notifications.push({ message, type });
          },
        },
      });
    },
    notifications,
  };
}

test("jobs-settings prints focused defaults without UI", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "pi-jobs-settings-"));
  const h = createHarness({ hasUI: false });
  await h.run(root);

  assert.equal(h.notifications.length, 1);
  assert.equal(h.notifications[0].message, formatJobsSettings(DEFAULT_JOBS_SETTINGS));
});

test("jobs-settings can disable wave guidance and persist it", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "pi-jobs-settings-"));
  const h = createHarness({ selected: 2 });
  await h.run(root);

  const settings = loadJobsSettings(root);
  assert.equal(settings.waveGuidance.enabled, false);
  assert.match(h.notifications[0].message, /wave guidance disabled/);
});

test("jobs-settings can toggle sync-first guidance", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "pi-jobs-settings-"));
  const h = createHarness({ selected: 3 });
  await h.run(root);

  const settings = loadJobsSettings(root);
  assert.equal(settings.syncFirstGuidance, false);
});
