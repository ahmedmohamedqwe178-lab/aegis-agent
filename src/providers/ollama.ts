import { OpenAIProvider } from "./openai.js";

// Ollama يوفر واجهة متوافقة مع OpenAI
export class OllamaProvider extends OpenAIProvider {
  constructor(baseURL = "http://localhost:11434/v1", model = "llama3.1") {
    super("ollama-no-key-needed", model, baseURL);
    this.name = "ollama";
  }
  name = "ollama";
}
