#!/usr/bin/env bash
# ============================================================
# EduGenius — Common Install Helpers
# Sourced by all deploy scripts: source "$(dirname "$0")/_install_common.sh"
# ============================================================

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; CYAN='\033[0;36m'; NC='\033[0m'
info()    { echo -e "${BLUE}[install]${NC} $*"; }
success() { echo -e "${GREEN}[install] ✅${NC} $*"; }
warn()    { echo -e "${YELLOW}[install] ⚠️${NC}  $*"; }
error()   { echo -e "${RED}[install] ❌${NC} $*"; exit 1; }
step()    { echo -e "${CYAN}[install] ──${NC} $*"; }

# ── OS detection ─────────────────────────────────────────────
detect_os() {
  OS="unknown"
  ARCH=$(uname -m)
  if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    if command -v apt-get &>/dev/null; then
      OS="ubuntu"
    elif command -v dnf &>/dev/null; then
      OS="fedora"
    elif command -v yum &>/dev/null; then
      OS="centos"
    elif command -v pacman &>/dev/null; then
      OS="arch"
    else
      OS="linux"
    fi
  elif [[ "$OSTYPE" == "darwin"* ]]; then
    OS="macos"
  elif [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" ]]; then
    OS="windows"
  fi
  export OS ARCH
}

# ── Prompt helper ─────────────────────────────────────────────
prompt_install() {
  local tool="$1"
  echo ""
  echo -e "${YELLOW}  '$tool' is not installed.${NC}"
  read -rp "  Install it now? [Y/n] " choice
  choice="${choice:-Y}"
  [[ "$choice" =~ ^[Yy]$ ]] && return 0 || return 1
}

# ── Node.js ──────────────────────────────────────────────────
install_node() {
  detect_os
  step "Installing Node.js 20 LTS..."
  case "$OS" in
    ubuntu)
      curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
      sudo apt-get install -y nodejs
      ;;
    fedora)
      sudo dnf module install -y nodejs:20
      ;;
    centos)
      curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
      sudo yum install -y nodejs
      ;;
    arch)
      sudo pacman -Sy --noconfirm nodejs npm
      ;;
    macos)
      if command -v brew &>/dev/null; then
        brew install node@20
        brew link --overwrite node@20
      else
        echo "  Install Homebrew first: /bin/bash -c \"\$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\""
        echo "  Then re-run this script."
        exit 1
      fi
      ;;
    *)
      echo "  Please install Node.js 20 manually from: https://nodejs.org/en/download/"
      exit 1
      ;;
  esac
  success "Node.js installed: $(node --version)"
}

ensure_node() {
  if ! command -v node &>/dev/null; then
    prompt_install "node" && install_node || error "Node.js is required. Install from https://nodejs.org"
  else
    NODE_VER=$(node -e "process.exit(parseInt(process.version.slice(1)) < 18 ? 1 : 0)" 2>/dev/null && echo "ok" || echo "old")
    if [[ "$NODE_VER" == "old" ]]; then
      warn "Node version $(node --version) is old. Node 20+ recommended."
      prompt_install "node 20" && install_node || warn "Proceeding with old Node — may have issues."
    else
      success "Node.js $(node --version)"
    fi
  fi
}

# ── Docker ───────────────────────────────────────────────────
install_docker() {
  detect_os
  step "Installing Docker..."
  case "$OS" in
    ubuntu)
      sudo apt-get update -q
      sudo apt-get install -y ca-certificates curl gnupg lsb-release
      sudo mkdir -p /etc/apt/keyrings
      curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
      echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | \
        sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
      sudo apt-get update -q
      sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
      sudo usermod -aG docker "$USER"
      warn "You may need to log out and back in for Docker group permissions to apply."
      warn "If docker commands fail, run: newgrp docker"
      ;;
    fedora)
      sudo dnf install -y dnf-plugins-core
      sudo dnf config-manager --add-repo https://download.docker.com/linux/fedora/docker-ce.repo
      sudo dnf install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
      sudo systemctl start docker
      sudo systemctl enable docker
      sudo usermod -aG docker "$USER"
      ;;
    macos)
      echo "  Install Docker Desktop for Mac: https://docs.docker.com/desktop/install/mac-install/"
      echo "  Or with Homebrew: brew install --cask docker"
      exit 1
      ;;
    *)
      echo "  Please install Docker from: https://docs.docker.com/get-docker/"
      exit 1
      ;;
  esac
  success "Docker installed: $(docker --version)"
}

ensure_docker() {
  if ! command -v docker &>/dev/null; then
    prompt_install "docker" && install_docker || error "Docker is required. Install from https://docs.docker.com/get-docker/"
  fi
  if ! docker info &>/dev/null; then
    detect_os
    if [[ "$OS" == "ubuntu" || "$OS" == "fedora" || "$OS" == "linux" ]]; then
      step "Starting Docker daemon..."
      sudo systemctl start docker 2>/dev/null || true
      sleep 3
      docker info &>/dev/null || error "Docker daemon not running. Try: sudo systemctl start docker"
    else
      error "Docker Desktop is not running. Please start it and retry."
    fi
  fi
  # Check for compose v2
  if ! docker compose version &>/dev/null; then
    detect_os
    if [[ "$OS" == "ubuntu" ]]; then
      step "Installing Docker Compose plugin..."
      sudo apt-get install -y docker-compose-plugin
    else
      error "Docker Compose v2 not found. Update Docker Desktop or see https://docs.docker.com/compose/install/"
    fi
  fi
  success "Docker $(docker --version | cut -d' ' -f3 | tr -d ',')"
  success "Docker Compose $(docker compose version --short)"
}

# ── AWS CLI ──────────────────────────────────────────────────
install_awscli() {
  detect_os
  step "Installing AWS CLI v2..."
  TMP_DIR=$(mktemp -d)
  case "$OS" in
    ubuntu|fedora|centos|linux|arch)
      if [[ "$ARCH" == "aarch64" || "$ARCH" == "arm64" ]]; then
        AWS_URL="https://awscli.amazonaws.com/awscli-exe-linux-aarch64.zip"
      else
        AWS_URL="https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip"
      fi
      curl -fsSL "$AWS_URL" -o "$TMP_DIR/awscliv2.zip"
      unzip -q "$TMP_DIR/awscliv2.zip" -d "$TMP_DIR"
      sudo "$TMP_DIR/aws/install" --update
      ;;
    macos)
      if [[ "$ARCH" == "arm64" ]]; then
        AWS_URL="https://awscli.amazonaws.com/AWSCLIV2-arm64.pkg"
      else
        AWS_URL="https://awscli.amazonaws.com/AWSCLIV2.pkg"
      fi
      curl -fsSL "$AWS_URL" -o "$TMP_DIR/AWSCLIV2.pkg"
      sudo installer -pkg "$TMP_DIR/AWSCLIV2.pkg" -target /
      ;;
    *)
      echo "  Install AWS CLI from: https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html"
      exit 1
      ;;
  esac
  rm -rf "$TMP_DIR"
  success "AWS CLI installed: $(aws --version)"
}

ensure_awscli() {
  if ! command -v aws &>/dev/null; then
    prompt_install "aws-cli" && install_awscli || error "AWS CLI is required. Install from https://aws.amazon.com/cli/"
  else
    success "AWS CLI $(aws --version 2>&1 | cut -d' ' -f1)"
  fi
  # Check login
  if ! aws sts get-caller-identity &>/dev/null; then
    warn "AWS CLI not configured or credentials expired."
    echo ""
    echo "  Run: aws configure"
    echo "  You'll need: AWS Access Key ID, Secret Access Key, Region, Output format"
    echo ""
    echo "  How to get keys:"
    echo "    1. Go to https://console.aws.amazon.com/iam/"
    echo "    2. Users → Your user → Security credentials → Create access key"
    echo ""
    read -rp "  Run 'aws configure' now? [Y/n] " choice
    choice="${choice:-Y}"
    if [[ "$choice" =~ ^[Yy]$ ]]; then
      aws configure
      aws sts get-caller-identity &>/dev/null || error "AWS authentication still failing. Check your credentials."
    else
      error "AWS credentials required to continue."
    fi
  fi
  AWS_ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
  success "AWS authenticated — Account: $AWS_ACCOUNT"
}

# ── gcloud CLI ───────────────────────────────────────────────
install_gcloud() {
  detect_os
  step "Installing gcloud CLI..."
  case "$OS" in
    ubuntu)
      sudo apt-get install -y apt-transport-https ca-certificates gnupg
      echo "deb [signed-by=/usr/share/keyrings/cloud.google.gpg] https://packages.cloud.google.com/apt cloud-sdk main" | \
        sudo tee /etc/apt/sources.list.d/google-cloud-sdk.list
      curl -fsSL https://packages.cloud.google.com/apt/doc/apt-key.gpg | \
        sudo gpg --dearmor -o /usr/share/keyrings/cloud.google.gpg
      sudo apt-get update -q && sudo apt-get install -y google-cloud-cli
      ;;
    fedora)
      sudo tee /etc/yum.repos.d/google-cloud-sdk.repo <<'REPOEOF'
[google-cloud-cli]
name=Google Cloud CLI
baseurl=https://packages.cloud.google.com/yum/repos/cloud-sdk-el8-x86_64
enabled=1
gpgcheck=1
repo_gpgcheck=0
gpgkey=https://packages.cloud.google.com/yum/doc/rpm-package-key.gpg
REPOEOF
      sudo dnf install -y google-cloud-cli
      ;;
    macos)
      if command -v brew &>/dev/null; then
        brew install --cask google-cloud-sdk
        echo 'source "$(brew --prefix)/share/google-cloud-sdk/path.bash.inc"' >> ~/.bash_profile
        source "$(brew --prefix)/share/google-cloud-sdk/path.bash.inc" 2>/dev/null || true
      else
        echo "  Install from: https://cloud.google.com/sdk/docs/install"
        exit 1
      fi
      ;;
    *)
      echo "  Install gcloud from: https://cloud.google.com/sdk/docs/install"
      exit 1
      ;;
  esac
  success "gcloud installed: $(gcloud --version | head -1)"
}

ensure_gcloud() {
  if ! command -v gcloud &>/dev/null; then
    prompt_install "gcloud" && install_gcloud || error "gcloud CLI is required. Install from https://cloud.google.com/sdk/"
  else
    success "gcloud $(gcloud --version | head -1)"
  fi
  # Check auth
  if ! gcloud auth list --filter=status:ACTIVE --format='value(account)' 2>/dev/null | grep -q '@'; then
    warn "Not authenticated with GCP."
    echo ""
    echo "  Steps:"
    echo "    1. gcloud auth login            (browser-based login)"
    echo "    2. gcloud config set project YOUR_PROJECT_ID"
    echo "    3. gcloud auth application-default login   (for API calls)"
    echo ""
    read -rp "  Run 'gcloud auth login' now? [Y/n] " choice
    choice="${choice:-Y}"
    if [[ "$choice" =~ ^[Yy]$ ]]; then
      gcloud auth login
      gcloud auth application-default login
    else
      error "GCP authentication required."
    fi
  fi
  GCP_ACCOUNT=$(gcloud auth list --filter=status:ACTIVE --format='value(account)' | head -1)
  success "GCP authenticated — $GCP_ACCOUNT"
}

# ── Railway CLI ──────────────────────────────────────────────
install_railway() {
  step "Installing Railway CLI..."
  ensure_node
  npm install -g @railway/cli
  success "Railway CLI installed: $(railway --version 2>/dev/null || echo 'ok')"
}

ensure_railway() {
  if ! command -v railway &>/dev/null; then
    prompt_install "railway-cli" && install_railway || error "Railway CLI is required. Run: npm i -g @railway/cli"
  else
    success "Railway CLI $(railway --version 2>/dev/null | head -1 || echo 'installed')"
  fi
  # Check login
  if ! railway whoami &>/dev/null; then
    warn "Not logged in to Railway."
    echo ""
    echo "  Steps:"
    echo "    1. Go to https://railway.app and create a free account"
    echo "    2. Run: railway login"
    echo ""
    read -rp "  Run 'railway login' now? [Y/n] " choice
    choice="${choice:-Y}"
    if [[ "$choice" =~ ^[Yy]$ ]]; then
      railway login
      railway whoami &>/dev/null || error "Railway login failed."
    else
      error "Railway login required to continue."
    fi
  fi
  RAILWAY_USER=$(railway whoami 2>/dev/null | head -1 || echo "authenticated")
  success "Railway authenticated — $RAILWAY_USER"
}

# ── curl / wget ──────────────────────────────────────────────
ensure_curl() {
  if ! command -v curl &>/dev/null; then
    detect_os
    step "Installing curl..."
    case "$OS" in
      ubuntu) sudo apt-get install -y curl ;;
      fedora|centos) sudo dnf install -y curl ;;
      macos)  brew install curl ;;
      *) error "Please install curl manually." ;;
    esac
  fi
}

# ── unzip ────────────────────────────────────────────────────
ensure_unzip() {
  if ! command -v unzip &>/dev/null; then
    detect_os
    step "Installing unzip..."
    case "$OS" in
      ubuntu) sudo apt-get install -y unzip ;;
      fedora|centos) sudo dnf install -y unzip ;;
      macos)  brew install unzip ;;
      *) error "Please install unzip manually." ;;
    esac
  fi
}
