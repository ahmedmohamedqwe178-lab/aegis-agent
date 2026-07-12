import { OpenAIProvider } from "./openai.js";

// Groq يستخدم نفس API الخاص بـ OpenAI — نمرر عليه baseURL
export class GroqProvider extends OpenAIProvider {
  constructor(apiKey: string, model = "llama-3.3-70b-versatile") {
    super(apiKey, model, "https://api.groq.com/openai/v1");
    this.name = "groq";
  }
  name = "groq";
}
