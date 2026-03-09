#!/usr/bin/env bash
# ============================================================
# EduGenius — Local Deployment
# ============================================================
# Runs everything locally via Docker Compose:
#   - Backend (Node 20 / TypeScript)
#   - Frontend (Nginx-served Vite build)
#   - Postgres 16 (Docker)
#   - Redis 7 (Docker)
#
# Requirements:
#   - Docker Engine 24+ with Compose v2 plugin
#   - Node 20+ and npm (for optional local dev mode)
#
# Usage:
#   ./scripts/deploy-local.sh [--dev] [--reset] [--down]
# ============================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
ENV_FILE="$PROJECT_ROOT/.env.local"
ENV_EXAMPLE="$PROJECT_ROOT/deploy/local.env.example"

DEV_MODE=false
RESET_DB=false
BRING_DOWN=false

# Parse args
for arg in "$@"; do
  case $arg in
    --dev)    DEV_MODE=true ;;
    --reset)  RESET_DB=true ;;
    --down)   BRING_DOWN=true ;;
  esac
done

# Colors
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
info()    { echo -e "${BLUE}[local]${NC} $*"; }
success() { echo -e "${GREEN}[local] ✅${NC} $*"; }
warn()    { echo -e "${YELLOW}[local] ⚠️${NC} $*"; }
error()   { echo -e "${RED}[local] ❌${NC} $*"; exit 1; }

# ── Bring down ──────────────────────────────────────────────
if $BRING_DOWN; then
  info "Stopping all local services..."
  docker compose -f "$PROJECT_ROOT/docker-compose.yml" down
  success "All services stopped."
  exit 0
fi

# ── Pre-flight checks ────────────────────────────────────────
info "EduGenius Local Deployment"
echo "────────────────────────────────────────"

command -v docker &>/dev/null  || error "Docker not found. Install from https://docs.docker.com/get-docker/"
docker info &>/dev/null        || error "Docker daemon not running. Start Docker first."
command -v docker compose &>/dev/null || \
  docker compose version &>/dev/null  || \
  error "Docker Compose v2 not found. Update Docker Desktop or install the plugin."

DOCKER_VER=$(docker version --format '{{.Client.Version}}' 2>/dev/null | cut -d. -f1)
if [[ "${DOCKER_VER:-0}" -lt 20 ]]; then
  warn "Docker version might be old. Recommend Docker Engine 20+."
fi

success "Docker OK"

# ── Environment file ─────────────────────────────────────────
if [[ ! -f "$ENV_FILE" ]]; then
  if [[ -f "$ENV_EXAMPLE" ]]; then
    info "No .env.local found — copying from example..."
    cp "$ENV_EXAMPLE" "$ENV_FILE"
    warn "Edit $ENV_FILE and add your API keys (GEMINI_API_KEY etc.) before starting."
    warn "Re-run this script after editing."
    exit 0
  else
    warn "No .env.local found and no example file. Creating minimal config..."
    cat > "$ENV_FILE" <<'ENVEOF'
NODE_ENV=development
DATABASE_URL=postgresql://edugenius:edugenius@db:5432/edugenius
REDIS_URL=redis://redis:6379
PORT=3000
LOG_LEVEL=info
# Add your API keys:
GEMINI_API_KEY=your_gemini_api_key_here
ANTHROPIC_API_KEY=your_anthropic_api_key_here
ENVEOF
    warn "Edit $ENV_FILE with your API keys, then re-run."
    exit 0
  fi
fi

# Check required vars
source "$ENV_FILE" 2>/dev/null || true
if [[ -z "${GEMINI_API_KEY:-}" ]] || [[ "${GEMINI_API_KEY}" == "your_gemini_api_key_here" ]]; then
  error "GEMINI_API_KEY is not set in $ENV_FILE. Please add your API key."
fi

success "Environment OK"

# ── Optional DB reset ─────────────────────────────────────────
if $RESET_DB; then
  warn "Resetting database volumes (all data will be lost)..."
  docker compose -f "$PROJECT_ROOT/docker-compose.yml" down -v 2>/dev/null || true
  success "Volumes cleared."
fi

# ── Build & launch ────────────────────────────────────────────
info "Building Docker images..."
docker compose -f "$PROJECT_ROOT/docker-compose.yml" build --no-cache

if $DEV_MODE; then
  info "Starting in development mode (logs attached)..."
  docker compose -f "$PROJECT_ROOT/docker-compose.yml" \
    --env-file "$ENV_FILE" \
    up
else
  info "Starting services in background..."
  docker compose -f "$PROJECT_ROOT/docker-compose.yml" \
    --env-file "$ENV_FILE" \
    up -d

  # Wait for backend to be healthy
  info "Waiting for backend to be ready..."
  for i in $(seq 1 30); do
    if curl -sf http://localhost:3000/health &>/dev/null; then
      break
    fi
    sleep 2
    echo -n "."
  done
  echo ""
fi

# ── Status ────────────────────────────────────────────────────
echo ""
echo "════════════════════════════════════════"
success "EduGenius is running locally!"
echo ""
echo "  🔧 Backend API:   http://localhost:3000"
echo "  🗄️  Postgres:     localhost:5432 (user: edugenius)"
echo "  🔴 Redis:         localhost:6379"
echo ""
echo "  Logs:   docker compose logs -f"
echo "  Stop:   ./scripts/deploy-local.sh --down"
echo "════════════════════════════════════════"
