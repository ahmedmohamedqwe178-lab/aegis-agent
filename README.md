# 🛡️ Aegis — Autonomous Coding AI Agent

وكيل ذكاء اصطناعي احترافي يفهم البرمجة بعمق، يكتب كوداً، ينفّذ أوامر، يتصفّح الويب، ويولّد صوراً وصوتاً — كل ذلك مع نظام أذونات ذكي.

## ✨ الميزات

- 🧠 **موديلات متعددة**: يكتشف تلقائياً أفضل موديل متاح (Claude Sonnet 4.5 → GPT-4o → Groq Llama → Ollama)
- 🔧 **أدوات قوية**:
  - قراءة/كتابة/تعديل/حذف/بحث في الملفات (sandboxed)
  - تنفيذ أوامر shell (npm, python, git, إلخ)
  - **متصفح حقيقي** بـ Playwright (فتح، ضغط، كتابة، لقطات شاشة، استخراج)
  - جلب URLs مباشرة
  - **توليد صور** (DALL-E 3)
  - **توليد صوت** (TTS)
- 🔐 **نظام أذونات ذكي**: يوافق على فئة كاملة (files/shell/browser) لبقية الجلسة أو مرة واحدة
- 💻 **واجهة شبيهة بـ VS Code**: 3 أعمدة (شجرة ملفات + محرر + شات)
  - عرض مباشر للصور، الصوت، ولقطات المتصفح داخل الشات
  - معاينة HTML في iframe
  - كود مع syntax عرضي
- 🔄 **تكرار ذكي**: يخطط، ينفّذ، يتحقق، ويصحح تلقائياً (حتى 25 دورة)
- 🌐 دعم كامل للعربية (RTL)

## 🚀 التشغيل

```bash
cd ai-agent-pro
npm install                    # يثبّت التبعيات و Chromium لـ Playwright

# احصل على مفتاح مجاني من https://console.groq.com/keys
export GROQ_API_KEY=gsk_...
# أو استخدم Anthropic (الأفضل):
# export ANTHROPIC_API_KEY=sk-ant-...

npm run dev                    # التطوير مع hot reload
# أو
npm run build && npm start     # الإنتاج
```

افتح **http://localhost:3000** 🎉

## 🏗️ البنية

```
ai-agent-pro/
├── src/
│   ├── types.ts               # الأنواع المشتركة
│   ├── permissions.ts         # نظام الأذونات
│   ├── agent.ts               # حلقة الوكيل (planning + tool execution)
│   ├── server.ts              # Express + WebSocket
│   ├── providers/
│   │   ├── index.ts           # اكتشاف تلقائي للمزود
│   │   ├── anthropic.ts       # Claude
│   │   ├── openai.ts          # GPT
│   │   ├── groq.ts            # Groq (Llama, مجاني)
│   │   └── ollama.ts          # موديل محلي
│   └── tools/
│       ├── files.ts           # read/write/edit/delete/search/list
│       ├── shell.ts           # bash commands
│       ├── browser.ts         # Playwright automation
│       └── generate.ts        # DALL-E 3, TTS
├── public/                    # الواجهة (VS Code-like)
├── workspace/                 # حيث يعمل الوكيل (sandbox)
└── generated/                 # الصور، الصوت، لقطات الشاشة
```

## 🔐 الأمان

- **Sandbox**: كل عمليات الملفات محصورة في `workspace/`
- **أذونات ثلاثية**: `safe` (تلقائي) / `moderate` (يسأل مرة) / `dangerous` (يسأل دائماً)
- **حدود على shell**: مهلة 60 ثانية افتراضياً
- **حدود على HTTP**: response cap 5 KB لـ fetch_url

## 💡 أمثلة للتجربة

- "اكتب لعبة snake بـ HTML+JS في ملف واحد وشغّلها"
- "أنشئ REST API بـ Express فيه CRUD للمستخدمين، شغّله واختبره بـ curl"
- "افتح https://news.ycombinator.com واستخرج أول 10 عناوين مع الروابط"
- "ولّد صورة لقطة فضائية تشرب قهوة، ثم ولّد صوت يوصف الصورة بالعربي"
- "clone this repo, run its tests, and fix any failing ones"

## 🛠️ إضافة أداة جديدة

في `src/tools/`، أضف ملف بأداتك:

```ts
export const myTool: ToolDefinition = {
  name: "my_tool",
  description: "ماذا تفعل",
  danger: "moderate",           // safe | moderate | dangerous
  category: "custom",           // للأذونات على مستوى الجلسة
  parameters: { /* JSON Schema */ },
  async execute(args, ctx) {
    // نفّذ + ارجع string
    return "result";
  },
};
```

ثم أضفها في `src/tools/index.ts`. الوكيل سيكتشفها تلقائياً.

## ⚙️ الإعدادات

جميعها اختيارية عبر environment variables:

| المتغير | الافتراضي | الشرح |
|---|---|---|
| `ANTHROPIC_MODEL` | `claude-sonnet-4-5-20250929` | موديل Claude |
| `OPENAI_MODEL` | `gpt-4o` | موديل OpenAI |
| `GROQ_MODEL` | `llama-3.3-70b-versatile` | موديل Groq |
| `PORT` | `3000` | منفذ السيرفر |
