#!/usr/bin/env bash
# ============================================================
# EduGenius — Dependency Audit & Install
# ============================================================
# Scans ALL dependencies for the current EduGenius configuration:
#
#   LAYER 1 — System tools      (Docker, Node, Python, gcloud, etc.)
#   LAYER 2 — Node.js backend   (package.json + devDependencies)
#   LAYER 3 — Frontend (React)  (frontend/package.json)
#   LAYER 4 — Python / Manim    (manim-service: FastAPI, Manim, LaTeX)
#   LAYER 5 — API credentials   (.env files — checks presence, not values)
#   LAYER 6 — Cloud CLIs        (aws, gcloud, railway — only if used)
#   LAYER 7 — Docker images     (Postgres 16, Redis 7, Node 20)
#
# Modes:
#   (default)     Audit only — show what's missing, don't install anything
#   --install     Ask before installing each missing item
#   --install-all Install everything missing without individual prompts
#   --json        Output results as JSON (for scripting)
#   --fix         Alias for --install
#
# Usage:
#   ./scripts/check-deps.sh               # Audit all deps
#   ./scripts/check-deps.sh --install     # Audit + guided install
#   ./scripts/check-deps.sh --install-all # Audit + install all missing
#   ./scripts/check-deps.sh --json        # Machine-readable output
#   ./scripts/check-deps.sh --layer system   # Only check system tools
#   ./scripts/check-deps.sh --layer python   # Only check Python/Manim
# ============================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# ── Mode flags ────────────────────────────────────────────────
MODE="audit"           # audit | install | install-all
JSON_OUTPUT=false
LAYER_FILTER=""        # empty = all layers

while [[ $# -gt 0 ]]; do
  case "$1" in
    --install)      MODE="install" ;;
    --install-all)  MODE="install-all" ;;
    --fix)          MODE="install" ;;
    --json)         JSON_OUTPUT=true ;;
    --layer)        shift; LAYER_FILTER="${1:-}" ;;
    --layer=*)      LAYER_FILTER="${1#--layer=}" ;;
  esac
  shift
done

# ── Colors ────────────────────────────────────────────────────
if $JSON_OUTPUT; then
  RED=''; GREEN=''; YELLOW=''; BLUE=''; CYAN=''; BOLD=''; NC=''
else
  RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
  BLUE='\033[0;34m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'
fi

# ── Tracking arrays ───────────────────────────────────────────
CHECKS_TOTAL=0
CHECKS_OK=0
CHECKS_WARN=0
CHECKS_FAIL=0
declare -a MISSING_ITEMS=()
declare -a WARN_ITEMS=()
declare -a JSON_RESULTS=()

# ── Helpers ───────────────────────────────────────────────────
section() {
  $JSON_OUTPUT && return
  echo ""
  echo -e "${CYAN}${BOLD}━━━ $* ━━━${NC}"
}

ok() {
  local label="$1" detail="${2:-}"
  CHECKS_TOTAL=$((CHECKS_TOTAL + 1)); CHECKS_OK=$((CHECKS_OK + 1))
  $JSON_OUTPUT || echo -e "  ${GREEN}✅${NC} ${label}${detail:+  ${detail}}"
  JSON_RESULTS+=("{\"check\":\"$label\",\"status\":\"ok\",\"detail\":\"$detail\"}")
}

warn_check() {
  local label="$1" detail="${2:-}" fix="${3:-}"
  CHECKS_TOTAL=$((CHECKS_TOTAL + 1)); CHECKS_WARN=$((CHECKS_WARN + 1))
  WARN_ITEMS+=("$label|$detail|$fix")
  $JSON_OUTPUT || echo -e "  ${YELLOW}⚠️ ${NC} ${label}${detail:+  — ${YELLOW}${detail}${NC}}"
  JSON_RESULTS+=("{\"check\":\"$label\",\"status\":\"warn\",\"detail\":\"$detail\",\"fix\":\"$fix\"}")
}

fail_check() {
  local label="$1" detail="${2:-}" fix="${3:-}"
  CHECKS_TOTAL=$((CHECKS_TOTAL + 1)); CHECKS_FAIL=$((CHECKS_FAIL + 1))
  MISSING_ITEMS+=("$label|$detail|$fix")
  $JSON_OUTPUT || echo -e "  ${RED}❌${NC} ${label}${detail:+  — ${detail}}"
  JSON_RESULTS+=("{\"check\":\"$label\",\"status\":\"fail\",\"detail\":\"$detail\",\"fix\":\"$fix\"}")
}

ver() { node -e "process.exit(0)" 2>/dev/null && node -e "console.log(process.version)" || echo "n/a"; }

# ── Source shared installer ───────────────────────────────────
# shellcheck source=./_install_common.sh
source "$SCRIPT_DIR/_install_common.sh" 2>/dev/null || {
  echo "ERROR: _install_common.sh not found. Run from the scripts/ directory."
  exit 1
}

# ── Consent helper ────────────────────────────────────────────
ask_install() {
  local label="$1" install_fn="$2"
  if [[ "$MODE" == "install-all" ]]; then
    echo -e "  ${BLUE}→ Installing ${label}...${NC}"
    "$install_fn" && return 0 || return 1
  elif [[ "$MODE" == "install" ]]; then
    echo ""
    echo -e "  ${YELLOW}Missing:${NC} $label"
    read -rp "  Install now? [Y/n] " choice
    choice="${choice:-Y}"
    if [[ "$choice" =~ ^[Yy]$ ]]; then
      "$install_fn" && return 0 || return 1
    else
      echo "  Skipped."
      return 1
    fi
  fi
  return 1  # audit mode — never install
}

# ══════════════════════════════════════════════════════════════
# LAYER 1 — System Tools
# ══════════════════════════════════════════════════════════════
check_system_tools() {
  section "LAYER 1 — System Tools"

  # ── Node.js ────────────────────────────────────────────────
  if command -v node &>/dev/null; then
    NODE_VER=$(node --version)
    NODE_MAJOR=$(echo "$NODE_VER" | tr -d 'v' | cut -d. -f1)
    if [[ "$NODE_MAJOR" -ge 20 ]]; then
      ok "Node.js" "$NODE_VER"
    elif [[ "$NODE_MAJOR" -ge 18 ]]; then
      warn_check "Node.js" "$NODE_VER (18+ OK, 20+ recommended)" "install_node"
    else
      fail_check "Node.js" "$NODE_VER (too old, need 18+)" "install_node"
      ask_install "Node.js 20 LTS" install_node || true
    fi
  else
    fail_check "Node.js" "not installed (need v18+)" "install_node"
    ask_install "Node.js 20 LTS" install_node || true
  fi

  # ── npm ──────────────────────────────────────────────────
  if command -v npm &>/dev/null; then
    NPM_VER=$(npm --version)
    ok "npm" "v$NPM_VER"
  else
    fail_check "npm" "not found (comes with Node.js)" "install_node"
  fi

  # ── Docker ───────────────────────────────────────────────
  if command -v docker &>/dev/null; then
    DOCKER_VER=$(docker --version | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1)
    DOCKER_MAJOR=$(echo "$DOCKER_VER" | cut -d. -f1)
    if [[ "$DOCKER_MAJOR" -ge 24 ]]; then
      ok "Docker Engine" "v$DOCKER_VER"
    else
      warn_check "Docker Engine" "v$DOCKER_VER (24+ recommended)" "install_docker"
    fi

    if docker info &>/dev/null; then
      ok "Docker daemon" "running"
    else
      warn_check "Docker daemon" "not running" "sudo systemctl start docker"
    fi

    if docker compose version &>/dev/null; then
      COMPOSE_VER=$(docker compose version --short 2>/dev/null || echo "v2")
      ok "Docker Compose v2" "$COMPOSE_VER"
    else
      fail_check "Docker Compose v2" "not found (needed for local deploy)" "install_docker"
    fi
  else
    fail_check "Docker" "not installed" "install_docker"
    ask_install "Docker Engine" install_docker || true
  fi

  # ── Git ──────────────────────────────────────────────────
  if command -v git &>/dev/null; then
    GIT_VER=$(git --version | awk '{print $3}')
    ok "Git" "v$GIT_VER"
  else
    fail_check "Git" "not installed" "apt-get install -y git"
  fi

  # ── curl ─────────────────────────────────────────────────
  if command -v curl &>/dev/null; then
    ok "curl" "$(curl --version | head -1 | cut -d' ' -f2)"
  else
    fail_check "curl" "not installed" "apt-get install -y curl"
    detect_os; [[ "$MODE" != "audit" ]] && ensure_curl || true
  fi

  # ── Python 3 (for Manim service) ─────────────────────────
  if command -v python3 &>/dev/null; then
    PY_VER=$(python3 --version 2>&1 | awk '{print $2}')
    PY_MAJOR=$(echo "$PY_VER" | cut -d. -f1)
    PY_MINOR=$(echo "$PY_VER" | cut -d. -f2)
    if [[ "$PY_MAJOR" -ge 3 && "$PY_MINOR" -ge 9 ]]; then
      ok "Python 3" "v$PY_VER (Manim service)"
    else
      warn_check "Python 3" "v$PY_VER (Manim needs 3.9+)" "install via system package manager"
    fi
  else
    warn_check "Python 3" "not found (only needed for Manim visualisation service)" "apt-get install -y python3 python3-pip"
  fi

  # ── pip ──────────────────────────────────────────────────
  if command -v pip3 &>/dev/null || command -v pip &>/dev/null; then
    PIP_VER=$(pip3 --version 2>/dev/null | awk '{print $2}' || pip --version | awk '{print $2}')
    ok "pip" "v$PIP_VER"
  else
    warn_check "pip" "not found (needed for Manim Python deps)" "apt-get install -y python3-pip"
  fi
}

# ══════════════════════════════════════════════════════════════
# LAYER 2 — Node.js Backend Dependencies
# ══════════════════════════════════════════════════════════════
check_node_backend() {
  section "LAYER 2 — Node.js Backend (package.json)"

  BACKEND_PKG="$PROJECT_ROOT/package.json"
  [[ ! -f "$BACKEND_PKG" ]] && { warn_check "package.json" "not found at $PROJECT_ROOT"; return; }

  # Check node_modules
  if [[ -d "$PROJECT_ROOT/node_modules" ]]; then
    MOD_COUNT=$(ls "$PROJECT_ROOT/node_modules" | wc -l | tr -d ' ')
    ok "node_modules" "$MOD_COUNT packages installed"
  else
    fail_check "node_modules" "not installed — run: npm install" "npm install"
    if [[ "$MODE" != "audit" ]]; then
      echo ""
      read -rp "  Run 'npm install' now? [Y/n] " choice
      choice="${choice:-Y}"
      if [[ "$choice" =~ ^[Yy]$ ]]; then
        cd "$PROJECT_ROOT" && npm install && ok "node_modules" "installed"
      fi
    fi
    return
  fi

  # Check each production dependency (use python3 to parse JSON — avoids ESM issues)
  local deps=()
  while IFS= read -r line; do
    [[ -n "$line" ]] && deps+=("$line")
  done < <(python3 -c "
import json
with open('$BACKEND_PKG') as f:
    p = json.load(f)
deps = {**p.get('dependencies',{}), **p.get('devDependencies',{})}
for k in deps: print(k)
  " 2>/dev/null || echo "")

  local MISSING_DEPS=()
  for dep in "${deps[@]:-}"; do
    [[ -z "$dep" ]] && continue
    if [[ -d "$PROJECT_ROOT/node_modules/$dep" ]]; then
      local installed_ver
      installed_ver=$(python3 -c "
import json, sys
try:
    with open('$PROJECT_ROOT/node_modules/$dep/package.json') as f:
        print(json.load(f).get('version','?'))
except: print('?')
" 2>/dev/null || echo "?")
      ok "npm: $dep" "v$installed_ver"
    else
      fail_check "npm: $dep" "missing from node_modules" "npm install"
      MISSING_DEPS+=("$dep")
    fi
  done

  if [[ ${#MISSING_DEPS[@]} -gt 0 ]]; then
    echo ""
    if [[ "$MODE" != "audit" ]]; then
      read -rp "  Install ${#MISSING_DEPS[@]} missing backend package(s)? [Y/n] " choice
      choice="${choice:-Y}"
      [[ "$choice" =~ ^[Yy]$ ]] && cd "$PROJECT_ROOT" && npm install
    fi
  fi

  # Check TypeScript build
  if [[ -d "$PROJECT_ROOT/dist" ]]; then
    DIST_COUNT=$(find "$PROJECT_ROOT/dist" -name "*.js" | wc -l | tr -d ' ')
    ok "TypeScript build (dist/)" "$DIST_COUNT .js files"
  else
    warn_check "TypeScript build" "not built yet — run: npm run build" "npm run build"
  fi
}

# ══════════════════════════════════════════════════════════════
# LAYER 3 — Frontend (React/Vite) Dependencies
# ══════════════════════════════════════════════════════════════
check_frontend() {
  section "LAYER 3 — Frontend (React + Vite)"

  FRONTEND_DIR="$PROJECT_ROOT/frontend"
  [[ ! -d "$FRONTEND_DIR" ]] && { warn_check "frontend/" "directory not found"; return; }
  [[ ! -f "$FRONTEND_DIR/package.json" ]] && { warn_check "frontend/package.json" "not found"; return; }

  if [[ -d "$FRONTEND_DIR/node_modules" ]]; then
    MOD_COUNT=$(ls "$FRONTEND_DIR/node_modules" | wc -l | tr -d ' ')
    ok "frontend/node_modules" "$MOD_COUNT packages"
  else
    fail_check "frontend/node_modules" "not installed — run: cd frontend && npm install" "cd frontend && npm install"
    if [[ "$MODE" != "audit" ]]; then
      read -rp "  Install frontend dependencies? [Y/n] " choice
      choice="${choice:-Y}"
      if [[ "$choice" =~ ^[Yy]$ ]]; then
        cd "$FRONTEND_DIR" && npm install && ok "frontend/node_modules" "installed"
      fi
    fi
    return
  fi

  # Key frontend deps
  local key_fe_deps=(
    "react" "react-dom" "react-router-dom"
    "@supabase/supabase-js"
    "@tanstack/react-query"
    "zustand"
    "framer-motion"
    "recharts"
    "katex" "react-markdown"
    "lucide-react"
    "tailwindcss" "vite"
  )

  for dep in "${key_fe_deps[@]}"; do
    if [[ -d "$FRONTEND_DIR/node_modules/$dep" ]]; then
      local ver
      ver=$(python3 -c "
import json
try:
    with open('$FRONTEND_DIR/node_modules/$dep/package.json') as f:
        print(json.load(f).get('version','?'))
except: print('?')
" 2>/dev/null || echo "?")
      ok "npm (frontend): $dep" "v$ver"
    else
      fail_check "npm (frontend): $dep" "missing" "cd frontend && npm install"
    fi
  done

  # Check built frontend
  if [[ -d "$FRONTEND_DIR/dist" ]]; then
    ok "Frontend build (frontend/dist/)" "built"
  else
    warn_check "Frontend build" "not built — run: cd frontend && npm run build" "cd frontend && npm run build"
  fi
}

# ══════════════════════════════════════════════════════════════
# LAYER 4 — Python / Manim Service
# ══════════════════════════════════════════════════════════════
check_python_manim() {
  section "LAYER 4 — Python / Manim Visualisation Service"

  MANIM_DIR="$PROJECT_ROOT/manim-service"
  if [[ ! -d "$MANIM_DIR" ]]; then
    warn_check "manim-service/" "directory not found — Manim optional"
    return
  fi

  # Python packages required by manim-service/main.py
  local py_packages=("fastapi" "uvicorn" "pydantic" "manim" "numpy")
  local missing_py=()

  for pkg in "${py_packages[@]}"; do
    # Use timeout to avoid slow imports (manim can take 10-15s to initialise)
    if timeout 20 python3 -c "import $pkg" 2>/dev/null; then
      local py_ver
      py_ver=$(timeout 5 python3 -c "
import importlib.metadata as m
try: print(m.version('$pkg'))
except: print('installed')
" 2>/dev/null || echo "installed")
      ok "Python: $pkg" "$py_ver"
    else
      fail_check "Python: $pkg" "not installed" "pip3 install $pkg"
      missing_py+=("$pkg")
    fi
  done

  # System packages for Manim (LaTeX + Cairo + FFmpeg)
  local sys_tools=(
    "ffmpeg:ffmpeg"
    "pdflatex:texlive-latex-base"
    "latex:texlive-latex-extra"
  )

  for entry in "${sys_tools[@]}"; do
    cmd="${entry%%:*}"
    pkg="${entry##*:}"
    if command -v "$cmd" &>/dev/null; then
      ok "System: $cmd" "($pkg)"
    else
      warn_check "System: $cmd" "not found — needed for Manim animations" "apt-get install -y $pkg"
    fi
  done

  # Cairo (imported by Manim)
  if timeout 10 python3 -c "import cairo" 2>/dev/null; then
    ok "Python: cairo (pycairo)" "installed"
  else
    warn_check "Python: cairo" "not found — needed by Manim" "pip3 install pycairo && apt-get install -y libcairo2-dev"
  fi

  # Install missing Python packages
  if [[ ${#missing_py[@]} -gt 0 && "$MODE" != "audit" ]]; then
    echo ""
    echo -e "  ${YELLOW}Missing Python packages:${NC} ${missing_py[*]}"
    read -rp "  Install them via pip3? [Y/n] " choice
    choice="${choice:-Y}"
    if [[ "$choice" =~ ^[Yy]$ ]]; then
      pip3 install "${missing_py[@]}"
      echo ""
      success "Python packages installed."
    fi
  fi
}

# ══════════════════════════════════════════════════════════════
# LAYER 5 — API Credentials (.env files)
# ══════════════════════════════════════════════════════════════
check_credentials() {
  section "LAYER 5 — API Credentials & Environment"

  # Determine active env file
  local env_candidates=(
    "$PROJECT_ROOT/.env.local"
    "$PROJECT_ROOT/.env.hybrid"
    "$PROJECT_ROOT/.env.production"
    "$PROJECT_ROOT/.env"
  )

  local active_env=""
  for f in "${env_candidates[@]}"; do
    [[ -f "$f" ]] && { active_env="$f"; break; }
  done

  if [[ -n "$active_env" ]]; then
    ok "Environment file" "$(basename "$active_env")"
    set -a; source "$active_env" 2>/dev/null; set +a
  else
    warn_check "Environment file" "no .env file found — copy from deploy/*.env.example" "cp deploy/local.env.example .env.local"
  fi

  # Required credentials
  check_cred() {
    local var="$1" label="$2" url="$3"
    local val="${!var:-}"
    if [[ -z "$val" || "$val" == *"your_"* || "$val" == *"_here"* ]]; then
      fail_check "Credential: $var" "not set or placeholder — get at: $url" ""
    else
      # Show only first 8 chars + masked
      local masked="${val:0:8}..."
      ok "Credential: $var" "$masked (${label})"
    fi
  }

  check_cred "GEMINI_API_KEY"        "Google Gemini"        "https://aistudio.google.com/app/apikey"
  check_cred "ANTHROPIC_API_KEY"     "Anthropic Claude"     "https://console.anthropic.com/"

  # Supabase (conditional)
  local SUPABASE_URL="${SUPABASE_URL:-}"
  if [[ -n "$SUPABASE_URL" ]]; then
    check_cred "SUPABASE_URL"         "Supabase project URL"  "https://supabase.com/dashboard"
    check_cred "SUPABASE_ANON_KEY"    "Supabase anon key"     "https://supabase.com/dashboard"
    check_cred "SUPABASE_SERVICE_KEY" "Supabase service key"  "https://supabase.com/dashboard"
  else
    warn_check "Supabase credentials" "not configured (needed for hybrid/cloud mode)" "see deploy/hybrid.env.example"
  fi

  # Wolfram (optional)
  local WOLFRAM_APP_ID="${VITE_WOLFRAM_APP_ID:-}"
  if [[ -n "$WOLFRAM_APP_ID" && "$WOLFRAM_APP_ID" != *"your_"* ]]; then
    ok "Credential: VITE_WOLFRAM_APP_ID" "${WOLFRAM_APP_ID:0:8}... (Wolfram Alpha)"
  else
    warn_check "Credential: VITE_WOLFRAM_APP_ID" "not set — activates Wolfram math engine" "https://developer.wolframalpha.com/"
  fi

  # Tavily (optional)
  local TAVILY_KEY="${TAVILY_API_KEY:-}"
  if [[ -n "$TAVILY_KEY" && "$TAVILY_KEY" != *"your_"* ]]; then
    ok "Credential: TAVILY_API_KEY" "${TAVILY_KEY:0:8}... (Scout search)"
  else
    warn_check "Credential: TAVILY_API_KEY" "not set — Scout uses web search" "https://tavily.com/"
  fi
}

# ══════════════════════════════════════════════════════════════
# LAYER 6 — Cloud CLIs (only checked if .env file present)
# ══════════════════════════════════════════════════════════════
check_cloud_clis() {
  section "LAYER 6 — Cloud CLI Tools"

  # AWS CLI
  if command -v aws &>/dev/null; then
    AWS_VER=$(aws --version 2>&1 | cut -d' ' -f1 | cut -d'/' -f2)
    ok "AWS CLI" "v$AWS_VER"
    if aws sts get-caller-identity &>/dev/null; then
      AWS_ACCT=$(aws sts get-caller-identity --query Account --output text 2>/dev/null || echo "?")
      ok "AWS credentials" "Account: $AWS_ACCT"
    else
      warn_check "AWS credentials" "not configured — run: aws configure" "aws configure"
    fi
  else
    warn_check "AWS CLI" "not installed (only needed for AWS deployment)" "run: ./scripts/deploy-aws.sh --setup"
  fi

  # gcloud CLI
  if command -v gcloud &>/dev/null; then
    GCLOUD_VER=$(gcloud --version 2>/dev/null | head -1 | awk '{print $4}')
    ok "gcloud CLI" "v$GCLOUD_VER"
    GCLOUD_ACCT=$(gcloud auth list --filter=status:ACTIVE --format='value(account)' 2>/dev/null | head -1 || echo "")
    if [[ -n "$GCLOUD_ACCT" ]]; then
      ok "GCP credentials" "$GCLOUD_ACCT"
    else
      warn_check "GCP credentials" "not authenticated — run: gcloud auth login" "gcloud auth login"
    fi
  else
    warn_check "gcloud CLI" "not installed (only needed for GCP deployment)" "run: ./scripts/deploy-gcp.sh --setup"
  fi

  # Railway CLI
  if command -v railway &>/dev/null; then
    RAILWAY_VER=$(railway --version 2>/dev/null | head -1 || echo "installed")
    ok "Railway CLI" "$RAILWAY_VER"
    if railway whoami &>/dev/null; then
      RAILWAY_USER=$(railway whoami 2>/dev/null | head -1 || echo "authenticated")
      ok "Railway credentials" "$RAILWAY_USER"
    else
      warn_check "Railway credentials" "not logged in — run: railway login" "railway login"
    fi
  else
    warn_check "Railway CLI" "not installed (only needed for Railway deployment)" "npm i -g @railway/cli"
  fi
}

# ══════════════════════════════════════════════════════════════
# LAYER 7 — Docker Images
# ══════════════════════════════════════════════════════════════
check_docker_images() {
  section "LAYER 7 — Docker Images (for local deploy)"

  if ! command -v docker &>/dev/null || ! docker info &>/dev/null; then
    warn_check "Docker images" "Docker not running — skipping image checks"
    return
  fi

  local images=(
    "node:20-alpine"
    "postgres:16-alpine"
    "redis:7-alpine"
  )

  local missing_images=()
  for img in "${images[@]}"; do
    if docker image inspect "$img" &>/dev/null; then
      SIZE=$(docker image inspect "$img" --format='{{.Size}}' 2>/dev/null | \
        awk '{printf "%.0f MB", $1/1024/1024}')
      ok "Docker image: $img" "$SIZE"
    else
      warn_check "Docker image: $img" "not pulled (will auto-pull on first run)" "docker pull $img"
      missing_images+=("$img")
    fi
  done

  if [[ ${#missing_images[@]} -gt 0 && "$MODE" != "audit" ]]; then
    echo ""
    echo -e "  ${YELLOW}${#missing_images[@]} Docker image(s) not cached locally.${NC}"
    read -rp "  Pull them now? (saves time on first deploy) [Y/n] " choice
    choice="${choice:-Y}"
    if [[ "$choice" =~ ^[Yy]$ ]]; then
      for img in "${missing_images[@]}"; do
        echo -e "  ${BLUE}→ Pulling $img ...${NC}"
        docker pull "$img" && ok "Docker image: $img" "pulled" || warn_check "Docker image: $img" "pull failed"
      done
    fi
  fi
}

# ══════════════════════════════════════════════════════════════
# MAIN — Run checks
# ══════════════════════════════════════════════════════════════
if ! $JSON_OUTPUT; then
  echo ""
  echo -e "${CYAN}${BOLD}╔══════════════════════════════════════════╗${NC}"
  echo -e "${CYAN}${BOLD}║   EduGenius — Dependency Audit           ║${NC}"
  echo -e "${CYAN}${BOLD}║   Project: $PROJECT_ROOT${NC}"
  echo -e "${CYAN}${BOLD}╚══════════════════════════════════════════╝${NC}"
  echo ""
  echo -e "  Mode: ${BOLD}${MODE}${NC}"
  [[ -n "$LAYER_FILTER" ]] && echo -e "  Layer filter: ${LAYER_FILTER}"
  echo ""
fi

# Run layers (respecting --layer filter)
run_layer() {
  local name="$1" fn="$2"
  if [[ -z "$LAYER_FILTER" || "$LAYER_FILTER" == "$name" ]]; then
    "$fn"
  fi
}

run_layer "system"   check_system_tools
run_layer "node"     check_node_backend
run_layer "frontend" check_frontend
run_layer "python"   check_python_manim
run_layer "creds"    check_credentials
run_layer "cloud"    check_cloud_clis
run_layer "docker"   check_docker_images

# ══════════════════════════════════════════════════════════════
# SUMMARY
# ══════════════════════════════════════════════════════════════
if $JSON_OUTPUT; then
  echo "{"
  echo "  \"total\": $CHECKS_TOTAL,"
  echo "  \"ok\": $CHECKS_OK,"
  echo "  \"warn\": $CHECKS_WARN,"
  echo "  \"fail\": $CHECKS_FAIL,"
  echo "  \"results\": ["
  (IFS=','; echo "    ${JSON_RESULTS[*]}")
  echo "  ]"
  echo "}"
  exit $(( CHECKS_FAIL > 0 ? 1 : 0 ))
fi

# ── Human-readable summary ────────────────────────────────────
echo ""
echo -e "${BOLD}════════════════════════════════════════${NC}"
echo -e "${BOLD}  Dependency Audit Summary${NC}"
echo -e "${BOLD}════════════════════════════════════════${NC}"
echo ""
echo -e "  Total checks:  ${BOLD}$CHECKS_TOTAL${NC}"
echo -e "  ${GREEN}✅ OK:${NC}           $CHECKS_OK"
echo -e "  ${YELLOW}⚠️  Warnings:${NC}    $CHECKS_WARN"
echo -e "  ${RED}❌ Missing:${NC}      $CHECKS_FAIL"
echo ""

if [[ $CHECKS_FAIL -gt 0 ]]; then
  echo -e "${RED}${BOLD}  Required — must fix before running EduGenius:${NC}"
  for item in "${MISSING_ITEMS[@]:-}"; do
    IFS='|' read -r label detail fix <<< "$item"
    echo -e "  ${RED}•${NC} ${BOLD}$label${NC}"
    [[ -n "$detail" ]] && echo -e "    $detail"
    [[ -n "$fix" ]] && echo -e "    ${BLUE}Fix:${NC} $fix"
  done
  echo ""
fi

if [[ $CHECKS_WARN -gt 0 ]]; then
  echo -e "${YELLOW}${BOLD}  Optional / Recommended:${NC}"
  for item in "${WARN_ITEMS[@]:-}"; do
    IFS='|' read -r label detail fix <<< "$item"
    echo -e "  ${YELLOW}•${NC} ${BOLD}$label${NC}"
    [[ -n "$detail" ]] && echo -e "    $detail"
    [[ -n "$fix" ]] && echo -e "    ${BLUE}Fix:${NC} $fix"
  done
  echo ""
fi

if [[ $CHECKS_FAIL -eq 0 && $CHECKS_WARN -eq 0 ]]; then
  echo -e "  ${GREEN}${BOLD}🎉 All dependencies satisfied! Ready to deploy.${NC}"
  echo ""
fi

# ── What to run next ─────────────────────────────────────────
if [[ $CHECKS_FAIL -gt 0 && "$MODE" == "audit" ]]; then
  echo -e "  ${CYAN}To automatically install missing dependencies:${NC}"
  echo -e "  ${BOLD}  ./scripts/check-deps.sh --install${NC}      (asks before each)"
  echo -e "  ${BOLD}  ./scripts/check-deps.sh --install-all${NC}  (installs all without prompts)"
  echo ""
fi

echo -e "  Deploy options:"
echo -e "    ${BOLD}./scripts/deploy-local.sh${NC}    — local (Docker Compose)"
echo -e "    ${BOLD}./scripts/deploy-hybrid.sh${NC}   — local backend + Supabase"
echo -e "    ${BOLD}./scripts/deploy-railway.sh${NC}  — Railway PaaS"
echo -e "    ${BOLD}./scripts/deploy-aws.sh${NC}      — AWS ECS Fargate"
echo -e "    ${BOLD}./scripts/deploy-gcp.sh${NC}      — GCP Cloud Run"
echo ""

exit $(( CHECKS_FAIL > 0 ? 1 : 0 ))