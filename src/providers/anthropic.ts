import Anthropic from "@anthropic-ai/sdk";
import type { Message, Provider, ToolCall, ToolDefinition } from "../types.js";

export class AnthropicProvider implements Provider {
  name = "anthropic";
  model: string;
  private client: Anthropic;

  constructor(apiKey: string, model = "claude-sonnet-4-5-20250929") {
    this.client = new Anthropic({ apiKey });
    this.model = model;
  }

  async chat(messages: Message[], tools: ToolDefinition[]) {
    const systemMsg = messages.find(m => m.role === "system");
    const conv = messages.filter(m => m.role !== "system");

    // تحويل الرسائل إلى تنسيق Anthropic
    const anthMessages: Anthropic.MessageParam[] = [];
    for (const m of conv) {
      if (m.role === "user") {
        anthMessages.push({ role: "user", content: m.content || "" });
      } else if (m.role === "assistant") {
        const parts: any[] = [];
        if (m.content) parts.push({ type: "text", text: m.content });
        for (const tc of m.tool_calls || []) {
          parts.push({
            type: "tool_use",
            id: tc.id,
            name: tc.name,
            input: tc.arguments,
          });
        }
        anthMessages.push({ role: "assistant", content: parts });
      } else if (m.role === "tool" && m.tool_result) {
        anthMessages.push({
          role: "user",
          content: [{
            type: "tool_result",
            tool_use_id: m.tool_result.tool_call_id,
            content: m.tool_result.content,
            is_error: m.tool_result.is_error,
          }],
        });
      }
    }

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 8096,
      system: typeof systemMsg?.content === "string" ? systemMsg.content : undefined,
      messages: anthMessages,
      tools: tools.map(t => ({
        name: t.name,
        description: t.description,
        input_schema: t.parameters as any,
      })),
    });

    let content = "";
    const tool_calls: ToolCall[] = [];
    for (const block of response.content) {
      if (block.type === "text") content += block.text;
      else if (block.type === "tool_use") {
        tool_calls.push({
          id: block.id,
          name: block.name,
          arguments: block.input as Record<string, any>,
        });
      }
    }
    return { content, tool_calls };
  }
}
