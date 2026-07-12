import OpenAI from "openai";
import fs from "node:fs/promises";
import path from "node:path";
import type { ToolDefinition } from "../types.js";

export const generateTools: ToolDefinition[] = [
  {
    name: "generate_image",
    description:
      "توليد صورة من وصف نصي باستخدام DALL-E 3. يتطلب OPENAI_API_KEY. الصورة تُحفظ وتُعرض في الواجهة.",
    danger: "moderate",
    category: "generate",
    parameters: {
      type: "object",
      properties: {
        prompt: { type: "string", description: "وصف تفصيلي للصورة المطلوبة (بالإنجليزية أفضل)" },
        size: {
          type: "string",
          enum: ["1024x1024", "1792x1024", "1024x1792"],
          description: "حجم الصورة",
          default: "1024x1024",
        },
        filename: { type: "string", description: "اسم الملف بدون امتداد", default: "image" },
      },
      required: ["prompt"],
    },
    async execute(args, ctx) {
      if (!process.env.OPENAI_API_KEY) {
        throw new Error("يتطلب OPENAI_API_KEY لتوليد الصور (DALL-E 3)");
      }
      const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const response = await client.images.generate({
        model: "dall-e-3",
        prompt: args.prompt,
        size: args.size || "1024x1024",
        n: 1,
        response_format: "b64_json",
      });
      const b64 = response.data?.[0]?.b64_json;
      if (!b64) throw new Error("No image data returned");

      await fs.mkdir(ctx.generatedDir, { recursive: true });
      const name = `${args.filename || "image"}-${Date.now()}.png`;
      const filepath = path.join(ctx.generatedDir, name);
      await fs.writeFile(filepath, Buffer.from(b64, "base64"));
      ctx.emit({ type: "image_generated", data: { path: name, prompt: args.prompt } });
      return `Image generated: ${name}\nPrompt: ${args.prompt}`;
    },
  },
  {
    name: "generate_audio",
    description: "تحويل نص إلى كلام صوتي باستخدام OpenAI TTS. الصوت يُحفظ ويُعرض في الواجهة.",
    danger: "moderate",
    category: "generate",
    parameters: {
      type: "object",
      properties: {
        text: { type: "string", description: "النص المطلوب تحويله لصوت" },
        voice: {
          type: "string",
          enum: ["alloy", "echo", "fable", "onyx", "nova", "shimmer"],
          description: "نوع الصوت",
          default: "alloy",
        },
        filename: { type: "string", description: "اسم الملف بدون امتداد", default: "audio" },
      },
      required: ["text"],
    },
    async execute(args, ctx) {
      if (!process.env.OPENAI_API_KEY) {
        throw new Error("يتطلب OPENAI_API_KEY لتوليد الصوت");
      }
      const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const response = await client.audio.speech.create({
        model: "tts-1",
        voice: args.voice || "alloy",
        input: args.text,
      });
      await fs.mkdir(ctx.generatedDir, { recursive: true });
      const name = `${args.filename || "audio"}-${Date.now()}.mp3`;
      const filepath = path.join(ctx.generatedDir, name);
      const buf = Buffer.from(await response.arrayBuffer());
      await fs.writeFile(filepath, buf);
      ctx.emit({ type: "audio_generated", data: { path: name, text: args.text } });
      return `Audio generated: ${name} (${buf.length} bytes)`;
    },
  },
];
