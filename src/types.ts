// نوع موحد لكل الرسائل بين الوكيل والموديل (يشبه شكل OpenAI/Anthropic معاً)

export type Role = "system" | "user" | "assistant" | "tool";

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, any>;
}

export interface ToolResult {
  tool_call_id: string;
  name: string;
  content: string;
  is_error?: boolean;
}

export interface Message {
  role: Role;
  content?: string;
  tool_calls?: ToolCall[];
  tool_result?: ToolResult;
}

export interface ToolDefinition {
  name: string;
  description: string;
  // JSON Schema
  parameters: {
    type: "object";
    properties: Record<string, any>;
    required?: string[];
  };
  // مستوى الحساسية — يحدد إذا كان يحتاج إذن
  danger: "safe" | "moderate" | "dangerous";
  // التصنيف (لأذونات على مستوى الجلسة)
  category: "read" | "write" | "shell" | "browser" | "network" | "generate";
  execute: (args: any, ctx: ToolContext) => Promise<string>;
}

export interface ToolContext {
  workspaceDir: string;
  generatedDir: string;
  requestPermission: (tool: string, category: string, args: any) => Promise<boolean>;
  emit: (event: AgentEvent) => void;
}

export type AgentEvent =
  | { type: "assistant_text"; data: string }
  | { type: "assistant_thinking"; data: string }
  | { type: "tool_call"; data: { id: string; name: string; args: any } }
  | { type: "tool_result"; data: { id: string; name: string; result: string; is_error?: boolean } }
  | { type: "permission_request"; data: { id: string; tool: string; category: string; args: any; description: string } }
  | { type: "permission_response"; data: { id: string; granted: boolean } }
  | { type: "file_changed"; data: { path: string; action: "created" | "modified" | "deleted" } }
  | { type: "browser_screenshot"; data: { path: string; url: string } }
  | { type: "image_generated"; data: { path: string; prompt: string } }
  | { type: "audio_generated"; data: { path: string; text: string } }
  | { type: "shell_output"; data: { command: string; stdout: string; stderr: string; code: number } }
  | { type: "provider_info"; data: { provider: string; model: string } }
  | { type: "error"; data: string }
  | { type: "final"; data: string }
  | { type: "done"; data?: any };

export interface Provider {
  name: string;
  model: string;
  chat(messages: Message[], tools: ToolDefinition[]): Promise<{
    content: string;
    tool_calls: ToolCall[];
  }>;
}
