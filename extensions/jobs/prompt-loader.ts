import * as fs from "node:fs";

export type PromptVariables = Record<string, string | number | boolean | null | undefined>;

export interface ToolPromptText {
  description: string;
  promptSnippet: string;
  promptGuidelines: string[];
}

const PROMPTS_URL = new URL("./prompts/", import.meta.url);

export function renderTemplate(template: string, variables: PromptVariables = {}): string {
  return template.replace(/\{\{\s*([A-Za-z0-9_.-]+)\s*\}\}/g, (match, key) => {
    if (!Object.prototype.hasOwnProperty.call(variables, key)) return match;
    const value = variables[key];
    return value == null ? "" : String(value);
  });
}

export function readPromptFile(relativePath: string, baseUrl: URL = PROMPTS_URL): string {
  if (relativePath.startsWith("/") || relativePath.includes("..")) {
    throw new Error(`Invalid prompt path: ${relativePath}`);
  }
  return fs.readFileSync(new URL(relativePath, baseUrl), "utf-8").replace(/\r\n/g, "\n").trimEnd();
}

export function renderPromptFile(relativePath: string, variables: PromptVariables = {}, baseUrl?: URL): string {
  return renderTemplate(readPromptFile(relativePath, baseUrl), variables);
}

export function loadToolPrompt(toolName: string, variables: PromptVariables = {}, baseUrl?: URL): ToolPromptText {
  const raw = renderPromptFile(`tools/${toolName}.json`, variables, baseUrl);
  const parsed = JSON.parse(raw) as Partial<ToolPromptText>;
  if (typeof parsed.description !== "string") throw new Error(`Tool prompt ${toolName} is missing description`);
  if (typeof parsed.promptSnippet !== "string") throw new Error(`Tool prompt ${toolName} is missing promptSnippet`);
  if (!Array.isArray(parsed.promptGuidelines) || !parsed.promptGuidelines.every((line) => typeof line === "string")) {
    throw new Error(`Tool prompt ${toolName} is missing promptGuidelines`);
  }
  return {
    description: parsed.description,
    promptSnippet: parsed.promptSnippet,
    promptGuidelines: parsed.promptGuidelines,
  };
}
