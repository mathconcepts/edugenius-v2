#!/usr/bin/env bash
# ============================================================
# EduGenius — Hybrid Deployment
# ============================================================
# Runs backend locally (Node or Docker) + cloud services:
#   - Supabase for PostgreSQL DB     (free tier)
#   - Supabase Storage or Cloudinary (free tier)
#   - Redis locally via Docker
#   - Frontend on Netlify (already configured)
#
# This is the CURRENT EduGenius setup:
#   Frontend: https://edugenius-ui.netlify.app
#   Database: https://tjcrhdavxkjjasfnrxtw.supabase.co
#
# INSTALLS automatically if missing:
#   - Docker Engine + Compose v2
#   - Node.js 20 LTS
#
# Usage:
#   ./scripts/deploy-hybrid.sh [--dev] [--down]
#
# Options:
#   --dev     Hot-reload mode (tsx watch)
#   --down    Stop local services
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

source "$SCRIPT_DIR/_install_common.sh"

info()    { echo -e "${BLUE}[hybrid]${NC} $*"; }
success() { echo -e "${GREEN}[hybrid] ✅${NC} $*"; }
warn()    { echo -e "${YELLOW}[hybrid] ⚠️${NC}  $*"; }
error()   { echo -e "${RED}[hybrid] ❌${NC} $*"; exit 1; }

# ── Bring down ───────────────────────────────────────────────
if $BRING_DOWN; then
  info "Stopping hybrid services..."
  docker compose -f "$COMPOSE_FILE" down 2>/dev/null || true
  if [[ -f /tmp/edugenius-hybrid.pid ]]; then
    PID=$(cat /tmp/edugenius-hybrid.pid)
    kill "$PID" 2>/dev/null || true
    rm -f /tmp/edugenius-hybrid.pid
  fi
  pkill -f "tsx.*src/index" 2>/dev/null || true
  success "Hybrid services stopped."
  exit 0
fi

echo ""
echo -e "${CYAN}╔══════════════════════════════════════╗${NC}"
echo -e "${CYAN}║   EduGenius — Hybrid Deployment      ║${NC}"
echo -e "${CYAN}║   Local backend + Supabase cloud     ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════╝${NC}"
echo ""

# ── Install missing dependencies ─────────────────────────────
info "Checking dependencies..."
ensure_curl
ensure_docker
ensure_node

# ── Environment file ─────────────────────────────────────────
if [[ ! -f "$ENV_FILE" ]]; then
  if [[ -f "$ENV_EXAMPLE" ]]; then
    cp "$ENV_EXAMPLE" "$ENV_FILE"
  else
    cat > "$ENV_FILE" <<'ENVEOF'
# ── Supabase (PostgreSQL + Storage) ───────────────────────────
# Get these from: https://supabase.com/dashboard/project/_/settings/api
SUPABASE_URL=https://tjcrhdavxkjjasfnrxtw.supabase.co
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_KEY=your_supabase_service_role_key

# ── LLM APIs ──────────────────────────────────────────────────
# Gemini: https://aistudio.google.com/app/apikey
GEMINI_API_KEY=your_gemini_api_key

# Anthropic (optional): https://console.anthropic.com/
# ANTHROPIC_API_KEY=your_anthropic_key

# Wolfram (optional): https://developer.wolframalpha.com/
# VITE_WOLFRAM_APP_ID=your_wolfram_app_id

# ── Local Backend ─────────────────────────────────────────────
PORT=3000
NODE_ENV=development
LOG_LEVEL=info
REDIS_URL=redis://localhost:6379

# ── Optional Media Storage ────────────────────────────────────
# Cloudinary: https://cloudinary.com/ (free tier available)
# CLOUDINARY_URL=cloudinary://api_key:api_secret@cloud_name
ENVEOF
  fi

  warn "Created $ENV_FILE"
  echo ""
  echo "  Where to get Supabase keys:"
  echo "    1. Go to https://supabase.com/dashboard"
  echo "    2. Select your project"
  echo "    3. Settings → API → copy Project URL + anon key + service_role key"
  echo ""
  echo "  Edit: nano $ENV_FILE"
  echo "  Then re-run: ./scripts/deploy-hybrid.sh"
  exit 0
fi

set -a; source "$ENV_FILE"; set +a

[[ -z "${SUPABASE_URL:-}" ]]         && error "SUPABASE_URL is required in $ENV_FILE"
[[ -z "${SUPABASE_ANON_KEY:-}" ]]    && error "SUPABASE_ANON_KEY is required in $ENV_FILE"
[[ -z "${SUPABASE_SERVICE_KEY:-}" ]] && error "SUPABASE_SERVICE_KEY is required in $ENV_FILE"
[[ -z "${GEMINI_API_KEY:-}" ]]       && error "GEMINI_API_KEY is required in $ENV_FILE"

success "Supabase: $SUPABASE_URL"
success "Gemini API key loaded"

# ── Write hybrid compose (Redis only) ───────────────────────
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
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 3

volumes:
  hybrid_redis:
COMPOSEOF

info "Starting Redis..."
docker compose -f "$COMPOSE_FILE" up -d
success "Redis running at localhost:6379"

# ── Install npm deps if needed ───────────────────────────────
if [[ ! -d "$PROJECT_ROOT/node_modules" ]]; then
  info "Installing npm dependencies..."
  cd "$PROJECT_ROOT" && npm install
fi

# ── Start backend ─────────────────────────────────────────────
cd "$PROJECT_ROOT"

if $DEV_MODE; then
  info "Starting backend in dev mode (hot reload)..."
  echo ""
  warn "Press Ctrl+C to stop."
  echo ""
  npx tsx watch src/index.ts
else
  info "Building backend..."
  npm run build 2>&1 | tail -5

  info "Starting backend in background..."
  nohup node dist/index.js > /tmp/edugenius-hybrid.log 2>&1 &
  BACKEND_PID=$!
  echo "$BACKEND_PID" > /tmp/edugenius-hybrid.pid

  sleep 3
  if kill -0 "$BACKEND_PID" 2>/dev/null; then
    success "Backend running (PID: $BACKEND_PID)"
  else
    error "Backend failed. Check: tail /tmp/edugenius-hybrid.log"
  fi
fi

echo ""
echo -e "${GREEN}════════════════════════════════════════${NC}"
success "EduGenius Hybrid is running!"
echo ""
echo "  🔧 Backend API:   http://localhost:${PORT:-3000}"
echo "  🗄️  Database:     Supabase cloud"
echo "  🔴 Redis:         localhost:6379 (Docker)"
echo "  🌐 Frontend:      https://edugenius-ui.netlify.app"
echo ""
echo "  📋 Logs:   tail -f /tmp/edugenius-hybrid.log"
echo "  🛑 Stop:   ./scripts/deploy-hybrid.sh --down"
echo "  🔄 Dev:    ./scripts/deploy-hybrid.sh --dev"
echo -e "${GREEN}════════════════════════════════════════${NC}"
