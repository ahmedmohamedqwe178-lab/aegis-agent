import type { ToolDefinition } from "../types.js";

// خطة داخلية للوكيل — تظهر للمستخدم كتقدم واضح
const currentPlan: {
  goal: string;
  steps: { text: string; status: "pending" | "doing" | "done" | "failed" }[];
} = { goal: "", steps: [] };

export const taskTools: ToolDefinition[] = [
  {
    name: "create_plan",
    description:
      "استخدمها في بداية أي مهمة معقدة (أكثر من 3 خطوات) لتضع خطة واضحة. المستخدم يرى الخطة ويتابع التقدم.",
    danger: "safe",
    category: "read",
    parameters: {
      type: "object",
      properties: {
        goal: { type: "string", description: "الهدف النهائي" },
        steps: {
          type: "array",
          items: { type: "string" },
          description: "قائمة الخطوات المطلوبة بالترتيب",
        },
      },
      required: ["goal", "steps"],
    },
    async execute(args) {
      currentPlan.goal = args.goal;
      currentPlan.steps = args.steps.map((text: string) => ({ text, status: "pending" as const }));
      return `📋 Plan created:\nGoal: ${args.goal}\n\nSteps:\n${currentPlan.steps.map((s, i) => `  ${i + 1}. [ ] ${s.text}`).join("\n")}`;
    },
  },
  {
    name: "update_plan",
    description: "حدّث حالة خطوة في الخطة عند البدء فيها أو الانتهاء منها.",
    danger: "safe",
    category: "read",
    parameters: {
      type: "object",
      properties: {
        step_index: { type: "number", description: "رقم الخطوة (يبدأ من 0)" },
        status: { type: "string", enum: ["doing", "done", "failed"], description: "الحالة الجديدة" },
      },
      required: ["step_index", "status"],
    },
    async execute(args) {
      const idx = args.step_index;
      if (idx < 0 || idx >= currentPlan.steps.length) throw new Error("step_index out of range");
      currentPlan.steps[idx].status = args.status;
      const icon = (s: string) => s === "done" ? "✅" : s === "doing" ? "🔄" : s === "failed" ? "❌" : "⬜";
      return `Plan progress:\n${currentPlan.steps.map((s, i) => `  ${i + 1}. ${icon(s.status)} ${s.text}`).join("\n")}`;
    },
  },
];
