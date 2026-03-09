#!/usr/bin/env bash
# ============================================================
# EduGenius — Railway PaaS Deployment
# ============================================================
# Deploys EduGenius backend to Railway.app (zero-ops hosting):
#   - Backend service (Node 20 via Dockerfile)
#   - Railway Postgres plugin (managed, auto-configured)
#   - Railway Redis plugin (managed, auto-configured)
#
# INSTALLS automatically if missing:
#   - Node.js 20 LTS
#   - Railway CLI (@railway/cli)
#
# SETUP (one time):
#   1. Create a free Railway account: https://railway.app
#   2. Run: ./scripts/deploy-railway.sh --init
#   3. Set env vars: ./scripts/deploy-railway.sh --env-push
#   4. Deploy: ./scripts/deploy-railway.sh
#
# Usage:
#   ./scripts/deploy-railway.sh [--init] [--env-push] [--logs] [--status]
#
# Options:
#   --init      Create Railway project + add Postgres/Redis plugins
#   --env-push  Push env vars from .env.railway to Railway
#   --logs      Stream live logs from Railway
#   --status    Show current deployment status
# ============================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
ENV_FILE="$PROJECT_ROOT/.env.railway"
ENV_EXAMPLE="$PROJECT_ROOT/deploy/railway.env.example"
RAILWAY_CONFIG="$PROJECT_ROOT/railway.json"

INIT_PROJECT=false
PUSH_ENV=false
SHOW_LOGS=false
SHOW_STATUS=false

for arg in "$@"; do
  case $arg in
    --init)    INIT_PROJECT=true ;;
    --env-push) PUSH_ENV=true ;;
    --logs)    SHOW_LOGS=true ;;
    --status)  SHOW_STATUS=true ;;
  esac
done

source "$SCRIPT_DIR/_install_common.sh"

info()    { echo -e "${BLUE}[railway]${NC} $*"; }
success() { echo -e "${GREEN}[railway] ✅${NC} $*"; }
warn()    { echo -e "${YELLOW}[railway] ⚠️${NC}  $*"; }
error()   { echo -e "${RED}[railway] ❌${NC} $*"; exit 1; }

echo ""
echo -e "${CYAN}╔══════════════════════════════════════╗${NC}"
echo -e "${CYAN}║   EduGenius — Railway Deployment     ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════╝${NC}"
echo ""

# ── Install missing dependencies ─────────────────────────────
info "Checking dependencies..."
ensure_curl
ensure_node
ensure_railway

# ── Ensure railway.json exists ────────────────────────────────
if [[ ! -f "$RAILWAY_CONFIG" ]]; then
  info "Creating railway.json..."
  cat > "$RAILWAY_CONFIG" <<'RCONFIGEOF'
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "DOCKERFILE",
    "dockerfilePath": "Dockerfile"
  },
  "deploy": {
    "startCommand": "node dist/index.js",
    "healthcheckPath": "/health",
    "healthcheckTimeout": 30,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 3
  }
}
RCONFIGEOF
  success "Created railway.json"
fi

# ── Initialize project ────────────────────────────────────────
if $INIT_PROJECT; then
  echo ""
  info "Setting up Railway project for EduGenius..."
  echo ""
  echo "  This will:"
  echo "    1. Create a new Railway project named 'edugenius'"
  echo "    2. Add a managed Postgres database"
  echo "    3. Add a managed Redis instance"
  echo "  Railway auto-injects DATABASE_URL and REDIS_URL — no manual config needed."
  echo ""

  cd "$PROJECT_ROOT"
  railway init --name "edugenius"

  info "Adding Postgres plugin..."
  railway add --plugin postgresql
  success "Postgres added — DATABASE_URL will be auto-injected"

  info "Adding Redis plugin..."
  railway add --plugin redis
  success "Redis added — REDIS_URL will be auto-injected"

  echo ""
  echo "════════════════════════════════════════"
  success "Project initialized!"
  echo ""
  echo "  Next steps:"
  echo "    1. Create $ENV_FILE with your API keys"
  echo "    2. Run: ./scripts/deploy-railway.sh --env-push"
  echo "    3. Run: ./scripts/deploy-railway.sh"
  echo ""
  echo "  Example $ENV_FILE:"
  echo "    GEMINI_API_KEY=your_key"
  echo "    ANTHROPIC_API_KEY=your_key"
  echo "    NODE_ENV=production"
  echo "════════════════════════════════════════"
  exit 0
fi

# ── Push environment variables ────────────────────────────────
if $PUSH_ENV; then
  echo ""
  if [[ ! -f "$ENV_FILE" ]]; then
    if [[ -f "$ENV_EXAMPLE" ]]; then
      cp "$ENV_EXAMPLE" "$ENV_FILE"
      warn "Created $ENV_FILE from template."
      echo "  Fill in your API keys, then re-run: ./scripts/deploy-railway.sh --env-push"
      exit 0
    fi
    error "No $ENV_FILE found. Create it with your API keys (GEMINI_API_KEY, etc.)."
  fi

  info "Pushing environment variables to Railway..."
  echo "  (DATABASE_URL, REDIS_URL, and PORT are auto-managed by Railway — skipping)"
  echo ""

  PUSHED=0
  while IFS= read -r line; do
    # Skip comments and blank lines
    [[ "$line" =~ ^#.*$ || -z "$line" ]] && continue

    key="${line%%=*}"
    value="${line#*=}"

    # Skip Railway-managed vars
    [[ "$key" =~ ^(DATABASE_URL|REDIS_URL|PORT|RAILWAY_.*)$ ]] && continue

    if railway variables set "${key}=${value}" --quiet 2>/dev/null; then
      info "Set: $key"
      ((PUSHED++))
    else
      warn "Could not set: $key"
    fi
  done < "$ENV_FILE"

  echo ""
  success "Pushed $PUSHED variables to Railway."
  echo "  Verify in dashboard: https://railway.app/dashboard"
  exit 0
fi

# ── Show logs ─────────────────────────────────────────────────
if $SHOW_LOGS; then
  info "Streaming Railway logs (Ctrl+C to stop)..."
  railway logs --tail
  exit 0
fi

# ── Show status ───────────────────────────────────────────────
if $SHOW_STATUS; then
  info "Railway deployment status:"
  echo ""
  railway status
  echo ""
  railway variables list 2>/dev/null | grep -v "SECRET\|KEY\|PASSWORD" || true
  exit 0
fi

# ── Deploy ────────────────────────────────────────────────────
echo ""
info "Deploying EduGenius to Railway..."
info "This builds your Docker image on Railway's servers and deploys it."
echo ""

# Check if project is linked
if ! railway status &>/dev/null; then
  warn "No Railway project linked. Run first: ./scripts/deploy-railway.sh --init"
  exit 1
fi

cd "$PROJECT_ROOT"
railway up --detach

# Get the deployed URL
sleep 5
DEPLOY_URL=$(railway status 2>/dev/null | grep -o 'https://[^[:space:]]*' | head -1 || echo "")

echo ""
echo -e "${GREEN}════════════════════════════════════════${NC}"
success "EduGenius deployed to Railway!"
echo ""
if [[ -n "$DEPLOY_URL" ]]; then
  echo "  🌐 URL:        $DEPLOY_URL"
  echo "  ❤️  Health:    ${DEPLOY_URL}/health"
fi
echo "  📊 Dashboard:  https://railway.app/dashboard"
echo ""
echo "  📋 Logs:    ./scripts/deploy-railway.sh --logs"
echo "  📈 Status:  ./scripts/deploy-railway.sh --status"
echo "  ⚙️  Env:     railway variables"
echo ""
echo "  💡 Auto-deploy on git push:"
echo "     railway link && git push origin main"
echo -e "${GREEN}════════════════════════════════════════${NC}"
