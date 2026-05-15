import test from "node:test";
import assert from "node:assert/strict";

import {
  isTerminalAssistantMessage,
  resolveJobResultStatus,
} from "../../extensions/jobs/runtime-status.ts";

// ── isTerminalAssistantMessage ──

test("isTerminalAssistantMessage returns true for assistant with stopReason", () => {
  assert.strictEqual(isTerminalAssistantMessage({ role: "assistant", stopReason: "done" }), true);
  assert.strictEqual(isTerminalAssistantMessage({ role: "assistant", stopReason: "endTurn" }), true);
});

test("isTerminalAssistantMessage returns false for toolUse stopReason", () => {
  assert.strictEqual(isTerminalAssistantMessage({ role: "assistant", stopReason: "toolUse" }), false);
});

test("isTerminalAssistantMessage returns false for non-assistant role", () => {
  assert.strictEqual(isTerminalAssistantMessage({ role: "user", stopReason: "done" }), false);
  assert.strictEqual(isTerminalAssistantMessage({ role: "system", stopReason: "done" }), false);
});

test("isTerminalAssistantMessage returns false when no stopReason", () => {
  assert.strictEqual(isTerminalAssistantMessage({ role: "assistant" }), false);
});

// ── resolveJobResultStatus ──

test("resolveJobResultStatus returns aborted when wasAborted", () => {
  assert.strictEqual(
    resolveJobResultStatus({ wasAborted: true, exitCode: 0, stopReason: "done" }),
    "aborted"
  );
});

test("resolveJobResultStatus returns aborted when stopReason is aborted", () => {
  assert.strictEqual(
    resolveJobResultStatus({ wasAborted: false, exitCode: 0, stopReason: "aborted" }),
    "aborted"
  );
});

test("resolveJobResultStatus returns error on terminal assistant with stopReason=error", () => {
  assert.strictEqual(
    resolveJobResultStatus({ wasAborted: false, exitCode: 0, stopReason: "error", sawTerminalAssistantMessage: true }),
    "error"
  );
});

test("resolveJobResultStatus returns success on terminal assistant with good stopReason", () => {
  assert.strictEqual(
    resolveJobResultStatus({ wasAborted: false, exitCode: 0, stopReason: "done", sawTerminalAssistantMessage: true }),
    "success"
  );
});

test("resolveJobResultStatus returns success on exitCode=0 with no error stopReason", () => {
  assert.strictEqual(
    resolveJobResultStatus({ wasAborted: false, exitCode: 0, stopReason: "done" }),
    "success"
  );
});

test("resolveJobResultStatus returns success on exitCode=0 even without stopReason", () => {
  assert.strictEqual(
    resolveJobResultStatus({ wasAborted: false, exitCode: 0 }),
    "success"
  );
});

test("resolveJobResultStatus returns error on non-zero exitCode", () => {
  assert.strictEqual(
    resolveJobResultStatus({ wasAborted: false, exitCode: 1 }),
    "error"
  );
});

test("resolveJobResultStatus returns error on stopReason=error without terminal message", () => {
  assert.strictEqual(
    resolveJobResultStatus({ wasAborted: false, exitCode: 0, stopReason: "error" }),
    "error"
  );
});

test("resolveJobResultStatus returns error on negative exitCode", () => {
  assert.strictEqual(
    resolveJobResultStatus({ wasAborted: false, exitCode: -1 }),
    "error"
  );
});
