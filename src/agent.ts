import path from "node:path";
import { fileURLToPath } from "node:url";
import type { AgentEvent, Message, Provider, ToolContext } from "./types.js";
import { allTools, getToolByName } from "./tools/index.js";
import { PermissionManager } from "./permissions.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SYSTEM_PROMPT = `أنت "Aegis" — وكيل برمجي احترافي مستقل (senior software engineer AI agent).

# قدراتك
- تفهم البرمجة بعمق في جميع اللغات (Python, JS/TS, Go, Rust, Java, C++, إلخ)
- تكتب كوداً نظيفاً ومختبَراً وتشغّله فعلياً
- تنفذ أوامر shell وتُدير مشاريع كاملة
- تتصفح الويب عبر متصفح Chrome حقيقي (Playwright)
- تولّد صوراً (DALL-E 3) وصوتاً (TTS)
- تخطط ثم تنفذ ثم تتحقق ثم تصحح — كلياً بدون تدخل

# منهجية العمل الإلزامية

## للمهام البسيطة (خطوة أو خطوتين):
- نفّذ مباشرة بدون خطة رسمية.

## للمهام المتوسطة والمعقدة (3+ خطوات):
1. **خطّط**: استدعِ create_plan بأسماء خطوات واضحة وقصيرة.
2. **نفّذ خطوة خطوة**: قبل كل خطوة، update_plan(status="doing")، وبعدها update_plan(status="done").
3. **تحقّق**: شغّل الكود بعد كتابته. لو فيه أخطاء، صحّحها بنفسك (لا تسأل).
4. **افحص النتيجة**: اقرأ إخراج run_shell، افحص browser_screenshot، تأكد المهمة نُفّذت فعلاً.
5. **أبلغ**: عند الانتهاء، لخّص ما تم في جملة أو جملتين.

# قواعد صارمة
- ✅ اكتب كوداً كاملاً وشغّالاً — ممنوع TODO أو placeholder.
- ✅ بعد كتابة أي كود، شغّله واختبره. لو فشل، صلحه فوراً.
- ✅ استخدم best practices: types صريحة، error handling، file structure نظيف.
- ✅ لو مش عارف حاجة، ابحث عنها (fetch_url) أو جرّبها (run_shell) — لا تخمّن.
- ✅ ردودك النصية للمستخدم مختصرة جداً. الواجهة تعرض تفاصيل الأدوات تلقائياً.
- ❌ لا تكرر عرض محتوى الملفات في ردك.
- ❌ لا تسأل المستخدم إذناً — النظام يفعل ذلك تلقائياً عند الحاجة.
- ❌ لا تتوقف بعد خطأ واحد — جرّب حل بديل.
- ❌ لا تنشئ ملفات خارج workspace/.

# استراتيجية تصحيح الأخطاء
لو run_shell رجع exit code != 0:
1. اقرأ stderr بعناية.
2. حدد السبب (missing dep? syntax? logic?).
3. صحّح تلقائياً واعد المحاولة (حتى 3 محاولات).
4. لو فشلت 3 محاولات، جرّب نهج مختلف تماماً.

# اللغة
رد بلغة المستخدم (عربي فصيح لو المستخدم بيكتب عربي، إنجليزي لو بيكتب إنجليزي).
لكن أسماء المتغيرات في الكود دائماً بالإنجليزية.

الوقت الحالي: ${new Date().toISOString()}`;

export class Agent {
  private provider: Provider;
  private permissions: PermissionManager;
  private history: Message[] = [];
  private workspaceDir: string;
  private generatedDir: string;

  constructor(provider: Provider, permissions: PermissionManager) {
    this.provider = provider;
    this.permissions = permissions;
    this.workspaceDir = path.resolve(__dirname, "..", "workspace");
    this.generatedDir = path.resolve(__dirname, "..", "generated");
  }

  reset() {
    this.history = [];
    this.permissions.reset();
  }

  getPermissions() { return this.permissions; }

  async run(userMessage: string, emit: (e: AgentEvent) => void): Promise<void> {
    emit({
      type: "provider_info",
      data: { provider: this.provider.name, model: this.provider.model },
    });

    const messages: Message[] = [
      { role: "system", content: SYSTEM_PROMPT },
      ...this.history,
      { role: "user", content: userMessage },
    ];
    this.history.push({ role: "user", content: userMessage });

    const ctx: ToolContext = {
      workspaceDir: this.workspaceDir,
      generatedDir: this.generatedDir,
      emit,
      requestPermission: async (tool, category, args) => {
        const toolDef = getToolByName(tool);
        const description = toolDef?.description || tool;
        return this.permissions.request(tool, category, args, description, emit, toolDef?.danger || "moderate");
      },
    };

    const MAX_ITERATIONS = 40;
    for (let i = 0; i < MAX_ITERATIONS; i++) {
      let response;
      let attempts = 0;
      const MAX_RETRIES = 3;
      while (attempts < MAX_RETRIES) {
        try {
          response = await this.provider.chat(messages, allTools);
          break;
        } catch (err: any) {
          attempts++;
          const errMsg = err?.message || String(err);
          // Rate limit / temporary errors → retry with backoff
          if (attempts < MAX_RETRIES && /rate|429|503|timeout|ECONN/i.test(errMsg)) {
            emit({ type: "error", data: `⚠️ Provider error (attempt ${attempts}/${MAX_RETRIES}): ${errMsg}. Retrying...` });
            await new Promise(r => setTimeout(r, 1000 * attempts));
            continue;
          }
          emit({ type: "error", data: `Model error: ${errMsg}` });
          return;
        }
      }
      if (!response) return;

      if (response.content) emit({ type: "assistant_text", data: response.content });

      const assistantMsg: Message = {
        role: "assistant",
        content: response.content,
        tool_calls: response.tool_calls.length ? response.tool_calls : undefined,
      };
      messages.push(assistantMsg);
      this.history.push(assistantMsg);

      // لا توجد أدوات مطلوبة → انتهى
      if (!response.tool_calls.length) {
        emit({ type: "final", data: response.content });
        return;
      }

      // تنفيذ كل استدعاءات الأدوات
      for (const call of response.tool_calls) {
        const tool = getToolByName(call.name);
        emit({ type: "tool_call", data: { id: call.id, name: call.name, args: call.arguments } });

        if (!tool) {
          const msg = `Unknown tool: ${call.name}. Available: ${allTools.map(t => t.name).join(", ")}`;
          emit({ type: "tool_result", data: { id: call.id, name: call.name, result: msg, is_error: true } });
          const toolMsg: Message = {
            role: "tool",
            tool_result: { tool_call_id: call.id, name: call.name, content: msg, is_error: true },
          };
          messages.push(toolMsg);
          this.history.push(toolMsg);
          continue;
        }

        // طلب إذن إذا لزم
        const allowed = await ctx.requestPermission(call.name, tool.category, call.arguments);
        if (!allowed) {
          const denyMsg = `Permission denied by user for ${call.name}. Try a different approach or ask the user why.`;
          emit({ type: "tool_result", data: { id: call.id, name: call.name, result: denyMsg, is_error: true } });
          const toolMsg: Message = {
            role: "tool",
            tool_result: { tool_call_id: call.id, name: call.name, content: denyMsg, is_error: true },
          };
          messages.push(toolMsg);
          this.history.push(toolMsg);
          continue;
        }

        // تنفيذ الأداة
        let result: string;
        let isError = false;
        try {
          result = await tool.execute(call.arguments, ctx);
        } catch (err: any) {
          result = `Error: ${err?.message || err}\n\nHint: check the arguments and retry with a different approach.`;
          isError = true;
        }

        emit({ type: "tool_result", data: { id: call.id, name: call.name, result, is_error: isError } });
        const toolMsg: Message = {
          role: "tool",
          tool_result: { tool_call_id: call.id, name: call.name, content: result, is_error: isError },
        };
        messages.push(toolMsg);
        this.history.push(toolMsg);
      }
    }

    emit({ type: "error", data: `تجاوز الوكيل الحد الأقصى للتكرارات (${MAX_ITERATIONS}). المهمة قد تكون كبيرة جداً — جرّب تقسيمها.` });
  }
}
