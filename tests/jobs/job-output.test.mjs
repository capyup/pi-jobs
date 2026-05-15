import test from "node:test";
import assert from "node:assert/strict";

import {
  getAssistantVisibleText,
  extractFinalOutput,
  extractDisplayItems,
} from "../../extensions/jobs/job-output.ts";

// ── getAssistantVisibleText ──

test("getAssistantVisibleText joins text parts", () => {
  const message = {
    content: [
      { type: "text", text: "Hello" },
      { type: "text", text: " world" },
    ],
  };
  assert.strictEqual(getAssistantVisibleText(message), "Hello world");
});

test("getAssistantVisibleText filters non-text parts", () => {
  const message = {
    content: [
      { type: "text", text: "A" },
      { type: "toolCall", name: "x", arguments: {} },
      { type: "text", text: "B" },
    ],
  };
  assert.strictEqual(getAssistantVisibleText(message), "AB");
});

test("getAssistantVisibleText returns empty string when no text", () => {
  const message = {
    content: [{ type: "toolCall", name: "x", arguments: {} }],
  };
  assert.strictEqual(getAssistantVisibleText(message), "");
});

test("getAssistantVisibleText returns empty string for empty content", () => {
  assert.strictEqual(getAssistantVisibleText({ content: [] }), "");
});

// ── extractFinalOutput ──

test("extractFinalOutput returns last assistant text", () => {
  const messages = [
    { role: "user", content: [{ type: "text", text: "q" }] },
    { role: "assistant", content: [{ type: "text", text: "first" }] },
    { role: "assistant", content: [{ type: "text", text: "last" }] },
  ];
  assert.strictEqual(extractFinalOutput(messages), "last");
});

test("extractFinalOutput skips non-assistant messages", () => {
  const messages = [
    { role: "assistant", content: [{ type: "text", text: "a" }] },
    { role: "user", content: [{ type: "text", text: "q" }] },
    { role: "assistant", content: [{ type: "text", text: "b" }] },
  ];
  assert.strictEqual(extractFinalOutput(messages), "b");
});

test("extractFinalOutput skips assistant messages with no text", () => {
  const messages = [
    { role: "assistant", content: [{ type: "toolCall", name: "x", arguments: {} }] },
    { role: "assistant", content: [{ type: "text", text: "has text" }] },
  ];
  assert.strictEqual(extractFinalOutput(messages), "has text");
});

test("extractFinalOutput returns empty string when no assistant text", () => {
  const messages = [
    { role: "user", content: [{ type: "text", text: "q" }] },
  ];
  assert.strictEqual(extractFinalOutput(messages), "");
});

test("extractFinalOutput returns empty string for empty array", () => {
  assert.strictEqual(extractFinalOutput([]), "");
});

// ── extractDisplayItems ──

test("extractDisplayItems produces text and toolCall items", () => {
  const messages = [
    {
      role: "assistant",
      content: [
        { type: "text", text: "Hello" },
        { type: "toolCall", name: "read", arguments: { path: "/a" } },
      ],
    },
  ];
  const items = extractDisplayItems(messages);
  assert.strictEqual(items.length, 2);
  assert.deepStrictEqual(items[0], { type: "text", text: "Hello" });
  assert.strictEqual(items[1].type, "toolCall");
  assert.strictEqual(items[1].name, "read");
});

test("extractDisplayItems skips non-assistant messages", () => {
  const messages = [
    { role: "user", content: [{ type: "text", text: "q" }] },
    { role: "assistant", content: [{ type: "text", text: "a" }] },
  ];
  const items = extractDisplayItems(messages);
  assert.strictEqual(items.length, 1);
  assert.strictEqual(items[0].text, "a");
});

test("extractDisplayItems handles multiple assistant messages", () => {
  const messages = [
    { role: "assistant", content: [{ type: "text", text: "a" }] },
    { role: "assistant", content: [{ type: "text", text: "b" }] },
  ];
  const items = extractDisplayItems(messages);
  assert.strictEqual(items.length, 2);
});

test("extractDisplayItems returns empty for no assistant messages", () => {
  const messages = [
    { role: "user", content: [{ type: "text", text: "q" }] },
  ];
  assert.deepStrictEqual(extractDisplayItems(messages), []);
});
