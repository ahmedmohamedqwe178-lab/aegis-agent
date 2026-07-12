import { fileTools } from "./files.js";
import { shellTools } from "./shell.js";
import { browserTools } from "./browser.js";
import { generateTools } from "./generate.js";
import { taskTools } from "./tasks.js";
import type { ToolDefinition } from "../types.js";

export const allTools: ToolDefinition[] = [
  ...taskTools,
  ...fileTools,
  ...shellTools,
  ...browserTools,
  ...generateTools,
];

export function getToolByName(name: string): ToolDefinition | undefined {
  return allTools.find(t => t.name === name);
}
