import express from "express";
import { WebSocketServer } from "ws";
import http from "node:http";
import path from "node:path";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { Agent } from "./agent.js";
import { detectProvider } from "./providers/index.js";
import { PermissionManager } from "./permissions.js";
import { browserSession } from "./tools/browser.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

async function main() {
  const provider = await detectProvider();

  const app = express();
  app.use(express.json({ limit: "5mb" }));
  app.use(express.static(path.join(ROOT, "public")));
  // تقديم الملفات المولّدة (صور، صوت، لقطات) للواجهة
  app.use("/generated", express.static(path.join(ROOT, "generated")));
  app.use("/workspace", express.static(path.join(ROOT, "workspace")));

  // API للحصول على شجرة الملفات
  app.get("/api/files", async (_req, res) => {
    const workspace = path.join(ROOT, "workspace");
    async function walk(dir: string, rel = ""): Promise<any[]> {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      const items: any[] = [];
      for (const e of entries) {
        if (e.name.startsWith(".") || e.name === "node_modules") continue;
        const full = path.join(dir, e.name);
        const relPath = path.join(rel, e.name);
        if (e.isDirectory()) {
          items.push({ name: e.name, path: relPath, type: "dir", children: await walk(full, relPath) });
        } else {
          const stat = await fs.stat(full);
          items.push({ name: e.name, path: relPath, type: "file", size: stat.size });
        }
      }
      return items;
    }
    try { res.json(await walk(workspace)); }
    catch { res.json([]); }
  });

  app.get("/api/file", async (req, res) => {
    const rel = String(req.query.path || "");
    const full = path.resolve(ROOT, "workspace", rel);
    if (!full.startsWith(path.join(ROOT, "workspace"))) return res.status(400).json({ error: "invalid path" });
    try {
      const content = await fs.readFile(full, "utf8");
      res.json({ content });
    } catch (err: any) {
      res.status(404).json({ error: err.message });
    }
  });

  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: "/ws" });

  // كل اتصال = جلسة مستقلة بذاكرتها الخاصة
  wss.on("connection", (ws) => {
    const permissions = new PermissionManager();
    const agent = new Agent(provider, permissions);

    const send = (msg: any) => {
      if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
    };

    send({ type: "provider_info", data: { provider: provider.name, model: provider.model } });

    ws.on("message", async (raw) => {
      let msg: any;
      try { msg = JSON.parse(raw.toString()); } catch { return; }

      if (msg.type === "chat") {
        try {
          await agent.run(msg.message, send);
          send({ type: "done" });
        } catch (err: any) {
          send({ type: "error", data: err?.message || String(err) });
          send({ type: "done" });
        }
      } else if (msg.type === "permission_response") {
        permissions.resolvePending(msg.id, msg.granted, msg.applyToSession !== false);
      } else if (msg.type === "reset") {
        agent.reset();
        send({ type: "reset_ok" });
      }
    });

    ws.on("close", () => permissions.reset());
  });

  const port = Number(process.env.PORT || 3000);
  server.listen(port, () => {
    console.log(`\n🚀 Aegis AI Agent running: http://localhost:${port}`);
    console.log(`   Provider: ${provider.name} (${provider.model})`);
  });

  // إغلاق نظيف
  process.on("SIGINT", async () => {
    console.log("\n🧹 Cleaning up...");
    await browserSession.close();
    process.exit(0);
  });
}

main().catch(err => {
  console.error("\n" + err.message);
  process.exit(1);
});
