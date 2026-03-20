# ─── Builder ─────────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies first (layer-cached unless package files change)
COPY package*.json ./
RUN npm ci

# Compile TypeScript
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# tsc only emits .js/.d.ts — copy non-TS assets that the runtime reads
RUN cp src/billing/schema.sql dist/billing/schema.sql

# ─── Production ───────────────────────────────────────────────────────────────
FROM node:20-alpine AS production

WORKDIR /app

# Production dependencies only
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Compiled output from builder
COPY --from=builder /app/dist ./dist

# Run as non-root
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

# Railway injects PORT at runtime; 3000 is the fallback default in config.ts
EXPOSE 3000

CMD ["node", "dist/index.js"]
