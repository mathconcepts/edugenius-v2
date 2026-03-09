#!/usr/bin/env bash
# ============================================================
# EduGenius — Hybrid Deployment
# ============================================================
# Runs the backend locally (Node or Docker) while using:
#   - Supabase for PostgreSQL DB
#   - Cloudinary (or S3) for media storage
#   - Redis locally via Docker
#
# Requirements:
#   - Docker Engine 24+
#   - Supabase project (free tier OK)
#   - SUPABASE_URL + SUPABASE_ANON_KEY + SUPABASE_SERVICE_KEY
#   - Optional: CLOUDINARY_URL or AWS S3 vars
#
# Usage:
#   ./scripts/deploy-hybrid.sh [--dev] [--down]
# ============================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
ENV_FILE="$PROJECT_ROOT/.env.hybrid"
ENV_EXAMPLE="$PROJECT_ROOT/deploy/hybrid.env.example"
COMPOSE_FILE="$PROJECT_ROOT/docker-compose.hybrid.yml"

DEV_MODE=false
BRING_DOWN=false

for arg in "$@"; do
  case $arg in
    --dev)  DEV_MODE=true ;;
    --down) BRING_DOWN=true ;;
  esac
done

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
info()    { echo -e "${BLUE}[hybrid]${NC} $*"; }
success() { echo -e "${GREEN}[hybrid] ✅${NC} $*"; }
warn()    { echo -e "${YELLOW}[hybrid] ⚠️${NC} $*"; }
error()   { echo -e "${RED}[hybrid] ❌${NC} $*"; exit 1; }

# ── Bring down ───────────────────────────────────────────────
if $BRING_DOWN; then
  info "Stopping hybrid services..."
  docker compose -f "$COMPOSE_FILE" down 2>/dev/null || true
  # Kill any local Node process
  pkill -f "tsx.*src/index" 2>/dev/null || true
  success "Hybrid services stopped."
  exit 0
fi

info "EduGenius Hybrid Deployment"
echo "────────────────────────────────────────"

# ── Pre-flight ────────────────────────────────────────────────
command -v docker &>/dev/null || error "Docker not found."
docker info &>/dev/null       || error "Docker daemon not running."

# ── Environment ───────────────────────────────────────────────
if [[ ! -f "$ENV_FILE" ]]; then
  if [[ -f "$ENV_EXAMPLE" ]]; then
    cp "$ENV_EXAMPLE" "$ENV_FILE"
    warn "Created $ENV_FILE from example. Fill in Supabase credentials and re-run."
    exit 0
  fi
  error "No .env.hybrid found. Copy deploy/hybrid.env.example to .env.hybrid and fill in values."
fi

set -a; source "$ENV_FILE"; set +a

[[ -z "${SUPABASE_URL:-}" ]]          && error "SUPABASE_URL is required in .env.hybrid"
[[ -z "${SUPABASE_ANON_KEY:-}" ]]     && error "SUPABASE_ANON_KEY is required in .env.hybrid"
[[ -z "${SUPABASE_SERVICE_KEY:-}" ]]  && error "SUPABASE_SERVICE_KEY is required in .env.hybrid"
[[ -z "${GEMINI_API_KEY:-}" ]]        && error "GEMINI_API_KEY is required in .env.hybrid"

success "Environment OK — using Supabase at ${SUPABASE_URL}"

# ── Write hybrid docker-compose (Redis only, no Postgres) ─────
cat > "$COMPOSE_FILE" <<'COMPOSEOF'
version: '3.9'
services:
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - hybrid_redis:/data
    restart: unless-stopped

volumes:
  hybrid_redis:
COMPOSEOF

info "Starting Redis..."
docker compose -f "$COMPOSE_FILE" up -d

export REDIS_URL="${REDIS_URL:-redis://localhost:6379}"
export DATABASE_URL="$SUPABASE_URL"

# ── Start backend ─────────────────────────────────────────────
if $DEV_MODE; then
  info "Starting backend in dev mode (tsx watch)..."
  cd "$PROJECT_ROOT"
  npx tsx watch src/index.ts
else
  info "Building backend..."
  cd "$PROJECT_ROOT"
  npm run build 2>/dev/null || warn "Build had warnings — check TypeScript errors"

  info "Starting backend in background..."
  nohup node dist/index.js > /tmp/edugenius-hybrid.log 2>&1 &
  BACKEND_PID=$!
  echo $BACKEND_PID > /tmp/edugenius-hybrid.pid

  sleep 3
  if kill -0 "$BACKEND_PID" 2>/dev/null; then
    success "Backend started (PID: $BACKEND_PID)"
  else
    error "Backend failed to start. Check /tmp/edugenius-hybrid.log"
  fi
fi

echo ""
echo "════════════════════════════════════════"
success "EduGenius Hybrid is running!"
echo ""
echo "  🔧 Backend API:   http://localhost:${PORT:-3000}"
echo "  🗄️  Database:     Supabase (${SUPABASE_URL})"
echo "  🔴 Redis:         localhost:6379 (Docker)"
echo ""
echo "  Logs:   tail -f /tmp/edugenius-hybrid.log"
echo "  Stop:   ./scripts/deploy-hybrid.sh --down"
echo "════════════════════════════════════════"
