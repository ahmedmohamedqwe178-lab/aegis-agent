import { AnthropicProvider } from "./anthropic.js";
import { OpenAIProvider } from "./openai.js";
import { GroqProvider } from "./groq.js";
import { OllamaProvider } from "./ollama.js";
import { OpenRouterProvider } from "./openrouter-free.js";
import type { Provider } from "../types.js";

// اكتشاف تلقائي: يجرب الأقوى أولاً
export async function detectProvider(): Promise<Provider> {
  if (process.env.ANTHROPIC_API_KEY) {
    console.log("✓ Using Anthropic Claude (best for coding)");
    return new AnthropicProvider(
      process.env.ANTHROPIC_API_KEY,
      process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5-20250929",
    );
  }
  if (process.env.OPENAI_API_KEY) {
    console.log("✓ Using OpenAI GPT");
    return new OpenAIProvider(
      process.env.OPENAI_API_KEY,
      process.env.OPENAI_MODEL || "gpt-4o",
    );
  }
  if (process.env.GROQ_API_KEY) {
    console.log("✓ Using Groq (free & fast)");
    return new GroqProvider(
      process.env.GROQ_API_KEY,
      process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
    );
  }
  if (process.env.OPENROUTER_API_KEY) {
    console.log("✓ Using OpenRouter (free tier)");
    return new OpenRouterProvider(
      process.env.OPENROUTER_API_KEY,
      process.env.OPENROUTER_MODEL || "meta-llama/llama-3.3-70b-instruct:free",
    );
  }
  // محاولة Ollama محلياً
  const ollamaUrl = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
  try {
    const res = await fetch(`${ollamaUrl}/api/tags`, { signal: AbortSignal.timeout(2000) });
    if (res.ok) {
      const data: any = await res.json();
      const firstModel = data.models?.[0]?.name || "llama3.1";
      console.log(`✓ Using local Ollama (${firstModel})`);
      return new OllamaProvider(`${ollamaUrl}/v1`, firstModel);
    }
  } catch { /* ignore */ }

  throw new Error(
    "\n" +
    "═══════════════════════════════════════════════════════════════\n" +
    "❌ محتاج مفتاح API واحد على الأقل عشان الوكيل يشتغل\n" +
    "═══════════════════════════════════════════════════════════════\n" +
    "\n" +
    "🥇 الأسرع (مجاني بالكامل، بيدي مفتاح خلال 30 ثانية):\n" +
    "   1) روح https://console.groq.com/keys\n" +
    "   2) اعمل تسجيل دخول بـ Google\n" +
    "   3) اضغط 'Create API Key' وانسخه\n" +
    "   4) شغّل الأمر ده:\n" +
    "      export GROQ_API_KEY=gsk_xxxxx  (حط المفتاح بتاعك)\n" +
    "   5) شغّل السيرفر تاني: npm run dev\n" +
    "\n" +
    "🥈 بديل مجاني تاني: https://openrouter.ai/keys\n" +
    "   export OPENROUTER_API_KEY=sk-or-xxxxx\n" +
    "\n" +
    "🥉 لو عندك اشتراك:\n" +
    "   export ANTHROPIC_API_KEY=sk-ant-xxxxx  (الأقوى)\n" +
    "   export OPENAI_API_KEY=sk-xxxxx\n" +
    "\n" +
    "🏠 أو محلياً: ثبّت Ollama من https://ollama.com\n" +
    "   ollama pull llama3.1\n" +
    "═══════════════════════════════════════════════════════════════"
  );
}
