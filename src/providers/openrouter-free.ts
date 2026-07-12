import { OpenAIProvider } from "./openai.js";

// OpenRouter يقدم موديلات مجانية تماماً بدون مفتاح مدفوع
// يحتاج فقط تسجيل مجاني من https://openrouter.ai/keys
export class OpenRouterProvider extends OpenAIProvider {
  constructor(apiKey: string, model = "meta-llama/llama-3.3-70b-instruct:free") {
    super(apiKey, model, "https://openrouter.ai/api/v1");
    this.name = "openrouter";
  }
  name = "openrouter";
}
