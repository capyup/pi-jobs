import test from "node:test";
import assert from "node:assert/strict";

import { buildWorkerPrompt, buildWorkerSystemPrompt, validateJobReport } from "../../extensions/jobs/worker-protocol.ts";

const validReport = {
  schemaVersion: 1,
  jobId: "t001",
  attemptId: "t001-a1",
  status: "completed",
  summary: "Completed the job.",
  deliverables: [{ path: "out.md", kind: "file", description: "Output" }],
  evidence: [{ kind: "text", value: "Verified" }],
  internalRetries: [{ reason: "temporary command failure", action: "reran command", outcome: "recovered" }],
  userActionRequired: null,
  error: null,
};

test("validateJobReport accepts a valid structured report", () => {
  const result = validateJobReport(validReport, { jobId: "t001", attemptId: "t001-a1" });
  assert.equal(result.ok, true);
  assert.equal(result.report.status, "completed");
  assert.equal(result.report.deliverables[0].path, "out.md");
});

test("validateJobReport defaults missing deliverables and evidence to empty arrays", () => {
  const { deliverables, evidence, ...minimalReport } = validReport;
  const result = validateJobReport(minimalReport, { jobId: "t001", attemptId: "t001-a1" });
  assert.equal(result.ok, true);
  assert.deepEqual(result.report.deliverables, []);
  assert.deepEqual(result.report.evidence, []);
});

test("validateJobReport rejects wrong job id and malformed evidence", () => {
  const result = validateJobReport({ ...validReport, jobId: "wrong", evidence: [{ kind: "file", value: "" }] }, { jobId: "t001" });
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /jobId must be t001/);
  assert.match(result.errors.join("\n"), /evidence\[0\]\.value/);
});

test("worker prompts require visible free-text completion and keep reports optional", () => {
  const system = buildWorkerSystemPrompt();
  assert.match(system, /short visible plain-text assistant message/i);
  assert.match(system, /no required template or fixed set of sections/i);
  assert.match(system, /job_report/);
  assert.match(system, /optional compatibility\/audit/i);
  assert.match(system, /does not replace the required visible final text/i);
  assert.match(system, /hidden thinking block/i);
  assert.doesNotMatch(system, /ONLY completion protocol/i);

  const prompt = buildWorkerPrompt({
    job: { id: "t001", name: "demo", prompt: "Do it", cwd: "/tmp" },
    attemptId: "t001-a1",
    workerLogPath: "/tmp/worker.md",
    reportPath: "/tmp/job-report.json",
  });
  assert.match(prompt, /Worker log path: \/tmp\/worker\.md/);
  assert.match(prompt, /Job report path: \/tmp\/job-report\.json/);
  assert.match(prompt, /short visible plain-text assistant message/i);
  assert.match(prompt, /Do not use a fixed required format/i);
  assert.match(prompt, /optional compatibility\/audit artifacts only/i);
  assert.doesNotMatch(prompt, /"jobId": "t001"/);
  assert.doesNotMatch(prompt, /deliverables/);
  assert.doesNotMatch(prompt, /evidence/);
});
