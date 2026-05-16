import test from "node:test";
import assert from "node:assert/strict";

import { deriveJobFinalStatus, emptyAcceptance, emptyWorkerReport } from "../../extensions/jobs/types.ts";

test("deriveJobFinalStatus requires runtime success with visible terminal text", () => {
  assert.equal(
    deriveJobFinalStatus({
      runtime: { status: "success", exitCode: 0, sawTerminalAssistantMessage: true },
      workerReport: "not_submitted",
      acceptance: "skipped",
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

test("deriveJobFinalStatus rejects runtime, blocking worker, acceptance, audit, and missing-visible-text failures", () => {
  const visibleRuntime = { status: "success", exitCode: 0, sawTerminalAssistantMessage: true };
  assert.equal(deriveJobFinalStatus({ runtime: "error", workerReport: "completed", acceptance: "passed", auditIntegrity: "ok" }), "error");
  assert.equal(deriveJobFinalStatus({ runtime: visibleRuntime, workerReport: "blocked", acceptance: "passed", auditIntegrity: "ok" }), "error");
  assert.equal(deriveJobFinalStatus({ runtime: visibleRuntime, workerReport: "completed", acceptance: "failed", auditIntegrity: "ok" }), "error");
  assert.equal(deriveJobFinalStatus({ runtime: visibleRuntime, workerReport: "completed", acceptance: "passed", auditIntegrity: "failed" }), "error");
  assert.equal(deriveJobFinalStatus({ runtime: { status: "success", sawTerminalAssistantMessage: false }, workerReport: "completed", acceptance: "passed", auditIntegrity: "ok" }), "error");
  assert.equal(deriveJobFinalStatus({ runtime: "success", workerReport: "completed", acceptance: "passed", auditIntegrity: "ok" }), "error");
});

test("status derivation accepts structured outcome objects with visible text", () => {
  assert.equal(
    deriveJobFinalStatus({
      runtime: { status: "success", exitCode: 0, sawTerminalAssistantMessage: true },
      workerReport: emptyWorkerReport("completed"),
      acceptance: emptyAcceptance("warning"),
      auditIntegrity: "ok",
    }),
    "success",
  );
});
