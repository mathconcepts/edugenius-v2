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
# INSTALLS automatically if missing:
#   - Docker Engine + Compose v2
#   - Node.js 20 LTS (for dev mode)
#
# Usage:
#   ./scripts/deploy-local.sh [--dev] [--reset] [--down]
#
# Options:
#   --dev     Start with live-reload (tsx watch, logs attached)
#   --reset   Wipe the Postgres volume (fresh DB)
#   --down    Stop all services
# ============================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
ENV_FILE="$PROJECT_ROOT/.env.local"
ENV_EXAMPLE="$PROJECT_ROOT/deploy/local.env.example"

DEV_MODE=false
RESET_DB=false
BRING_DOWN=false

for arg in "$@"; do
  case $arg in
    --dev)    DEV_MODE=true ;;
    --reset)  RESET_DB=true ;;
    --down)   BRING_DOWN=true ;;
  esac
done

# ── Load shared installers ────────────────────────────────────
# shellcheck source=./_install_common.sh
source "$SCRIPT_DIR/_install_common.sh"

# Override colors with deploy-local prefix
info()    { echo -e "${BLUE}[local]${NC} $*"; }
success() { echo -e "${GREEN}[local] ✅${NC} $*"; }
warn()    { echo -e "${YELLOW}[local] ⚠️${NC}  $*"; }
error()   { echo -e "${RED}[local] ❌${NC} $*"; exit 1; }

# ── Bring down ───────────────────────────────────────────────
if $BRING_DOWN; then
  info "Stopping all local services..."
  docker compose -f "$PROJECT_ROOT/docker-compose.yml" down 2>/dev/null || true
  pkill -f "tsx.*src/index" 2>/dev/null || true
  success "All services stopped."
  exit 0
fi

echo ""
echo -e "${CYAN}╔══════════════════════════════════════╗${NC}"
echo -e "${CYAN}║   EduGenius — Local Deployment       ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════╝${NC}"
echo ""

# ── Install missing dependencies ─────────────────────────────
info "Checking dependencies..."
ensure_curl
ensure_docker
$DEV_MODE && ensure_node

# ── Environment file ─────────────────────────────────────────
if [[ ! -f "$ENV_FILE" ]]; then
  if [[ -f "$ENV_EXAMPLE" ]]; then
    info "No .env.local found — copying from template..."
    cp "$ENV_EXAMPLE" "$ENV_FILE"
  else
    info "Creating .env.local with defaults..."
    cat > "$ENV_FILE" <<'ENVEOF'
NODE_ENV=development
DATABASE_URL=postgresql://edugenius:edugenius@db:5432/edugenius
REDIS_URL=redis://redis:6379
PORT=3000
LOG_LEVEL=info

# ── Required API Keys ──────────────────────────────────────
# Get from: https://aistudio.google.com/app/apikey
GEMINI_API_KEY=your_gemini_api_key_here

# Get from: https://console.anthropic.com/
ANTHROPIC_API_KEY=your_anthropic_api_key_here

# Get from: https://developer.wolframalpha.com/
# VITE_WOLFRAM_APP_ID=your_wolfram_app_id_here

# ── Optional ──────────────────────────────────────────────
# JWT_SECRET=change_this_in_production
# TAVILY_API_KEY=your_tavily_key
ENVEOF
  fi

  warn "Created $ENV_FILE"
  warn "Please open it and fill in your API keys, then re-run this script."
  echo ""
  echo "  Edit: nano $ENV_FILE"
  echo "  Then: ./scripts/deploy-local.sh"
  exit 0
fi

# Check for placeholder API key
set -a; source "$ENV_FILE" 2>/dev/null; set +a
if [[ -z "${GEMINI_API_KEY:-}" ]] || [[ "${GEMINI_API_KEY}" == "your_gemini_api_key_here" ]]; then
  warn "GEMINI_API_KEY is not set in $ENV_FILE"
  echo ""
  echo "  1. Get your free key at: https://aistudio.google.com/app/apikey"
  echo "  2. Edit: nano $ENV_FILE"
  echo "  3. Set:  GEMINI_API_KEY=your_actual_key"
  echo "  4. Re-run this script"
  echo ""
  error "API key required to start."
fi
success "Environment loaded from $ENV_FILE"

# ── Optional DB reset ────────────────────────────────────────
if $RESET_DB; then
  warn "Resetting database volumes (all data will be lost)..."
  docker compose -f "$PROJECT_ROOT/docker-compose.yml" down -v 2>/dev/null || true
  success "Volumes cleared — fresh database will be created."
fi

# ── Build & launch ───────────────────────────────────────────
if $DEV_MODE; then
  # Dev mode: Docker for Postgres+Redis only, Node locally for hot reload
  info "Starting Postgres + Redis via Docker..."
  docker compose -f "$PROJECT_ROOT/docker-compose.yml" up -d db redis

  info "Installing npm dependencies..."
  cd "$PROJECT_ROOT" && npm install

  info "Starting backend in dev mode (hot reload)..."
  echo ""
  warn "Press Ctrl+C to stop."
  echo ""
  DATABASE_URL="postgresql://edugenius:edugenius@localhost:5432/edugenius" \
  REDIS_URL="redis://localhost:6379" \
    npx tsx watch src/index.ts
else
  info "Building Docker images..."
  docker compose -f "$PROJECT_ROOT/docker-compose.yml" build

  info "Starting all services..."
  docker compose -f "$PROJECT_ROOT/docker-compose.yml" \
    --env-file "$ENV_FILE" \
    up -d

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

echo ""
echo -e "${GREEN}════════════════════════════════════════${NC}"
success "EduGenius is running locally!"
echo ""
echo "  🔧 Backend API:   http://localhost:3000"
echo "  🗄️  Postgres:     localhost:5432  (user: edugenius)"
echo "  🔴 Redis:         localhost:6379"
echo ""
echo "  📋 Logs:   docker compose logs -f"
echo "  🛑 Stop:   ./scripts/deploy-local.sh --down"
echo "  🔄 Reset:  ./scripts/deploy-local.sh --reset"
echo -e "${GREEN}════════════════════════════════════════${NC}"
