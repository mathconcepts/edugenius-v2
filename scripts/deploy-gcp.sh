#!/usr/bin/env bash
# ============================================================
# EduGenius — GCP Cloud Run Deployment
# ============================================================
# Builds Docker image, pushes to Artifact Registry, deploys
# to Cloud Run. Uses Cloud SQL for Postgres, GCS for storage.
#
# Requirements:
#   - gcloud CLI installed & authenticated
#   - GCP project with billing enabled
#   - Required APIs enabled (Cloud Run, Artifact Registry, Cloud SQL)
#
# Usage:
#   ./scripts/deploy-gcp.sh [--enable-apis] [--infra-only] [--destroy]
# ============================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
ENV_FILE="$PROJECT_ROOT/.env.gcp"

ENABLE_APIS=false
INFRA_ONLY=false
DESTROY=false

for arg in "$@"; do
  case $arg in
    --enable-apis) ENABLE_APIS=true ;;
    --infra-only)  INFRA_ONLY=true ;;
    --destroy)     DESTROY=true ;;
  esac
done

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
info()    { echo -e "${BLUE}[gcp]${NC} $*"; }
success() { echo -e "${GREEN}[gcp] ✅${NC} $*"; }
warn()    { echo -e "${YELLOW}[gcp] ⚠️${NC} $*"; }
error()   { echo -e "${RED}[gcp] ❌${NC} $*"; exit 1; }

info "EduGenius GCP Cloud Run Deployment"
echo "────────────────────────────────────────"

# ── Pre-flight ────────────────────────────────────────────────
command -v gcloud &>/dev/null || error "gcloud CLI not found. Install from https://cloud.google.com/sdk/"
command -v docker &>/dev/null || error "Docker not found."

gcloud auth list --filter=status:ACTIVE --format='value(account)' 2>/dev/null | grep -q '@' || \
  error "Not authenticated. Run: gcloud auth login"

# ── Load config ───────────────────────────────────────────────
[[ ! -f "$ENV_FILE" ]] && error "No .env.gcp found. Copy deploy/gcp.env.example to .env.gcp"
set -a; source "$ENV_FILE"; set +a

PROJECT_ID="${GCP_PROJECT_ID:?GCP_PROJECT_ID is required}"
REGION="${GCP_REGION:-asia-south1}"          # Mumbai — good for Indian EdTech
SERVICE_NAME="${GCP_SERVICE_NAME:-edugenius}"
ARTIFACT_REPO="${ARTIFACT_REGISTRY_REPO:-edugenius}"
IMAGE_TAG="${IMAGE_TAG:-latest}"
AR_URI="${REGION}-docker.pkg.dev/${PROJECT_ID}/${ARTIFACT_REPO}/${SERVICE_NAME}"

gcloud config set project "$PROJECT_ID" --quiet
success "Project: $PROJECT_ID | Region: $REGION"

# ── Destroy ───────────────────────────────────────────────────
if $DESTROY; then
  warn "⚠️  DESTROY mode — deletes Cloud Run service!"
  read -rp "Type 'destroy' to confirm: " confirm
  [[ "$confirm" != "destroy" ]] && { info "Aborted."; exit 0; }

  gcloud run services delete "$SERVICE_NAME" --region "$REGION" --quiet 2>/dev/null || true
  success "Cloud Run service deleted. Cloud SQL must be deleted manually."
  exit 0
fi

# ── Enable APIs ───────────────────────────────────────────────
if $ENABLE_APIS; then
  info "Enabling required GCP APIs..."
  gcloud services enable \
    run.googleapis.com \
    sqladmin.googleapis.com \
    artifactregistry.googleapis.com \
    storage.googleapis.com \
    cloudscheduler.googleapis.com \
    secretmanager.googleapis.com \
    --quiet
  success "APIs enabled."
fi

# ── Create Artifact Registry repo ────────────────────────────
info "Ensuring Artifact Registry repository exists..."
gcloud artifacts repositories describe "$ARTIFACT_REPO" \
  --location="$REGION" --format='value(name)' &>/dev/null || \
  gcloud artifacts repositories create "$ARTIFACT_REPO" \
    --repository-format=docker \
    --location="$REGION" \
    --description="EduGenius container images" \
    --quiet
success "Artifact Registry: ${REGION}-docker.pkg.dev/${PROJECT_ID}/${ARTIFACT_REPO}"

# ── Create GCS bucket ─────────────────────────────────────────
GCS_BUCKET="${GCS_BUCKET:-${PROJECT_ID}-edugenius-assets}"
info "Ensuring GCS bucket exists: gs://$GCS_BUCKET"
gcloud storage buckets describe "gs://$GCS_BUCKET" &>/dev/null || \
  gcloud storage buckets create "gs://$GCS_BUCKET" \
    --location="$REGION" \
    --public-access-prevention \
    --quiet
success "GCS: gs://$GCS_BUCKET"

if $INFRA_ONLY; then
  echo ""
  success "GCP infrastructure provisioned!"
  echo ""
  echo "  🐳 Artifact Registry: ${AR_URI}"
  echo "  🪣 GCS Bucket:        gs://$GCS_BUCKET"
  echo ""
  echo "  Next: Create Cloud SQL instance in GCP Console,"
  echo "        then run: ./scripts/deploy-gcp.sh"
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

info "Tagging image..."
docker tag "${SERVICE_NAME}:${IMAGE_TAG}" "${AR_URI}:${IMAGE_TAG}"
docker tag "${SERVICE_NAME}:${IMAGE_TAG}" "${AR_URI}:$(date +%Y%m%d-%H%M%S)"

info "Pushing to Artifact Registry..."
docker push "${AR_URI}:${IMAGE_TAG}"
success "Image pushed: ${AR_URI}:${IMAGE_TAG}"

# ── Store secrets in Secret Manager ──────────────────────────
store_secret() {
  local name="$1" value="$2"
  echo -n "$value" | gcloud secrets create "$name" \
    --replication-policy="automatic" \
    --data-file=- --quiet 2>/dev/null || \
  echo -n "$value" | gcloud secrets versions add "$name" \
    --data-file=- --quiet 2>/dev/null || true
  info "Secret stored: $name"
}

if [[ -n "${GEMINI_API_KEY:-}" ]]; then
  store_secret "GEMINI_API_KEY" "$GEMINI_API_KEY"
fi

# ── Deploy to Cloud Run ───────────────────────────────────────
info "Deploying to Cloud Run..."

MIN_INSTANCES="${CLOUD_RUN_MIN_INSTANCES:-0}"   # Scale to zero by default
MAX_INSTANCES="${CLOUD_RUN_MAX_INSTANCES:-10}"
CLOUD_SQL_CONN="${CLOUD_SQL_INSTANCE:-}"        # projects/P/instances/I format

DB_FLAGS=""
if [[ -n "$CLOUD_SQL_CONN" ]]; then
  DB_FLAGS="--add-cloudsql-instances=$CLOUD_SQL_CONN"
fi

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
  --set-env-vars="NODE_ENV=production,GCS_BUCKET=$GCS_BUCKET" \
  --set-secrets="GEMINI_API_KEY=GEMINI_API_KEY:latest" \
  --timeout=300 \
  $DB_FLAGS \
  --quiet

SERVICE_URL=$(gcloud run services describe "$SERVICE_NAME" \
  --region="$REGION" \
  --format='value(status.url)')

# ── Set up Cloud Scheduler for batch jobs ─────────────────────
info "Configuring Cloud Scheduler for batch jobs..."

setup_scheduler() {
  local name="$1" schedule="$2" path="$3"
  gcloud scheduler jobs describe "$name" --location="$REGION" &>/dev/null && \
    gcloud scheduler jobs delete "$name" --location="$REGION" --quiet 2>/dev/null || true

  gcloud scheduler jobs create http "$name" \
    --location="$REGION" \
    --schedule="$schedule" \
    --uri="${SERVICE_URL}${path}" \
    --http-method=POST \
    --time-zone="Asia/Kolkata" \
    --quiet 2>/dev/null && info "Scheduler: $name" || warn "Scheduler setup skipped: $name"
}

setup_scheduler "atlas-content-generation"  "0 2 * * *"     "/api/batch/atlas:content-generation"
setup_scheduler "scout-market-scan"          "0 6 * * 1"     "/api/batch/scout:market-scan"
setup_scheduler "oracle-analytics-summary"  "0 */6 * * *"   "/api/batch/oracle:analytics-summary"
setup_scheduler "herald-campaign-check"     "0 8 * * *"     "/api/batch/herald:campaign-check"
setup_scheduler "forge-health-check"        "*/30 * * * *"  "/api/batch/forge:health-check"

# ── Done ──────────────────────────────────────────────────────
echo ""
echo "════════════════════════════════════════"
success "EduGenius deployed to GCP Cloud Run!"
echo ""
echo "  🌐 Service URL:  $SERVICE_URL"
echo "  🐳 Image:        ${AR_URI}:${IMAGE_TAG}"
echo "  🪣 Storage:      gs://$GCS_BUCKET"
echo ""
echo "  Logs:    gcloud logging read 'resource.type=cloud_run_revision AND resource.labels.service_name=$SERVICE_NAME' --limit=50"
echo "  Status:  gcloud run services describe $SERVICE_NAME --region $REGION"
echo "  Console: https://console.cloud.google.com/run/detail/$REGION/$SERVICE_NAME"
echo "════════════════════════════════════════"
