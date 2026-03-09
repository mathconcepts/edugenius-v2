#!/usr/bin/env bash
# ============================================================
# EduGenius — Railway PaaS Deployment
# ============================================================
# Deploys the full EduGenius stack to Railway.app:
#   - Backend service (Node 20)
#   - Railway Postgres plugin (managed)
#   - Railway Redis plugin (managed)
#
# Requirements:
#   - Railway CLI: npm i -g @railway/cli
#   - railway login
#   - A Railway project (created via dashboard or CLI)
#
# Usage:
#   ./scripts/deploy-railway.sh [--init] [--env-push] [--logs]
# ============================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
ENV_FILE="$PROJECT_ROOT/.env.railway"
RAILWAY_CONFIG="$PROJECT_ROOT/railway.json"

INIT_PROJECT=false
PUSH_ENV=false
SHOW_LOGS=false

for arg in "$@"; do
  case $arg in
    --init)    INIT_PROJECT=true ;;
    --env-push) PUSH_ENV=true ;;
    --logs)    SHOW_LOGS=true ;;
  esac
done

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
info()    { echo -e "${BLUE}[railway]${NC} $*"; }
success() { echo -e "${GREEN}[railway] ✅${NC} $*"; }
warn()    { echo -e "${YELLOW}[railway] ⚠️${NC} $*"; }
error()   { echo -e "${RED}[railway] ❌${NC} $*"; exit 1; }

info "EduGenius Railway Deployment"
echo "────────────────────────────────────────"

# ── Pre-flight ────────────────────────────────────────────────
command -v railway &>/dev/null || {
  error "Railway CLI not found. Install with: npm i -g @railway/cli"
}

railway whoami &>/dev/null || {
  error "Not logged in. Run: railway login"
}

RAILWAY_USER=$(railway whoami 2>/dev/null | head -1 || echo "unknown")
success "Logged in as: $RAILWAY_USER"

# ── Create railway.json config ────────────────────────────────
if [[ ! -f "$RAILWAY_CONFIG" ]]; then
  info "Creating railway.json config..."
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
  info "Initializing Railway project..."
  cd "$PROJECT_ROOT"
  railway init --name "edugenius"

  info "Adding Postgres plugin..."
  railway add --plugin postgresql

  info "Adding Redis plugin..."
  railway add --plugin redis

  success "Railway project initialized with Postgres + Redis plugins."
  info "Set environment variables next: ./scripts/deploy-railway.sh --env-push"
  exit 0
fi

# ── Push environment variables ────────────────────────────────
if $PUSH_ENV; then
  [[ ! -f "$ENV_FILE" ]] && error "No .env.railway found. Create it from deploy/railway.env.example"

  info "Pushing environment variables to Railway..."
  while IFS='=' read -r key value; do
    [[ "$key" =~ ^#.*$ ]] && continue
    [[ -z "$key" ]] && continue
    # Skip vars that Railway auto-injects
    [[ "$key" == "DATABASE_URL" ]] && continue
    [[ "$key" == "REDIS_URL" ]] && continue
    [[ "$key" == "PORT" ]] && continue

    railway variables set "$key=$value" 2>/dev/null || warn "Could not set $key"
  done < "$ENV_FILE"

  success "Environment variables pushed."
  exit 0
fi

# ── Show logs ─────────────────────────────────────────────────
if $SHOW_LOGS; then
  railway logs --tail
  exit 0
fi

# ── Deploy ────────────────────────────────────────────────────
info "Deploying to Railway..."
cd "$PROJECT_ROOT"

railway up --detach

DEPLOY_URL=$(railway status 2>/dev/null | grep -o 'https://[^[:space:]]*' | head -1 || echo "")

echo ""
echo "════════════════════════════════════════"
success "EduGenius deployed to Railway!"
echo ""
if [[ -n "$DEPLOY_URL" ]]; then
  echo "  🌐 URL:        $DEPLOY_URL"
fi
echo "  📊 Dashboard:  https://railway.app/dashboard"
echo ""
echo "  Logs:    ./scripts/deploy-railway.sh --logs"
echo "  Env:     railway variables"
echo "  Status:  railway status"
echo "════════════════════════════════════════"
