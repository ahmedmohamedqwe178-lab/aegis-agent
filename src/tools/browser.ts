// نسخة خفيفة بدون Playwright - عشان تشتغل على الخطة المجانية من Render
// بس تحتفظ بـ fetch_url

import type { ToolDefinition } from "../types.js";

export const browserTools: ToolDefinition[] = [
  {
    name: "fetch_url",
    description: "جلب URL بسرعة (لـ APIs أو صفحات ويب بسيطة). يرجع HTML/JSON مقصوص لأول 5000 حرف.",
    danger: "safe",
    category: "network",
    parameters: {
      type: "object",
      properties: {
        url: { type: "string", description: "الرابط" },
        method: { type: "string", enum: ["GET", "POST"], default: "GET" },
        body: { type: "string", description: "JSON body لـ POST" },
      },
      required: ["url"],
    },
    async execute(args) {
      const res = await fetch(args.url, {
        method: args.method || "GET",
        body: args.body,
        headers: args.body ? { "Content-Type": "application/json" } : {},
      });
      const text = await res.text();
      return `Status: ${res.status}\nContent-Type: ${res.headers.get("content-type")}\n\n${text.slice(0, 5000)}${text.length > 5000 ? "\n...(truncated)" : ""}`;
    },
  },
  {
    name: "fetch_json",
    description: "جلب JSON من URL وتحليله. مفيد لـ APIs.",
    danger: "safe",
    category: "network",
    parameters: {
      type: "object",
      properties: {
        url: { type: "string", description: "الرابط" },
      },
      required: ["url"],
    },
    async execute(args) {
      const res = await fetch(args.url);
      const data = await res.json();
      return JSON.stringify(data, null, 2).slice(0, 5000);
    },
  },
];

// جلسة وهمية - عشان الكود القديم يقدر يستدعيها
export const browserSession = {
  async close() { /* no-op */ }
};
