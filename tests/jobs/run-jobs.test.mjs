import test from "node:test";
import assert from "node:assert/strict";
import * as path from "node:path";

import {
  mergeAcceptanceContracts,
  validateJobsToolParams,
  validateJobsFanoutUsage,
  enforceInlineJobsLimit,
  inlineJobsByteSize,
  normalizeJobsRun,
  buildResultText,
  DEFAULT_MAX_JOBS,
  MAX_INLINE_JOBS,
  MAX_INLINE_PROMPT_BYTES,
} from "../../extensions/jobs/run-jobs.ts";
import {
  DEFAULT_JOB_TIMEOUT_MS,
  MAX_JOB_TIMEOUT_MS,
  MIN_JOB_TIMEOUT_MS,
  normalizeJobTimeoutMs,
} from "../../extensions/jobs/timeout.ts";

// ── timeout normalization ──

test("normalizeJobTimeoutMs defaults invalid and missing values", () => {
  assert.equal(normalizeJobTimeoutMs(undefined), DEFAULT_JOB_TIMEOUT_MS);
  assert.equal(normalizeJobTimeoutMs(null), DEFAULT_JOB_TIMEOUT_MS);
  assert.equal(normalizeJobTimeoutMs("60000"), DEFAULT_JOB_TIMEOUT_MS);
  assert.equal(normalizeJobTimeoutMs(Number.NaN), DEFAULT_JOB_TIMEOUT_MS);
  assert.equal(normalizeJobTimeoutMs(Number.POSITIVE_INFINITY), DEFAULT_JOB_TIMEOUT_MS);
});

test("normalizeJobTimeoutMs clamps min and max values", () => {
  assert.equal(normalizeJobTimeoutMs(1), MIN_JOB_TIMEOUT_MS);
  assert.equal(normalizeJobTimeoutMs(MIN_JOB_TIMEOUT_MS - 1), MIN_JOB_TIMEOUT_MS);
  assert.equal(normalizeJobTimeoutMs(MAX_JOB_TIMEOUT_MS + 1), MAX_JOB_TIMEOUT_MS);
  assert.equal(normalizeJobTimeoutMs(60_000), 60_000);
});

// ── mergeAcceptanceContracts ──

test("mergeAcceptanceContracts returns undefined when both inputs are undefined", () => {
  assert.strictEqual(mergeAcceptanceContracts(undefined, undefined), undefined);
});

test("mergeAcceptanceContracts returns job contract when defaults are undefined", () => {
  const job = { requiredPaths: ["a.md"] };
  const result = mergeAcceptanceContracts(undefined, job);
  assert.deepStrictEqual(result.requiredPaths, ["a.md"]);
});

test("mergeAcceptanceContracts merges arrays from both contracts", () => {
  const defaults = { requiredPaths: ["a.md"], forbiddenPaths: ["b.md"] };
  const job = { requiredPaths: ["c.md"], allowedWritePaths: ["d/"] };
  const result = mergeAcceptanceContracts(defaults, job);
  assert.deepStrictEqual(result.requiredPaths, ["a.md", "c.md"]);
  assert.deepStrictEqual(result.forbiddenPaths, ["b.md"]);
  assert.deepStrictEqual(result.allowedWritePaths, ["d/"]);
});

// ── validateJobsToolParams ──

test("validateJobsToolParams accepts valid params", () => {
  assert.doesNotThrow(() =>
    validateJobsToolParams({ jobs: [{ name: "x", prompt: "y" }] })
  );
});

test("validateJobsToolParams throws when params is not an object", () => {
  assert.throws(() => validateJobsToolParams(null), /Jobs params must be an object/);
  assert.throws(() => validateJobsToolParams("string"), /Jobs params must be an object/);
  assert.throws(() => validateJobsToolParams([]), /Jobs params must be an object/);
});

test("validateJobsToolParams throws when jobs is missing", () => {
  assert.throws(() => validateJobsToolParams({}), /At least one job is required/);
});

test("validateJobsToolParams throws when jobs is empty", () => {
  assert.throws(() => validateJobsToolParams({ jobs: [] }), /At least one job is required/);
});

test("validateJobsToolParams throws when too many jobs", () => {
  const jobs = Array.from({ length: DEFAULT_MAX_JOBS + 1 }, (_, i) => ({ name: `j${i}`, prompt: "p" }));
  assert.throws(() => validateJobsToolParams({ jobs }), /Too many jobs/);
});

test("validateJobsToolParams throws when job name is missing or empty", () => {
  assert.throws(
    () => validateJobsToolParams({ jobs: [{ name: "", prompt: "p" }] }),
    /jobs\[0\]\.name must be a non-empty string/
  );
  assert.throws(
    () => validateJobsToolParams({ jobs: [{ prompt: "p" }] }),
    /jobs\[0\]\.name must be a non-empty string/
  );
});

test("validateJobsToolParams throws when job prompt is missing or empty", () => {
  assert.throws(
    () => validateJobsToolParams({ jobs: [{ name: "n", prompt: "" }] }),
    /jobs\[0\]\.prompt must be a non-empty string/
  );
  assert.throws(
    () => validateJobsToolParams({ jobs: [{ name: "n" }] }),
    /jobs\[0\]\.prompt must be a non-empty string/
  );
});

test("validateJobsToolParams throws when cwd is not a string", () => {
  assert.throws(
    () => validateJobsToolParams({ jobs: [{ name: "n", prompt: "p", cwd: 123 }] }),
    /jobs\[0\]\.cwd must be a string/
  );
});

test("validateJobsToolParams throws when id is not a string", () => {
  assert.throws(
    () => validateJobsToolParams({ jobs: [{ name: "n", prompt: "p", id: 123 }] }),
    /jobs\[0\]\.id must be a non-empty string/
  );
});

test("validateJobsToolParams throws when id is empty", () => {
  assert.throws(
    () => validateJobsToolParams({ jobs: [{ name: "n", prompt: "p", id: "" }] }),
    /jobs\[0\]\.id must be a non-empty string/
  );
});

test("validateJobsToolParams throws when id contains path traversal", () => {
  assert.throws(
    () => validateJobsToolParams({ jobs: [{ name: "n", prompt: "p", id: "../foo" }] }),
    /must not contain path traversal/
  );
  assert.throws(
    () => validateJobsToolParams({ jobs: [{ name: "n", prompt: "p", id: ".." }] }),
    /must not contain path traversal/
  );
});

test("validateJobsToolParams throws when id is just a dot", () => {
  assert.throws(
    () => validateJobsToolParams({ jobs: [{ name: "n", prompt: "p", id: "." }] }),
    /must use only letters/
  );
});

test("validateJobsToolParams throws when concurrency is invalid", () => {
  assert.throws(
    () => validateJobsToolParams({ jobs: [{ name: "n", prompt: "p" }], concurrency: 0 }),
    /concurrency must be a positive integer/
  );
  assert.throws(
    () => validateJobsToolParams({ jobs: [{ name: "n", prompt: "p" }], concurrency: -1 }),
    /concurrency must be a positive integer/
  );
  assert.throws(
    () => validateJobsToolParams({ jobs: [{ name: "n", prompt: "p" }], concurrency: 1.5 }),
    /concurrency must be a positive integer/
  );
});

test("validateJobsToolParams accepts valid custom maxJobs", () => {
  assert.doesNotThrow(() =>
    validateJobsToolParams({ jobs: [{ name: "n", prompt: "p" }] }, 1)
  );
});

// ── validateJobsFanoutUsage ──

test("validateJobsFanoutUsage passes for normal single job", () => {
  assert.doesNotThrow(() =>
    validateJobsFanoutUsage({ jobs: [{ name: "review", prompt: "review this file" }] })
  );
});

test("validateJobsFanoutUsage passes for multiple jobs", () => {
  assert.doesNotThrow(() =>
    validateJobsFanoutUsage({
      jobs: [
        { name: "a", prompt: "p" },
        { name: "b", prompt: "p" },
      ],
    })
  );
});

test("validateJobsFanoutUsage throws for meta-fanout with explicit count", () => {
  assert.throws(
    () =>
      validateJobsFanoutUsage({
        jobs: [{ name: "coordinator", prompt: "launch 5 agents to review code" }],
      }),
    /appears to need 5 supervised workers/
  );
});

test("validateJobsFanoutUsage throws for meta-fanout without explicit count", () => {
  assert.throws(
    () =>
      validateJobsFanoutUsage({
        jobs: [{ name: "parallel review", prompt: "spawn parallel workers for auth, db, and tests" }],
      }),
    /appears to need multiple supervised workers/
  );
});

test("validateJobsFanoutUsage throws for single job with concurrency > 1", () => {
  assert.throws(
    () =>
      validateJobsFanoutUsage({
        jobs: [{ name: "x", prompt: "p" }],
        concurrency: 3,
      }),
    /appears to need 3 supervised workers/
  );
});

test("validateJobsFanoutUsage guidance mentions jobs_plan", () => {
  let message = "";
  try {
    validateJobsFanoutUsage({
      jobs: [{ name: "x", prompt: "launch 3 agents" }],
    });
  } catch (error) {
    message = error.message;
  }
  assert.ok(message.includes("jobs_plan"), "error should mention jobs_plan");
  assert.ok(message.includes("Do not create one coordinator"), "error should discourage meta-jobs");
});

// ── inlineJobsByteSize ──

test("inlineJobsByteSize sums prompt and name bytes", () => {
  const params = {
    jobs: [
      { name: "hello", prompt: "world" },
      { name: "foo", prompt: "bar" },
    ],
  };
  const size = inlineJobsByteSize(params);
  assert.strictEqual(size, Buffer.byteLength("hello", "utf-8") + Buffer.byteLength("world", "utf-8") + Buffer.byteLength("foo", "utf-8") + Buffer.byteLength("bar", "utf-8"));
});

test("inlineJobsByteSize handles undefined fields", () => {
  const params = { jobs: [{ name: "x" }] };
  assert.strictEqual(inlineJobsByteSize(params), Buffer.byteLength("x", "utf-8"));
});

// ── enforceInlineJobsLimit ──

test("enforceInlineJobsLimit passes within limits", () => {
  const params = {
    jobs: [
      { name: "a", prompt: "b" },
      { name: "c", prompt: "d" },
    ],
  };
  assert.doesNotThrow(() => enforceInlineJobsLimit(params));
});

test("enforceInlineJobsLimit throws when too many jobs", () => {
  const params = {
    jobs: Array.from({ length: MAX_INLINE_JOBS + 1 }, (_, i) => ({ name: `j${i}`, prompt: "p" })),
  };
  assert.throws(() => enforceInlineJobsLimit(params), /Inline jobs/);
});

test("enforceInlineJobsLimit throws when prompt bytes exceed limit", () => {
  const bigPrompt = "x".repeat(MAX_INLINE_PROMPT_BYTES);
  const params = {
    jobs: [{ name: "n", prompt: bigPrompt }],
  };
  assert.throws(() => enforceInlineJobsLimit(params), /Inline jobs/);
});

test("enforceInlineJobsLimit error mentions jobs_plan", () => {
  let message = "";
  try {
    enforceInlineJobsLimit({ jobs: Array.from({ length: 10 }, (_, i) => ({ name: `j${i}`, prompt: "p" })) });
  } catch (error) {
    message = error.message;
  }
  assert.ok(message.includes("jobs_plan"));
});

// ── normalizeJobsRun ──

test("normalizeJobsRun generates ids when omitted", () => {
  const result = normalizeJobsRun({ jobs: [{ name: "a", prompt: "p" }] }, "/tmp");
  assert.strictEqual(result.jobs.length, 1);
  assert.ok(result.jobs[0].id.length > 0, "id should be generated");
});

test("normalizeJobsRun preserves provided ids", () => {
  const result = normalizeJobsRun({ jobs: [{ name: "a", prompt: "p", id: "my-id" }] }, "/tmp");
  assert.strictEqual(result.jobs[0].id, "my-id");
});

test("normalizeJobsRun resolves cwd against defaultCwd", () => {
  const result = normalizeJobsRun({ jobs: [{ name: "a", prompt: "p", cwd: "sub" }] }, "/tmp");
  assert.strictEqual(result.jobs[0].cwd, path.resolve("/tmp", "sub"));
});

test("normalizeJobsRun uses defaultCwd when cwd is omitted", () => {
  const result = normalizeJobsRun({ jobs: [{ name: "a", prompt: "p" }] }, "/tmp");
  assert.strictEqual(result.jobs[0].cwd, "/tmp");
});

test("normalizeJobsRun merges acceptance contracts", () => {
  const result = normalizeJobsRun({
    jobs: [{ name: "a", prompt: "p", acceptance: { requiredPaths: ["a.md"] } }],
    acceptanceDefaults: { requiredPaths: ["b.md"] },
  }, "/tmp");
  assert.deepStrictEqual(result.jobs[0].acceptance.requiredPaths, ["b.md", "a.md"]);
});

test("normalizeJobsRun throws on duplicate ids", () => {
  assert.throws(
    () => normalizeJobsRun({ jobs: [{ name: "a", prompt: "p", id: "dup" }, { name: "b", prompt: "p", id: "dup" }] }, "/tmp"),
    /Duplicate job id: dup/
  );
});

test("normalizeJobsRun trims name and id", () => {
  const result = normalizeJobsRun({ jobs: [{ name: "  spaced  ", prompt: "p", id: "  id  " }] }, "/tmp");
  assert.strictEqual(result.jobs[0].name, "spaced");
  assert.strictEqual(result.jobs[0].id, "id");
});

test("normalizeJobsRun computes effective concurrency", () => {
  const result = normalizeJobsRun({ jobs: [{ name: "a", prompt: "p" }, { name: "b", prompt: "p" }] }, "/tmp");
  assert.strictEqual(result.requestedConcurrency, 2);
  assert.strictEqual(result.effectiveConcurrency, 2);
});

test("normalizeJobsRun respects explicit concurrency cap", () => {
  const result = normalizeJobsRun({ jobs: [{ name: "a", prompt: "p" }, { name: "b", prompt: "p" }], concurrency: 1 }, "/tmp");
  assert.strictEqual(result.requestedConcurrency, 1);
  assert.strictEqual(result.effectiveConcurrency, 1);
});

test("normalizeJobsRun clamps concurrency to job count", () => {
  const result = normalizeJobsRun({ jobs: [{ name: "a", prompt: "p" }], concurrency: 5 }, "/tmp");
  assert.strictEqual(result.effectiveConcurrency, 1);
});

test("normalizeJobsRun assigns finite normalized per-job timeouts", () => {
  const result = normalizeJobsRun({
    jobs: [
      { name: "default", prompt: "p" },
      { name: "small", prompt: "p", timeoutMs: 1 },
      { name: "large", prompt: "p", timeoutMs: 999_999_999 },
      { name: "invalid", prompt: "p", timeoutMs: "oops" },
    ],
  }, "/tmp");
  assert.deepEqual(result.jobs.map((job) => job.timeoutMs), [
    DEFAULT_JOB_TIMEOUT_MS,
    MIN_JOB_TIMEOUT_MS,
    MAX_JOB_TIMEOUT_MS,
    DEFAULT_JOB_TIMEOUT_MS,
  ]);
});

// ── buildResultText ──

function firstResultHeading(text) {
  return text.split("\n")[0];
}

function assertResultHeadingHasNoGlyphCounts(text) {
  assert.doesNotMatch(firstResultHeading(text), /[✓✗⊘◐]/);
}

test("buildResultText for success batch", () => {
  const text = buildResultText({ batchId: "b1", batchDir: "/tmp/b1", status: "success", total: 3, success: 3, error: 0, aborted: 0 });
  assert.strictEqual(firstResultHeading(text), "JOBS done · 3/3 jobs");
  assertResultHeadingHasNoGlyphCounts(text);
  assert.ok(text.includes("/jobs-ui b1"));
});

test("buildResultText uses singular job label for one success", () => {
  const text = buildResultText({ batchId: "b1", batchDir: "/tmp/b1", status: "success", total: 1, success: 1, error: 0, aborted: 0 });
  assert.strictEqual(firstResultHeading(text), "JOBS done · 1/1 job");
  assertResultHeadingHasNoGlyphCounts(text);
});

test("buildResultText for error batch", () => {
  const text = buildResultText({ batchId: "b2", batchDir: "/tmp/b2", status: "error", total: 3, success: 1, error: 1, aborted: 1 });
  assert.strictEqual(firstResultHeading(text), "JOBS error · 1 failed / 3");
  assertResultHeadingHasNoGlyphCounts(text);
  assert.ok(text.includes("rerun failed: /jobs-ui rerun failed b2"));
});

test("buildResultText for aborted batch", () => {
  const text = buildResultText({ batchId: "b6", batchDir: "/tmp/b6", status: "aborted", total: 3, success: 0, error: 0, aborted: 3 });
  assert.strictEqual(firstResultHeading(text), "JOBS aborted · 3 aborted / 3");
  assertResultHeadingHasNoGlyphCounts(text);
});

test("buildResultText for incomplete batch", () => {
  const text = buildResultText({ batchId: "b3", batchDir: "/tmp/b3", status: "incomplete", total: 2, success: 0, error: 0, aborted: 0 });
  assert.strictEqual(firstResultHeading(text), "JOBS incomplete · 0 completed / 2");
  assertResultHeadingHasNoGlyphCounts(text);
});

test("buildResultText includes elapsed time when provided", () => {
  const text = buildResultText({ batchId: "b4", batchDir: "/tmp/b4", status: "success", total: 1, success: 1, error: 0, aborted: 0, elapsed: "12s" });
  assert.strictEqual(firstResultHeading(text), "JOBS done · 1/1 job · 12s");
  assertResultHeadingHasNoGlyphCounts(text);
});

test("buildResultText includes summary path when provided", () => {
  const text = buildResultText({ batchId: "b5", batchDir: "/tmp/b5", status: "success", total: 1, success: 1, error: 0, aborted: 0, summaryPath: "/tmp/b5/summary.md" });
  assertResultHeadingHasNoGlyphCounts(text);
  assert.ok(text.includes("summary: /tmp/b5/summary.md"));
});
