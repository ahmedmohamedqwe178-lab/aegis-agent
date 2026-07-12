# نسخة خفيفة بدون Playwright - تشتغل على 512 MB RAM
FROM node:20-slim

WORKDIR /app

# Copy package files first
COPY package*.json ./

# Install production deps only (no Playwright browsers)
RUN npm install --omit=optional --omit=dev --no-audit --no-fund && npm cache clean --force

# Install dev deps for build
COPY tsconfig.json ./
COPY src ./src
RUN npm install typescript @types/node @types/express @types/ws --no-save --no-audit --no-fund && npx tsc

# Copy public assets
COPY public ./public

# Create workspace and generated dirs
RUN mkdir -p workspace generated

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

CMD ["node", "dist/server.js"]
