import fs from "node:fs/promises";
import path from "node:path";
import type { ToolDefinition } from "../types.js";

function safeJoin(base: string, rel: string): string {
  const resolved = path.resolve(base, rel);
  if (!resolved.startsWith(base + path.sep) && resolved !== base) {
    throw new Error(`Path escapes workspace: ${rel}`);
  }
  return resolved;
}

export const fileTools: ToolDefinition[] = [
  {
    name: "read_file",
    description: "قراءة محتوى ملف نصي من مساحة العمل. يدعم الملفات النصية والكود.",
    danger: "safe",
    category: "read",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "المسار النسبي للملف داخل workspace" },
      },
      required: ["path"],
    },
    async execute(args, ctx) {
      const p = safeJoin(ctx.workspaceDir, args.path);
      const content = await fs.readFile(p, "utf8");
      return `Content of ${args.path} (${content.length} chars):\n\`\`\`\n${content}\n\`\`\``;
    },
  },
  {
    name: "write_file",
    description: "كتابة أو استبدال ملف داخل مساحة العمل. استخدمه لإنشاء ملفات كود جديدة أو الكتابة عليها بالكامل.",
    danger: "moderate",
    category: "write",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "المسار النسبي للملف" },
        content: { type: "string", description: "المحتوى الكامل للملف" },
      },
      required: ["path", "content"],
    },
    async execute(args, ctx) {
      const p = safeJoin(ctx.workspaceDir, args.path);
      await fs.mkdir(path.dirname(p), { recursive: true });
      const existed = await fs.access(p).then(() => true).catch(() => false);
      await fs.writeFile(p, args.content, "utf8");
      ctx.emit({
        type: "file_changed",
        data: { path: args.path, action: existed ? "modified" : "created" },
      });
      return `${existed ? "Modified" : "Created"} ${args.path} (${Buffer.byteLength(args.content)} bytes)`;
    },
  },
  {
    name: "edit_file",
    description: "تعديل جزء محدد في ملف موجود عن طريق استبدال نص بنص آخر. الأفضل للتعديلات الصغيرة.",
    danger: "moderate",
    category: "write",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "المسار النسبي للملف" },
        old_text: { type: "string", description: "النص المطلوب استبداله (يجب أن يكون فريداً في الملف)" },
        new_text: { type: "string", description: "النص الجديد" },
      },
      required: ["path", "old_text", "new_text"],
    },
    async execute(args, ctx) {
      const p = safeJoin(ctx.workspaceDir, args.path);
      const content = await fs.readFile(p, "utf8");
      const occurrences = content.split(args.old_text).length - 1;
      if (occurrences === 0) throw new Error("old_text not found in file");
      if (occurrences > 1) throw new Error(`old_text appears ${occurrences} times — make it more specific`);
      const updated = content.replace(args.old_text, args.new_text);
      await fs.writeFile(p, updated, "utf8");
      ctx.emit({ type: "file_changed", data: { path: args.path, action: "modified" } });
      return `Edited ${args.path} — replaced ${args.old_text.length} chars with ${args.new_text.length} chars`;
    },
  },
  {
    name: "list_directory",
    description: "عرض محتويات مجلد داخل مساحة العمل (ملفات ومجلدات).",
    danger: "safe",
    category: "read",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "المسار النسبي (استخدم '.' للجذر)" },
      },
      required: ["path"],
    },
    async execute(args, ctx) {
      const p = safeJoin(ctx.workspaceDir, args.path);
      const entries = await fs.readdir(p, { withFileTypes: true });
      const items = entries.map(e => `${e.isDirectory() ? "📁" : "📄"} ${e.name}`);
      return items.length ? items.join("\n") : "(empty directory)";
    },
  },
  {
    name: "delete_file",
    description: "حذف ملف أو مجلد. عملية خطيرة — تحتاج إذن.",
    danger: "dangerous",
    category: "write",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "المسار النسبي" },
      },
      required: ["path"],
    },
    async execute(args, ctx) {
      const p = safeJoin(ctx.workspaceDir, args.path);
      await fs.rm(p, { recursive: true, force: true });
      ctx.emit({ type: "file_changed", data: { path: args.path, action: "deleted" } });
      return `Deleted ${args.path}`;
    },
  },
  {
    name: "search_files",
    description: "البحث عن نص داخل الملفات (grep) في مساحة العمل.",
    danger: "safe",
    category: "read",
    parameters: {
      type: "object",
      properties: {
        pattern: { type: "string", description: "النص أو Regex للبحث عنه" },
        path: { type: "string", description: "المجلد (اختياري، افتراضي '.')", default: "." },
      },
      required: ["pattern"],
    },
    async execute(args, ctx) {
      const startDir = safeJoin(ctx.workspaceDir, args.path || ".");
      const regex = new RegExp(args.pattern, "i");
      const results: string[] = [];
      async function walk(dir: string) {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const e of entries) {
          const full = path.join(dir, e.name);
          if (e.isDirectory()) {
            if (e.name === "node_modules" || e.name.startsWith(".")) continue;
            await walk(full);
          } else {
            try {
              const content = await fs.readFile(full, "utf8");
              const lines = content.split("\n");
              lines.forEach((line, i) => {
                if (regex.test(line)) {
                  results.push(`${path.relative(ctx.workspaceDir, full)}:${i + 1}: ${line.trim()}`);
                }
              });
            } catch { /* binary or unreadable */ }
          }
        }
      }
      await walk(startDir);
      return results.length ? results.slice(0, 100).join("\n") : "(no matches)";
    },
  },
];
