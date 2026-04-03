# ── GATE Math — Production Dockerfile ──────────────────────────────────────────
# Multi-stage build: install deps + build frontend, then run with tsx
# Usage:
#   docker build -t gate-math .
#   docker run -p 8080:8080 --env-file .env gate-math

# ── Stage 1: Build ────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

# Install root dependencies
COPY package.json package-lock.json ./
RUN npm ci

# Install frontend dependencies
COPY frontend/package.json frontend/package-lock.json ./frontend/
RUN cd frontend && npm ci

# Copy source
COPY . .

# Build frontend (Vite outputs to frontend/dist/)
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
RUN cd frontend && \
    VITE_SUPABASE_URL=${VITE_SUPABASE_URL} \
    VITE_SUPABASE_ANON_KEY=${VITE_SUPABASE_ANON_KEY} \
    npx vite build

# ── Stage 2: Production ──────────────────────────────────────────────────────
FROM node:20-alpine
WORKDIR /app

# Copy built frontend + backend source + deps
COPY --from=builder /app/package.json /app/package-lock.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/src ./src
COPY --from=builder /app/frontend/dist ./frontend/dist
COPY --from=builder /app/tsconfig.json ./

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:${PORT:-8080}/health || exit 1

EXPOSE ${PORT:-8080}
ENV NODE_ENV=production

CMD ["npx", "tsx", "src/gate-server.ts"]
