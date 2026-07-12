import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import type { Message, Provider, ToolCall, ToolDefinition } from "../types.js";

export class OpenAIProvider implements Provider {
  name = "openai";
  model: string;
  private client: OpenAI;

  constructor(apiKey: string, model = "gpt-4o", baseURL?: string) {
    this.client = new OpenAI({ apiKey, baseURL });
    this.model = model;
  }

  async chat(messages: Message[], tools: ToolDefinition[]) {
    const oaMessages: ChatCompletionMessageParam[] = messages.map(m => {
      if (m.role === "system") return { role: "system", content: m.content || "" };
      if (m.role === "user") return { role: "user", content: m.content || "" };
      if (m.role === "assistant") {
        const msg: any = { role: "assistant", content: m.content || null };
        if (m.tool_calls?.length) {
          msg.tool_calls = m.tool_calls.map(tc => ({
            id: tc.id,
            type: "function" as const,
            function: { name: tc.name, arguments: JSON.stringify(tc.arguments) },
          }));
        }
        return msg;
      }
      if (m.role === "tool" && m.tool_result) {
        return {
          role: "tool",
          tool_call_id: m.tool_result.tool_call_id,
          content: m.tool_result.content,
        };
      }
      return { role: "user", content: "" };
    });

    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: oaMessages,
      tools: tools.map(t => ({
        type: "function" as const,
        function: {
          name: t.name,
          description: t.description,
          parameters: t.parameters,
        },
      })),
      tool_choice: "auto",
    });

    const choice = response.choices[0].message;
    const tool_calls: ToolCall[] = (choice.tool_calls || []).map(tc => ({
      id: tc.id,
      name: tc.function.name,
      arguments: safeParse(tc.function.arguments),
    }));
    return { content: choice.content || "", tool_calls };
  }
}

function safeParse(s: string): Record<string, any> {
  try { return JSON.parse(s); } catch { return {}; }
}
