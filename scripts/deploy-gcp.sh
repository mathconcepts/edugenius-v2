#!/usr/bin/env bash
# ============================================================
# EduGenius — GCP Cloud Run Deployment
# ============================================================
# Builds and deploys to Google Cloud Platform:
#   - Cloud Run (serverless — scales to zero overnight)
#   - Artifact Registry (Docker image store)
#   - Cloud SQL Postgres (managed DB)
#   - Cloud Storage (media/assets)
#   - Secret Manager (API keys)
#   - Cloud Scheduler (batch job crons)
#
# Estimated cost: $15-40/month (low-to-moderate traffic)
# GCP recommended: native Gemini integration + cheapest cloud option
#
# INSTALLS automatically if missing:
#   - Docker
#   - gcloud CLI
#   - Authenticates with GCP
#
# SETUP (one time):
#   1. Create a GCP account: https://cloud.google.com/free  (free $300 credit)
#   2. Run: ./scripts/deploy-gcp.sh --setup
#   3. Deploy: ./scripts/deploy-gcp.sh
#
# Usage:
#   ./scripts/deploy-gcp.sh [--setup] [--enable-apis] [--infra-only] [--destroy] [--status] [--logs]
#
# Options:
#   --setup       Full guided setup: install CLI, auth, enable APIs, provision infra
#   --enable-apis Enable required GCP APIs (run once per project)
#   --infra-only  Provision GCP resources only (no Docker build)
#   --destroy     Delete Cloud Run service (Cloud SQL manual — data safety)
#   --status      Show Cloud Run service status
#   --logs        Stream Cloud Run logs
# ============================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
ENV_FILE="$PROJECT_ROOT/.env.gcp"
ENV_EXAMPLE="$PROJECT_ROOT/deploy/gcp.env.example"

SETUP_MODE=false
ENABLE_APIS=false
INFRA_ONLY=false
DESTROY=false
SHOW_STATUS=false
SHOW_LOGS=false

for arg in "$@"; do
  case $arg in
    --setup)       SETUP_MODE=true ;;
    --enable-apis) ENABLE_APIS=true ;;
    --infra-only)  INFRA_ONLY=true ;;
    --destroy)     DESTROY=true ;;
    --status)      SHOW_STATUS=true ;;
    --logs)        SHOW_LOGS=true ;;
  esac
done

source "$SCRIPT_DIR/_install_common.sh"

info()    { echo -e "${BLUE}[gcp]${NC} $*"; }
success() { echo -e "${GREEN}[gcp] ✅${NC} $*"; }
warn()    { echo -e "${YELLOW}[gcp] ⚠️${NC}  $*"; }
error()   { echo -e "${RED}[gcp] ❌${NC} $*"; exit 1; }

echo ""
echo -e "${CYAN}╔══════════════════════════════════════╗${NC}"
echo -e "${CYAN}║   EduGenius — GCP Cloud Run          ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════╝${NC}"
echo ""

# ── Guided setup mode ────────────────────────────────────────
if $SETUP_MODE; then
  echo "  GCP Cloud Run is the RECOMMENDED cloud option for EduGenius:"
  echo "    ✅ Scales to zero overnight (cheapest for EdTech traffic patterns)"
  echo "    ✅ Native Gemini AI integration"
  echo "    ✅ Free \$300 credit for new accounts"
  echo ""
  echo "  Before starting:"
  echo "    1. Create account: https://cloud.google.com/free"
  echo "    2. Create a GCP project: https://console.cloud.google.com/projectcreate"
  echo "    3. Enable billing: https://console.cloud.google.com/billing"
  echo "       (Required for Cloud Run — no charge until you exceed free tier)"
  echo ""
  read -rp "  Ready? Press Enter to continue (Ctrl+C to abort)..."
  echo ""
  ENABLE_APIS=true
fi

# ── Install dependencies ──────────────────────────────────────
info "Checking dependencies..."
ensure_curl
ensure_docker
ensure_gcloud

# ── Load config ───────────────────────────────────────────────
if [[ ! -f "$ENV_FILE" ]]; then
  if [[ -f "$ENV_EXAMPLE" ]]; then
    cp "$ENV_EXAMPLE" "$ENV_FILE"
  else
    cat > "$ENV_FILE" <<'ENVEOF'
# ── Required GCP Config ────────────────────────────────────────
# Find your Project ID: https://console.cloud.google.com/
GCP_PROJECT_ID=your-project-id

# Best regions for Indian EdTech:
#   asia-south1     = Mumbai (lowest latency for India)
#   asia-south2     = Delhi
#   asia-southeast1 = Singapore
GCP_REGION=asia-south1

# ── App Config ─────────────────────────────────────────────────
GCP_SERVICE_NAME=edugenius
ARTIFACT_REGISTRY_REPO=edugenius
IMAGE_TAG=latest

# ── Cloud Run Scaling ──────────────────────────────────────────
# Set to 0 to scale to zero when idle (saves money during nights/weekends)
CLOUD_RUN_MIN_INSTANCES=0
CLOUD_RUN_MAX_INSTANCES=10

# ── Cloud SQL (PostgreSQL) ─────────────────────────────────────
# Leave blank to skip (use Supabase instead)
# Format: project:region:instance-name
# CLOUD_SQL_INSTANCE=your-project:asia-south1:edugenius-db

# ── API Keys ──────────────────────────────────────────────────
# These are stored in GCP Secret Manager (not in Cloud Run env vars)
GEMINI_API_KEY=your_gemini_api_key
ANTHROPIC_API_KEY=your_anthropic_api_key

# ── Storage ──────────────────────────────────────────────────
# Auto-generated if blank: {project_id}-edugenius-assets
# GCS_BUCKET=your-bucket-name
ENVEOF
  fi

  warn "Created $ENV_FILE"
  echo ""
  echo "  Fill in at minimum:"
  echo "    GCP_PROJECT_ID  — your GCP project ID (from https://console.cloud.google.com/)"
  echo "    GEMINI_API_KEY  — from https://aistudio.google.com/app/apikey"
  echo ""
  echo "  Recommended region for India: asia-south1 (Mumbai)"
  echo ""
  echo "  Then re-run: ./scripts/deploy-gcp.sh"
  exit 0
fi

set -a; source "$ENV_FILE"; set +a

PROJECT_ID="${GCP_PROJECT_ID:?GCP_PROJECT_ID is required in $ENV_FILE}"
REGION="${GCP_REGION:-asia-south1}"
SERVICE_NAME="${GCP_SERVICE_NAME:-edugenius}"
ARTIFACT_REPO="${ARTIFACT_REGISTRY_REPO:-edugenius}"
IMAGE_TAG="${IMAGE_TAG:-latest}"
AR_URI="${REGION}-docker.pkg.dev/${PROJECT_ID}/${ARTIFACT_REPO}/${SERVICE_NAME}"
GCS_BUCKET="${GCS_BUCKET:-${PROJECT_ID}-edugenius-assets}"

gcloud config set project "$PROJECT_ID" --quiet
success "Project: $PROJECT_ID | Region: $REGION"

# ── Show status ───────────────────────────────────────────────
if $SHOW_STATUS; then
  info "Cloud Run service status:"
  gcloud run services describe "$SERVICE_NAME" \
    --region "$REGION" \
    --format='table(status.url, status.conditions[0].status, spec.template.spec.containerConcurrency)' \
    2>/dev/null || warn "Service not found. Deploy first."
  exit 0
fi

# ── Show logs ─────────────────────────────────────────────────
if $SHOW_LOGS; then
  info "Streaming Cloud Run logs (Ctrl+C to stop)..."
  gcloud logging tail \
    "resource.type=cloud_run_revision AND resource.labels.service_name=$SERVICE_NAME" \
    --format='value(textPayload)' 2>/dev/null || \
  gcloud run services logs tail "$SERVICE_NAME" --region "$REGION" 2>/dev/null || \
    warn "Use: gcloud logging read 'resource.type=cloud_run_revision' --limit=50"
  exit 0
fi

# ── Destroy ───────────────────────────────────────────────────
if $DESTROY; then
  warn "⚠️  DESTROY — this removes the Cloud Run service."
  warn "   Cloud SQL must be deleted manually to prevent data loss."
  echo ""
  read -rp "  Type 'destroy' to confirm: " confirm
  [[ "$confirm" != "destroy" ]] && { info "Aborted."; exit 0; }

  gcloud run services delete "$SERVICE_NAME" --region "$REGION" --quiet 2>/dev/null || true
  success "Cloud Run service deleted."
  warn "Cloud SQL instance still running. Delete at: https://console.cloud.google.com/sql"
  exit 0
fi

# ── Enable APIs ───────────────────────────────────────────────
if $ENABLE_APIS; then
  info "Enabling required GCP APIs (takes ~2 minutes on first run)..."
  gcloud services enable \
    run.googleapis.com \
    sqladmin.googleapis.com \
    artifactregistry.googleapis.com \
    storage.googleapis.com \
    cloudscheduler.googleapis.com \
    secretmanager.googleapis.com \
    cloudbuild.googleapis.com \
    --quiet
  success "All required APIs enabled."
fi

# ── Provision Artifact Registry ───────────────────────────────
info "Artifact Registry: $ARTIFACT_REPO"
gcloud artifacts repositories describe "$ARTIFACT_REPO" \
  --location="$REGION" --format='value(name)' &>/dev/null || \
  gcloud artifacts repositories create "$ARTIFACT_REPO" \
    --repository-format=docker \
    --location="$REGION" \
    --description="EduGenius container images" \
    --quiet
success "Artifact Registry: ${REGION}-docker.pkg.dev/${PROJECT_ID}/${ARTIFACT_REPO}"

# ── Provision GCS bucket ──────────────────────────────────────
info "GCS bucket: gs://$GCS_BUCKET"
gcloud storage buckets describe "gs://$GCS_BUCKET" &>/dev/null || \
  gcloud storage buckets create "gs://$GCS_BUCKET" \
    --location="$REGION" \
    --public-access-prevention \
    --quiet
success "GCS: gs://$GCS_BUCKET"

# ── Store secrets in Secret Manager ──────────────────────────
store_secret() {
  local name="$1" value="$2"
  if gcloud secrets describe "$name" --quiet &>/dev/null; then
    echo -n "$value" | gcloud secrets versions add "$name" --data-file=- --quiet 2>/dev/null && \
      info "Secret updated: $name" || warn "Could not update secret: $name"
  else
    echo -n "$value" | gcloud secrets create "$name" \
      --replication-policy="automatic" \
      --data-file=- --quiet 2>/dev/null && \
      info "Secret created: $name" || warn "Could not create secret: $name"
  fi
}

info "Storing API keys in Secret Manager..."
[[ -n "${GEMINI_API_KEY:-}" ]]    && store_secret "GEMINI_API_KEY"    "$GEMINI_API_KEY"
[[ -n "${ANTHROPIC_API_KEY:-}" ]] && store_secret "ANTHROPIC_API_KEY" "$ANTHROPIC_API_KEY"
success "Secrets stored in Secret Manager"

if $INFRA_ONLY; then
  echo ""
  success "GCP infrastructure provisioned!"
  echo ""
  echo "  🐳 Artifact Registry: ${AR_URI}"
  echo "  🪣 GCS Bucket:        gs://$GCS_BUCKET"
  echo "  🔑 Secrets:           Secret Manager"
  echo ""
  echo "  ⚠️  Optional: Create Cloud SQL Postgres for persistent DB"
  echo "    https://console.cloud.google.com/sql/instances/create?region=$REGION"
  echo "    Choose: PostgreSQL 16, machine type db-f1-micro (~\$7/month)"
  echo "    Then add CLOUD_SQL_INSTANCE to $ENV_FILE and DATABASE_URL to Secret Manager"
  echo ""
  echo "  Or: Keep using Supabase (already configured and free)"
  echo ""
  echo "  Then deploy: ./scripts/deploy-gcp.sh"
  exit 0
fi

# ── Build & Push image ────────────────────────────────────────
info "Authenticating with Artifact Registry..."
gcloud auth configure-docker "${REGION}-docker.pkg.dev" --quiet

info "Building Docker image (linux/amd64)..."
docker build -t "${SERVICE_NAME}:${IMAGE_TAG}" \
  --platform linux/amd64 \
  -f "$PROJECT_ROOT/Dockerfile" \
  "$PROJECT_ROOT"

TIMESTAMP=$(date +%Y%m%d-%H%M%S)
docker tag "${SERVICE_NAME}:${IMAGE_TAG}" "${AR_URI}:${IMAGE_TAG}"
docker tag "${SERVICE_NAME}:${IMAGE_TAG}" "${AR_URI}:${TIMESTAMP}"

info "Pushing to Artifact Registry..."
docker push "${AR_URI}:${IMAGE_TAG}"
success "Image pushed: ${AR_URI}:${IMAGE_TAG}"

# ── Deploy to Cloud Run ───────────────────────────────────────
info "Deploying to Cloud Run (region: $REGION)..."

MIN_INSTANCES="${CLOUD_RUN_MIN_INSTANCES:-0}"
MAX_INSTANCES="${CLOUD_RUN_MAX_INSTANCES:-10}"
CLOUD_SQL_FLAGS=""
[[ -n "${CLOUD_SQL_INSTANCE:-}" ]] && CLOUD_SQL_FLAGS="--add-cloudsql-instances=${CLOUD_SQL_INSTANCE}"

# Build secret flags
SECRET_FLAGS="--set-secrets=GEMINI_API_KEY=GEMINI_API_KEY:latest"
[[ -n "${ANTHROPIC_API_KEY:-}" ]] && \
  SECRET_FLAGS="$SECRET_FLAGS,ANTHROPIC_API_KEY=ANTHROPIC_API_KEY:latest"

gcloud run deploy "$SERVICE_NAME" \
  --image="${AR_URI}:${IMAGE_TAG}" \
  --region="$REGION" \
  --platform=managed \
  --allow-unauthenticated \
  --port=3000 \
  --cpu=1 \
  --memory=512Mi \
  --min-instances="$MIN_INSTANCES" \
  --max-instances="$MAX_INSTANCES" \
  --set-env-vars="NODE_ENV=production,GCS_BUCKET=$GCS_BUCKET,GCP_PROJECT=$PROJECT_ID" \
  $SECRET_FLAGS \
  --timeout=300 \
  $CLOUD_SQL_FLAGS \
  --quiet

SERVICE_URL=$(gcloud run services describe "$SERVICE_NAME" \
  --region="$REGION" \
  --format='value(status.url)')
success "Service URL: $SERVICE_URL"

# ── Cloud Scheduler for batch jobs ────────────────────────────
info "Configuring Cloud Scheduler for agent batch jobs..."

setup_scheduler() {
  local name="$1" schedule="$2" path="$3"
  gcloud scheduler jobs delete "$name" --location="$REGION" --quiet 2>/dev/null || true
  gcloud scheduler jobs create http "$name" \
    --location="$REGION" \
    --schedule="$schedule" \
    --uri="${SERVICE_URL}${path}" \
    --http-method=POST \
    --time-zone="Asia/Kolkata" \
    --attempt-deadline=10m \
    --quiet 2>/dev/null && info "Scheduler: $name ($schedule)" || warn "Scheduler skipped: $name"
}

setup_scheduler "atlas-content-gen"   "0 2 * * *"    "/api/batch/atlas/content-gen"
setup_scheduler "scout-market-scan"   "0 6 * * 1"    "/api/batch/scout/market-scan"
setup_scheduler "oracle-analytics"    "0 */6 * * *"  "/api/batch/oracle/analytics"
setup_scheduler "herald-campaign"     "0 8 * * *"    "/api/batch/herald/campaign"
setup_scheduler "forge-health"        "*/30 * * * *" "/api/batch/forge/health"
setup_scheduler "mentor-engagement"   "0 9 * * *"    "/api/batch/mentor/engagement"

echo ""
echo -e "${GREEN}════════════════════════════════════════${NC}"
success "EduGenius deployed to GCP Cloud Run!"
echo ""
echo "  🌐 Service URL:  $SERVICE_URL"
echo "  ❤️  Health:      ${SERVICE_URL}/health"
echo "  🐳 Image:        ${AR_URI}:${IMAGE_TAG}"
echo "  🪣 Storage:      gs://$GCS_BUCKET"
echo ""
echo "  📋 Logs:    ./scripts/deploy-gcp.sh --logs"
echo "  📈 Status:  ./scripts/deploy-gcp.sh --status"
echo "  🌐 Console: https://console.cloud.google.com/run/detail/$REGION/$SERVICE_NAME"
echo ""
echo "  💡 Auto-deploy on git push:"
echo "     Connect via: https://console.cloud.google.com/cloud-build/triggers"
echo -e "${GREEN}════════════════════════════════════════${NC}"
