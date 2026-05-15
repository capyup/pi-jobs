import test from "node:test";
import assert from "node:assert/strict";

import { deriveJobFinalStatus, emptyAcceptance, emptyWorkerReport } from "../../extensions/jobs/types.ts";

test("deriveJobFinalStatus accepts runtime success with either acceptance, completed report, or visible terminal", () => {
  assert.equal(
    deriveJobFinalStatus({
      runtime: "success",
      workerReport: "completed",
      acceptance: "passed",
      auditIntegrity: "ok",
    }),
    "success",
  );
});

test("deriveJobFinalStatus maps runtime abort to aborted", () => {
  assert.equal(
    deriveJobFinalStatus({
      runtime: "aborted",
      workerReport: "completed",
      acceptance: "passed",
      auditIntegrity: "ok",
    }),
    "aborted",
  );
});

test("deriveJobFinalStatus rejects runtime, blocking worker, acceptance, audit, and no-signal failures", () => {
  assert.equal(deriveJobFinalStatus({ runtime: "error", workerReport: "completed", acceptance: "passed", auditIntegrity: "ok" }), "error");
  assert.equal(deriveJobFinalStatus({ runtime: "success", workerReport: "blocked", acceptance: "passed", auditIntegrity: "ok" }), "error");
  assert.equal(deriveJobFinalStatus({ runtime: "success", workerReport: "completed", acceptance: "failed", auditIntegrity: "ok" }), "error");
  assert.equal(deriveJobFinalStatus({ runtime: "success", workerReport: "completed", acceptance: "passed", auditIntegrity: "failed" }), "error");
  assert.equal(deriveJobFinalStatus({ runtime: { status: "success", sawTerminalAssistantMessage: false }, workerReport: "not_submitted", acceptance: "skipped", auditIntegrity: "ok" }), "error");
});

test("status derivation accepts structured outcome objects", () => {
  assert.equal(
    deriveJobFinalStatus({
      runtime: { status: "success", exitCode: 0 },
      workerReport: emptyWorkerReport("completed"),
      acceptance: emptyAcceptance("warning"),
      auditIntegrity: "ok",
    }),
    "success",
  );
});
