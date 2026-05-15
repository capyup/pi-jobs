import test from "node:test";
import assert from "node:assert/strict";

import jobWorkerRuntime from "../../extensions/jobs/job-worker-runtime.ts";

const originalChildType = process.env.PI_CHILD_TYPE;
const originalReportPath = process.env.PI_JOB_REPORT_PATH;

test("jobWorkerRuntime is a function", () => {
  assert.strictEqual(typeof jobWorkerRuntime, "function");
});

test("jobWorkerRuntime registers job_report tool when env is set", () => {
  process.env.PI_CHILD_TYPE = "job-worker";
  process.env.PI_JOB_REPORT_PATH = "/tmp/job-report.json";
  const calls = [];
  const mockPi = {
    registerTool: (config) => calls.push(config),
  };
  jobWorkerRuntime(mockPi);
  process.env.PI_CHILD_TYPE = originalChildType;
  process.env.PI_JOB_REPORT_PATH = originalReportPath;
  assert.strictEqual(calls.length, 1);
  assert.strictEqual(calls[0].name, "job_report");
});

test("jobWorkerRuntime passes tool config with correct properties", () => {
  process.env.PI_CHILD_TYPE = "job-worker";
  process.env.PI_JOB_REPORT_PATH = "/tmp/job-report.json";
  const calls = [];
  const mockPi = {
    registerTool: (config) => calls.push(config),
  };
  jobWorkerRuntime(mockPi);
  process.env.PI_CHILD_TYPE = originalChildType;
  process.env.PI_JOB_REPORT_PATH = originalReportPath;
  const tool = calls[0];
  assert.ok(tool.description.length > 0);
  assert.ok(typeof tool.execute === "function");
  assert.ok(tool.parameters);
});

test("jobWorkerRuntime does nothing when PI_CHILD_TYPE is not job-worker", () => {
  delete process.env.PI_CHILD_TYPE;
  delete process.env.PI_JOB_REPORT_PATH;
  const calls = [];
  const mockPi = {
    registerTool: (config) => calls.push(config),
  };
  jobWorkerRuntime(mockPi);
  assert.strictEqual(calls.length, 0);
});
