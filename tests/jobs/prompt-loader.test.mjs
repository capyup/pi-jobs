import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { pathToFileURL } from "node:url";

import { loadToolPrompt, renderPromptFile, renderTemplate } from "../../extensions/jobs/prompt-loader.ts";

test("renderTemplate substitutes known placeholders and leaves template examples intact", () => {
  const text = renderTemplate("Hello {{ name }}; keep {{key}}", { name: "worker" });
  assert.equal(text, "Hello worker; keep {{key}}");
});

test("renderPromptFile reads from disk on each call", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "pi-prompts-"));
  const baseUrl = pathToFileURL(`${root}${path.sep}`);
  const promptPath = path.join(root, "dynamic.md");

  await fs.writeFile(promptPath, "first {{value}}", "utf-8");
  assert.equal(renderPromptFile("dynamic.md", { value: "read" }, baseUrl), "first read");

  await fs.writeFile(promptPath, "second {{value}}", "utf-8");
  assert.equal(renderPromptFile("dynamic.md", { value: "read" }, baseUrl), "second read");
});

test("loadToolPrompt renders tool prompt JSON from prompt files", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "pi-tool-prompts-"));
  await fs.mkdir(path.join(root, "tools"));
  const baseUrl = pathToFileURL(`${root}${path.sep}`);
  await fs.writeFile(path.join(root, "tools", "demo.json"), JSON.stringify({
    description: "Demo {{name}}",
    promptSnippet: "Snippet {{name}}",
    promptGuidelines: ["Report policy: {{reportPolicy}}.", "Keep {{key}} examples"],
  }), "utf-8");

  const prompt = loadToolPrompt("demo", { name: "job", reportPolicy: "optional" }, baseUrl);
  assert.equal(prompt.description, "Demo job");
  assert.equal(prompt.promptSnippet, "Snippet job");
  assert.deepEqual(prompt.promptGuidelines, ["Report policy: optional.", "Keep {{key}} examples"]);
});
