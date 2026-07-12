import { spawn } from "node:child_process";
import type { ToolDefinition } from "../types.js";

export const shellTools: ToolDefinition[] = [
  {
    name: "run_shell",
    description:
      "تنفيذ أمر shell (bash) في مساحة العمل. يستخدم لتشغيل مثل: npm install, python script.py, git status, ls, mkdir, إلخ. مهلة 60 ثانية.",
    danger: "dangerous",
    category: "shell",
    parameters: {
      type: "object",
      properties: {
        command: { type: "string", description: "الأمر المطلوب تنفيذه" },
        timeout_sec: { type: "number", description: "المهلة بالثواني (افتراضي 60)", default: 60 },
      },
      required: ["command"],
    },
    async execute(args, ctx) {
      return new Promise<string>((resolve) => {
        const timeoutMs = (args.timeout_sec || 60) * 1000;
        const proc = spawn("bash", ["-lc", args.command], {
          cwd: ctx.workspaceDir,
          env: process.env,
        });
        let stdout = "", stderr = "";
        const timer = setTimeout(() => proc.kill("SIGKILL"), timeoutMs);

        proc.stdout.on("data", d => { stdout += d.toString(); });
        proc.stderr.on("data", d => { stderr += d.toString(); });
        proc.on("close", (code) => {
          clearTimeout(timer);
          ctx.emit({
            type: "shell_output",
            data: { command: args.command, stdout, stderr, code: code || 0 },
          });
          const trim = (s: string, n = 3000) =>
            s.length > n ? s.slice(0, n) + `\n… (truncated ${s.length - n} chars)` : s;
          resolve(
            `Exit code: ${code}\n\nSTDOUT:\n${trim(stdout) || "(empty)"}\n\nSTDERR:\n${trim(stderr) || "(empty)"}`
          );
        });
        proc.on("error", (err) => {
          clearTimeout(timer);
          resolve(`Failed to spawn: ${err.message}`);
        });
      });
    },
  },
];
