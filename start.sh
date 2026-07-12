#!/usr/bin/env bash
# Aegis AI Agent - Quick Start Script
set -e

cd "$(dirname "$0")"

echo "🛡️  Aegis AI Agent - Starting..."
echo ""

# التحقق من Node.js
if ! command -v node &> /dev/null; then
  echo "❌ Node.js غير مثبت. ثبّته من https://nodejs.org"
  exit 1
fi

# تحميل .env لو موجود
if [ -f .env ]; then
  echo "✓ Loading .env"
  export $(cat .env | grep -v '^#' | grep -v '^$' | xargs)
fi

# التحقق من مفتاح واحد على الأقل
if [ -z "$ANTHROPIC_API_KEY" ] && [ -z "$OPENAI_API_KEY" ] && [ -z "$GROQ_API_KEY" ] && [ -z "$OPENROUTER_API_KEY" ]; then
  echo ""
  echo "⚠️  لم يتم العثور على أي مفتاح API"
  echo ""
  echo "الحل الأسرع (مجاني):"
  echo "  1) روح https://console.groq.com/keys"
  echo "  2) انسخ المفتاح"
  echo "  3) شغّل: export GROQ_API_KEY=gsk_..."
  echo "  4) أو أنشئ ملف .env وحط فيه: GROQ_API_KEY=gsk_..."
  echo ""
  read -p "عايز تفتح Groq دلوقتي؟ [y/N] " open_groq
  if [[ "$open_groq" =~ ^[Yy]$ ]]; then
    if command -v xdg-open &> /dev/null; then xdg-open https://console.groq.com/keys
    elif command -v open &> /dev/null; then open https://console.groq.com/keys
    fi
  fi
  echo ""
  read -p "الصق مفتاح Groq هنا (أو Enter للتخطي): " groq_key
  if [ ! -z "$groq_key" ]; then
    export GROQ_API_KEY="$groq_key"
    echo "GROQ_API_KEY=$groq_key" >> .env
    echo "✓ تم حفظ المفتاح في .env"
  else
    exit 1
  fi
fi

# تثبيت التبعيات لو محتاجة
if [ ! -d node_modules ]; then
  echo "📦 تثبيت التبعيات..."
  npm install
fi

# التحقق من Playwright
if [ ! -d node_modules/playwright/.local-browsers ] && [ ! -d ~/.cache/ms-playwright ]; then
  echo "🌐 تثبيت متصفح Chromium..."
  npx playwright install chromium
fi

# البناء
echo "🔨 البناء..."
npm run build

# التشغيل
echo ""
echo "🚀 بدء السيرفر..."
echo "   افتح http://localhost:${PORT:-3000} في المتصفح"
echo ""
node dist/server.js
