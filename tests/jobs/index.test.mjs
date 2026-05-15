import test from "node:test";
import assert from "node:assert/strict";

// buildStartingText, modelId, captureThinkingLevel are not exported from index.ts.
// We test the exported functions from jobs-plan.ts that are wired by index.ts.
import {
  validateJobsPlanInput,
  expandJobsPlan,
  buildPlanStartingText,
  MAX_PLAN_ROWS,
  MAX_PLAN_PROMPT_TEMPLATE_BYTES,
  MAX_PLAN_TOTAL_INPUT_BYTES,
} from "../../extensions/jobs/jobs-plan.ts";

// ── validateJobsPlanInput ──

test("validateJobsPlanInput accepts minimal valid input", () => {
  assert.doesNotThrow(() =>
    validateJobsPlanInput({ batchName: "x", matrix: [{ id: "a" }], promptTemplate: "p" })
  );
});

test("validateJobsPlanInput throws when params is not an object", () => {
  assert.throws(() => validateJobsPlanInput(null), /must be an object/);
  assert.throws(() => validateJobsPlanInput("string"), /must be an object/);
});

test("validateJobsPlanInput throws on unknown top-level key", () => {
  assert.throws(
    () => validateJobsPlanInput({ batchName: "x", matrix: [{ id: "a" }], promptTemplate: "p", unknownKey: true }),
    /unknownKey is not supported/
  );
});

test("validateJobsPlanInput throws when batchName is missing", () => {
  assert.throws(
    () => validateJobsPlanInput({ matrix: [{ id: "a" }], promptTemplate: "p" }),
    /batchName must be a non-empty string/
  );
});

test("validateJobsPlanInput throws when promptTemplate is missing", () => {
  assert.throws(
    () => validateJobsPlanInput({ batchName: "x", matrix: [{ id: "a" }] }),
    /promptTemplate must be a non-empty string/
  );
});

test("validateJobsPlanInput throws when promptTemplate exceeds max bytes", () => {
  const hugeTemplate = "x".repeat(MAX_PLAN_PROMPT_TEMPLATE_BYTES + 1);
  assert.throws(
    () => validateJobsPlanInput({ batchName: "x", matrix: [{ id: "a" }], promptTemplate: hugeTemplate }),
    /exceeds.*bytes/
  );
});

test("validateJobsPlanInput throws when matrix is empty", () => {
  assert.throws(
    () => validateJobsPlanInput({ batchName: "x", matrix: [], promptTemplate: "p" }),
    /matrix must be a non-empty array/
  );
});

test("validateJobsPlanInput throws when matrix exceeds max rows", () => {
  const matrix = Array.from({ length: MAX_PLAN_ROWS + 1 }, (_, i) => ({ id: `r${i}` }));
  assert.throws(
    () => validateJobsPlanInput({ batchName: "x", matrix, promptTemplate: "p" }),
    /max is/
  );
});

test("validateJobsPlanInput throws on row with unknown key", () => {
  assert.throws(
    () => validateJobsPlanInput({ batchName: "x", matrix: [{ id: "a", unknown: 1 }], promptTemplate: "p" }),
    /unknown is not supported/
  );
});

test("validateJobsPlanInput throws when row id is missing", () => {
  assert.throws(
    () => validateJobsPlanInput({ batchName: "x", matrix: [{}], promptTemplate: "p" }),
    /id must be a non-empty string/
  );
});

test("validateJobsPlanInput throws when row id is unsafe", () => {
  assert.throws(
    () => validateJobsPlanInput({ batchName: "x", matrix: [{ id: "../bad" }], promptTemplate: "p" }),
    /must use only letters/
  );
});

test("validateJobsPlanInput throws on duplicate row ids", () => {
  assert.throws(
    () => validateJobsPlanInput({ batchName: "x", matrix: [{ id: "dup" }, { id: "dup" }], promptTemplate: "p" }),
    /duplicate id: dup/
  );
});

test("validateJobsPlanInput throws when row name is empty", () => {
  assert.throws(
    () => validateJobsPlanInput({ batchName: "x", matrix: [{ id: "a", name: "" }], promptTemplate: "p" }),
    /name must be a non-empty string/
  );
});

test("validateJobsPlanInput throws when row cwd is not string", () => {
  assert.throws(
    () => validateJobsPlanInput({ batchName: "x", matrix: [{ id: "a", cwd: 123 }], promptTemplate: "p" }),
    /cwd must be a string/
  );
});

test("validateJobsPlanInput throws when row vars is not an object", () => {
  assert.throws(
    () => validateJobsPlanInput({ batchName: "x", matrix: [{ id: "a", vars: "bad" }], promptTemplate: "p" }),
    /vars must be an object/
  );
});

test("validateJobsPlanInput throws when row vars value is not string or string array", () => {
  assert.throws(
    () => validateJobsPlanInput({ batchName: "x", matrix: [{ id: "a", vars: { k: 123 } }], promptTemplate: "p" }),
    /must be a string or array of strings/
  );
});

test("validateJobsPlanInput throws when concurrency is invalid", () => {
  assert.throws(
    () => validateJobsPlanInput({ batchName: "x", matrix: [{ id: "a" }], promptTemplate: "p", concurrency: 0 }),
    /concurrency must be a positive integer/
  );
});

test("validateJobsPlanInput throws on unknown synthesis key", () => {
  assert.throws(
    () => validateJobsPlanInput({ batchName: "x", matrix: [{ id: "a" }], promptTemplate: "p", synthesis: { bad: 1 } }),
    /bad is not supported/
  );
});

test("validateJobsPlanInput throws on invalid synthesis mode", () => {
  assert.throws(
    () => validateJobsPlanInput({ batchName: "x", matrix: [{ id: "a" }], promptTemplate: "p", synthesis: { mode: "bad" } }),
    /mode must be 'parent' or 'report-only'/
  );
});

test("validateJobsPlanInput throws when total input exceeds max bytes", () => {
  const hugeVars = {};
  for (let i = 0; i < 1000; i++) hugeVars[`k${i}`] = "x".repeat(100);
  assert.throws(
    () => validateJobsPlanInput({ batchName: "x", matrix: [{ id: "a", vars: hugeVars }], promptTemplate: "p" }),
    /input is.*bytes/
  );
});

// ── expandJobsPlan ──

test("expandJobsPlan produces correct jobs from template", () => {
  const result = expandJobsPlan({
    batchName: "chapters",
    matrix: [
      { id: "ch01", vars: { chapter: "01", file: "ch01.md" } },
      { id: "ch02", vars: { chapter: "02", file: "ch02.md" } },
    ],
    promptTemplate: "Process chapter {{chapter}}: {{file}}",
  });
  assert.strictEqual(result.params.jobs.length, 2);
  assert.strictEqual(result.params.jobs[0].name, "chapters ch01");
  assert.strictEqual(result.params.jobs[0].prompt, "Process chapter 01: ch01.md");
  assert.strictEqual(result.params.jobs[1].name, "chapters ch02");
  assert.strictEqual(result.params.jobs[1].prompt, "Process chapter 02: ch02.md");
});

test("expandJobsPlan uses custom nameTemplate with row vars", () => {
  const result = expandJobsPlan({
    batchName: "batch",
    matrix: [{ id: "a", vars: { kind: "worker" } }],
    promptTemplate: "p",
    nameTemplate: "{{kind}}-{{id}}",
  });
  assert.strictEqual(result.jobNames[0], "worker-a");
});

test("expandJobsPlan uses row name override", () => {
  const result = expandJobsPlan({
    batchName: "batch",
    matrix: [{ id: "a", name: "custom" }],
    promptTemplate: "p",
  });
  assert.strictEqual(result.jobNames[0], "custom");
});

test("expandJobsPlan resolves cwdTemplate", () => {
  const result = expandJobsPlan({
    batchName: "batch",
    matrix: [{ id: "a" }],
    promptTemplate: "p",
    cwdTemplate: "/tmp/{{id}}",
  });
  assert.strictEqual(result.params.jobs[0].cwd, "/tmp/a");
});

test("expandJobsPlan prefers row cwd over template", () => {
  const result = expandJobsPlan({
    batchName: "batch",
    matrix: [{ id: "a", cwd: "/override" }],
    promptTemplate: "p",
    cwdTemplate: "/tmp/{{id}}",
  });
  assert.strictEqual(result.params.jobs[0].cwd, "/override");
});

test("expandJobsPlan expands acceptance template with array splat", () => {
  const result = expandJobsPlan({
    batchName: "batch",
    matrix: [{ id: "a", vars: { paths: ["/a", "/b"] } }],
    promptTemplate: "p",
    acceptanceTemplate: { allowedWritePaths: ["{{paths}}"] },
  });
  assert.deepStrictEqual(result.params.jobs[0].acceptance.allowedWritePaths, ["/a", "/b"]);
});

test("expandJobsPlan expands acceptance template with string substitution", () => {
  const result = expandJobsPlan({
    batchName: "batch",
    matrix: [{ id: "a", vars: { dir: "src" } }],
    promptTemplate: "p",
    acceptanceTemplate: { allowedWritePaths: ["{{dir}}/**"] },
  });
  assert.deepStrictEqual(result.params.jobs[0].acceptance.allowedWritePaths, ["src/**"]);
});

test("expandJobsPlan includes metadata from template", () => {
  const result = expandJobsPlan({
    batchName: "batch",
    matrix: [{ id: "a", vars: { chapter: "05" } }],
    promptTemplate: "p",
    metadataTemplate: { chapter: "{{chapter}}" },
  });
  assert.strictEqual(result.params.jobs[0].metadata.chapter, "05");
  assert.strictEqual(result.params.jobs[0].metadata["jobs_plan.row_id"], "a");
  assert.strictEqual(result.params.jobs[0].metadata["jobs_plan.batch_name"], "batch");
});

test("expandJobsPlan passes through retry/throttle/acceptanceDefaults", () => {
  const retry = { maxAttempts: 2 };
  const throttle = { enabled: true };
  const result = expandJobsPlan({
    batchName: "batch",
    matrix: [{ id: "a" }],
    promptTemplate: "p",
    retry,
    throttle,
    acceptanceDefaults: { requiredPaths: ["out.md"] },
  });
  assert.strictEqual(result.params.retry, retry);
  assert.strictEqual(result.params.throttle, throttle);
  assert.deepStrictEqual(result.params.acceptanceDefaults.requiredPaths, ["out.md"]);
});

test("expandJobsPlan throws on unknown template variable", () => {
  assert.throws(
    () => expandJobsPlan({
      batchName: "batch",
      matrix: [{ id: "a" }],
      promptTemplate: "p {{unknown}}",
    }),
    /unknown variable/,
  );
});

// ── buildPlanStartingText ──

test("buildPlanStartingText includes batch name and count", () => {
  const text = buildPlanStartingText(
    { batchName: "chapters", matrix: [{ id: "a" }, { id: "b" }], promptTemplate: "p" },
    { params: { jobs: [] }, jobNames: [], rowIds: ["a", "b"] },
    "/tmp",
  );
  assert.ok(text.includes("chapters"));
  assert.ok(text.includes("2"));
});
