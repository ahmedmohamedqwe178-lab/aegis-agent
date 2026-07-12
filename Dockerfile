FROM mcr.microsoft.com/playwright:v1.45.0-jammy

WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Install dev deps for build
COPY tsconfig.json ./
COPY src ./src
RUN npm install typescript @types/node @types/express @types/ws --no-save && npx tsc

# Copy public assets
COPY public ./public

# Create workspace and generated dirs
RUN mkdir -p workspace generated

# Environment
ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

CMD ["node", "dist/server.js"]
