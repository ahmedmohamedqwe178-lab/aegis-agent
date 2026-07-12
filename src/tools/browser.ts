import { chromium, Browser, Page } from "playwright";
import path from "node:path";
import fs from "node:fs/promises";
import type { ToolDefinition } from "../types.js";

class BrowserSession {
  browser: Browser | null = null;
  page: Page | null = null;

  async ensure() {
    if (!this.browser) {
      this.browser = await chromium.launch({ headless: true });
    }
    if (!this.page) {
      this.page = await this.browser.newPage();
      await this.page.setViewportSize({ width: 1280, height: 800 });
    }
    return this.page;
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
    }
  }
}

// جلسة عالمية للمتصفح تعيش عبر الأدوات
const session = new BrowserSession();

async function screenshot(page: Page, generatedDir: string): Promise<string> {
  await fs.mkdir(generatedDir, { recursive: true });
  const name = `screenshot-${Date.now()}.png`;
  const filepath = path.join(generatedDir, name);
  await page.screenshot({ path: filepath, fullPage: false });
  return name;
}

export const browserTools: ToolDefinition[] = [
  {
    name: "browser_open",
    description: "فتح صفحة ويب في متصفح Chrome حقيقي والانتظار لتحميلها. يرجع محتوى الصفحة النصي + لقطة شاشة.",
    danger: "moderate",
    category: "browser",
    parameters: {
      type: "object",
      properties: {
        url: { type: "string", description: "الرابط الكامل بـ http:// أو https://" },
      },
      required: ["url"],
    },
    async execute(args, ctx) {
      const page = await session.ensure();
      await page.goto(args.url, { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForTimeout(1000);
      const title = await page.title();
      const text = await page.evaluate(() => document.body.innerText.slice(0, 3000));
      const shotName = await screenshot(page, ctx.generatedDir);
      ctx.emit({ type: "browser_screenshot", data: { path: shotName, url: args.url } });
      return `Opened: ${args.url}\nTitle: ${title}\nScreenshot: ${shotName}\n\nContent (truncated):\n${text}`;
    },
  },
  {
    name: "browser_click",
    description: "الضغط على عنصر في الصفحة الحالية باستخدام CSS selector أو نص العنصر.",
    danger: "moderate",
    category: "browser",
    parameters: {
      type: "object",
      properties: {
        selector: { type: "string", description: "CSS selector مثل 'button#submit' أو 'text=Login'" },
      },
      required: ["selector"],
    },
    async execute(args, ctx) {
      const page = await session.ensure();
      await page.click(args.selector, { timeout: 10000 });
      await page.waitForTimeout(1000);
      const shotName = await screenshot(page, ctx.generatedDir);
      ctx.emit({ type: "browser_screenshot", data: { path: shotName, url: page.url() } });
      return `Clicked ${args.selector}. Current URL: ${page.url()}. Screenshot: ${shotName}`;
    },
  },
  {
    name: "browser_type",
    description: "كتابة نص في حقل إدخال.",
    danger: "moderate",
    category: "browser",
    parameters: {
      type: "object",
      properties: {
        selector: { type: "string", description: "CSS selector لحقل الإدخال" },
        text: { type: "string", description: "النص المطلوب كتابته" },
        press_enter: { type: "boolean", description: "هل يضغط Enter بعد الكتابة؟", default: false },
      },
      required: ["selector", "text"],
    },
    async execute(args, ctx) {
      const page = await session.ensure();
      await page.fill(args.selector, args.text);
      if (args.press_enter) await page.press(args.selector, "Enter");
      await page.waitForTimeout(1000);
      const shotName = await screenshot(page, ctx.generatedDir);
      ctx.emit({ type: "browser_screenshot", data: { path: shotName, url: page.url() } });
      return `Typed "${args.text}" into ${args.selector}. Screenshot: ${shotName}`;
    },
  },
  {
    name: "browser_screenshot",
    description: "أخذ لقطة شاشة للصفحة الحالية.",
    danger: "safe",
    category: "browser",
    parameters: { type: "object", properties: {} },
    async execute(_args, ctx) {
      const page = await session.ensure();
      const shotName = await screenshot(page, ctx.generatedDir);
      ctx.emit({ type: "browser_screenshot", data: { path: shotName, url: page.url() } });
      return `Screenshot saved: ${shotName} (URL: ${page.url()})`;
    },
  },
  {
    name: "browser_extract",
    description: "استخراج محتوى محدد من الصفحة باستخدام CSS selectors (يرجع نص أو HTML).",
    danger: "safe",
    category: "browser",
    parameters: {
      type: "object",
      properties: {
        selector: { type: "string", description: "CSS selector للعناصر" },
        attribute: { type: "string", description: "'text', 'html', أو اسم attribute مثل 'href'", default: "text" },
      },
      required: ["selector"],
    },
    async execute(args) {
      const page = await session.ensure();
      const results = await page.$$eval(args.selector, (elements, attr) => {
        return elements.map(el => {
          if (attr === "text") return (el as HTMLElement).innerText;
          if (attr === "html") return el.innerHTML;
          return el.getAttribute(attr as string) || "";
        });
      }, args.attribute || "text");
      return JSON.stringify(results.slice(0, 50), null, 2);
    },
  },
  {
    name: "browser_close",
    description: "إغلاق المتصفح لتحرير الذاكرة.",
    danger: "safe",
    category: "browser",
    parameters: { type: "object", properties: {} },
    async execute() {
      await session.close();
      return "Browser closed";
    },
  },
  {
    name: "fetch_url",
    description: "جلب URL بسرعة بدون فتح متصفح (لـ APIs أو صفحات بسيطة).",
    danger: "safe",
    category: "network",
    parameters: {
      type: "object",
      properties: {
        url: { type: "string", description: "الرابط" },
        method: { type: "string", enum: ["GET", "POST"], default: "GET" },
        body: { type: "string", description: "JSON body لـ POST" },
      },
      required: ["url"],
    },
    async execute(args) {
      const res = await fetch(args.url, {
        method: args.method || "GET",
        body: args.body,
        headers: args.body ? { "Content-Type": "application/json" } : {},
      });
      const text = await res.text();
      return `Status: ${res.status}\nContent-Type: ${res.headers.get("content-type")}\n\n${text.slice(0, 5000)}${text.length > 5000 ? "\n...(truncated)" : ""}`;
    },
  },
];

export { session as browserSession };
