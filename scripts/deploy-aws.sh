#!/usr/bin/env bash
# ============================================================
# EduGenius — AWS ECS Fargate Deployment
# ============================================================
# Provisions and deploys to AWS:
#   - ECR repository (Docker image registry)
#   - ECS Fargate cluster + service (serverless containers)
#   - S3 bucket (media/assets)
#   - RDS Postgres and ElastiCache Redis (guided setup)
#   - SSM Parameter Store for secrets
#
# Estimated cost: $50-80/month (small load, us-east-1)
#
# INSTALLS automatically if missing:
#   - Docker
#   - AWS CLI v2
#   - Configures AWS credentials if not set
#
# SETUP (one time):
#   1. Create an AWS account: https://aws.amazon.com/free/
#   2. Run: ./scripts/deploy-aws.sh --setup
#   3. Deploy: ./scripts/deploy-aws.sh
#
# Usage:
#   ./scripts/deploy-aws.sh [--setup] [--infra-only] [--deploy-only] [--destroy] [--status]
#
# Options:
#   --setup        Full guided setup: install CLI, configure credentials, provision infra
#   --infra-only   Provision AWS resources only (no Docker build)
#   --deploy-only  Build + deploy image only (skip infra provisioning)
#   --status       Show current ECS service status
#   --destroy      Tear down ECS service (RDS/ElastiCache manual — data safety)
# ============================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
ENV_FILE="$PROJECT_ROOT/.env.aws"
ENV_EXAMPLE="$PROJECT_ROOT/deploy/aws.env.example"

SETUP_MODE=false
INFRA_ONLY=false
DEPLOY_ONLY=false
DESTROY=false
SHOW_STATUS=false

for arg in "$@"; do
  case $arg in
    --setup)       SETUP_MODE=true ;;
    --infra-only)  INFRA_ONLY=true ;;
    --deploy-only) DEPLOY_ONLY=true ;;
    --destroy)     DESTROY=true ;;
    --status)      SHOW_STATUS=true ;;
  esac
done

source "$SCRIPT_DIR/_install_common.sh"

info()    { echo -e "${BLUE}[aws]${NC} $*"; }
success() { echo -e "${GREEN}[aws] ✅${NC} $*"; }
warn()    { echo -e "${YELLOW}[aws] ⚠️${NC}  $*"; }
error()   { echo -e "${RED}[aws] ❌${NC} $*"; exit 1; }

echo ""
echo -e "${CYAN}╔══════════════════════════════════════╗${NC}"
echo -e "${CYAN}║   EduGenius — AWS ECS Deployment     ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════╝${NC}"
echo ""

# ── Guided setup mode ────────────────────────────────────────
if $SETUP_MODE; then
  echo "  This will guide you through a complete AWS setup."
  echo ""
  echo "  What you need before starting:"
  echo "    ✅ AWS account (free tier: https://aws.amazon.com/free/)"
  echo "    ✅ IAM user with AdministratorAccess (or the following policies):"
  echo "       - AmazonECS_FullAccess"
  echo "       - AmazonECR_FullAccess"
  echo "       - AmazonRDS_FullAccess"
  echo "       - AmazonS3FullAccess"
  echo "       - AmazonSSMFullAccess"
  echo "       - ElasticLoadBalancingFullAccess"
  echo ""
  echo "  How to create an IAM user:"
  echo "    1. Go to https://console.aws.amazon.com/iam/"
  echo "    2. Users → Add users → username: edugenius-deploy"
  echo "    3. Attach policies: AdministratorAccess"
  echo "    4. Create user → Security credentials → Create access key"
  echo "    5. Copy the Access Key ID and Secret Access Key"
  echo ""
  read -rp "  Ready? Press Enter to continue (or Ctrl+C to abort)..."
  echo ""
  SETUP_MODE=true
fi

# ── Install dependencies ──────────────────────────────────────
info "Checking dependencies..."
ensure_curl
ensure_unzip
ensure_docker
ensure_awscli

# ── Load config ───────────────────────────────────────────────
if [[ ! -f "$ENV_FILE" ]]; then
  if [[ -f "$ENV_EXAMPLE" ]]; then
    cp "$ENV_EXAMPLE" "$ENV_FILE"
  else
    cat > "$ENV_FILE" <<'ENVEOF'
# ── Required AWS Config ────────────────────────────────────────
# Get your Account ID: https://console.aws.amazon.com/ → top-right dropdown
AWS_ACCOUNT_ID=123456789012
AWS_REGION=us-east-1

# ── App Config ─────────────────────────────────────────────────
APP_NAME=edugenius
IMAGE_TAG=latest

# ── ECS Config ────────────────────────────────────────────────
ECR_REPOSITORY=edugenius
ECS_CLUSTER=edugenius-cluster
ECS_SERVICE=edugenius-service
ECS_DESIRED_COUNT=1

# ── Storage ──────────────────────────────────────────────────
# Leave blank to auto-generate: edugenius-assets-{account_id}
# AWS_S3_BUCKET=your-bucket-name

# ── Secrets (stored in SSM Parameter Store) ──────────────────
# These are pushed to SSM, NOT stored in ECS task env vars
GEMINI_API_KEY=your_gemini_api_key
ANTHROPIC_API_KEY=your_anthropic_api_key

# ── Network (optional — uses default VPC if blank) ────────────
# ECS_SUBNETS=subnet-xxx,subnet-yyy
# ECS_SECURITY_GROUPS=sg-xxx
ENVEOF
  fi

  warn "Created $ENV_FILE"
  echo ""
  echo "  Fill in at minimum:"
  echo "    AWS_ACCOUNT_ID  — find at https://console.aws.amazon.com/ (top-right)"
  echo "    AWS_REGION      — e.g. us-east-1 or ap-south-1 (Mumbai, good for India)"
  echo "    GEMINI_API_KEY  — from https://aistudio.google.com/app/apikey"
  echo ""
  echo "  Then re-run: ./scripts/deploy-aws.sh"
  exit 0
fi

set -a; source "$ENV_FILE"; set +a

AWS_REGION="${AWS_REGION:?AWS_REGION is required in $ENV_FILE}"
AWS_ACCOUNT_ID="${AWS_ACCOUNT_ID:?AWS_ACCOUNT_ID is required in $ENV_FILE}"
APP_NAME="${APP_NAME:-edugenius}"
ECR_REPO="${ECR_REPOSITORY:-$APP_NAME}"
ECS_CLUSTER="${ECS_CLUSTER:-${APP_NAME}-cluster}"
ECS_SERVICE="${ECS_SERVICE:-${APP_NAME}-service}"
IMAGE_TAG="${IMAGE_TAG:-latest}"
ECR_URI="$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPO"
S3_BUCKET="${AWS_S3_BUCKET:-${APP_NAME}-assets-${AWS_ACCOUNT_ID}}"

success "Account: $AWS_ACCOUNT_ID | Region: $AWS_REGION"

# ── Show status ───────────────────────────────────────────────
if $SHOW_STATUS; then
  info "ECS service status:"
  aws ecs describe-services \
    --cluster "$ECS_CLUSTER" \
    --services "$ECS_SERVICE" \
    --region "$AWS_REGION" \
    --query 'services[0].{Status:status,Desired:desiredCount,Running:runningCount,Pending:pendingCount,TaskDef:taskDefinition}' \
    --output table 2>/dev/null || warn "Service not found. Run deploy first."
  exit 0
fi

# ── Destroy ───────────────────────────────────────────────────
if $DESTROY; then
  warn "⚠️  DESTROY — this removes the ECS service and cluster."
  warn "   RDS and ElastiCache must be removed manually to prevent data loss."
  echo ""
  read -rp "  Type 'destroy' to confirm: " confirm
  [[ "$confirm" != "destroy" ]] && { info "Aborted."; exit 0; }

  info "Scaling ECS service to 0..."
  aws ecs update-service --cluster "$ECS_CLUSTER" --service "$ECS_SERVICE" \
    --desired-count 0 --region "$AWS_REGION" 2>/dev/null || true

  sleep 10

  info "Deleting ECS service..."
  aws ecs delete-service --cluster "$ECS_CLUSTER" --service "$ECS_SERVICE" \
    --force --region "$AWS_REGION" 2>/dev/null || true

  info "Deleting ECS cluster..."
  aws ecs delete-cluster --cluster "$ECS_CLUSTER" --region "$AWS_REGION" 2>/dev/null || true

  echo ""
  success "ECS service and cluster removed."
  warn "Manually delete from AWS Console if needed:"
  warn "  RDS:          https://console.aws.amazon.com/rds/"
  warn "  ElastiCache:  https://console.aws.amazon.com/elasticache/"
  warn "  S3:           https://console.aws.amazon.com/s3/"
  warn "  ECR:          https://console.aws.amazon.com/ecr/"
  exit 0
fi

# ── Provision Infrastructure ──────────────────────────────────
if ! $DEPLOY_ONLY; then
  info "Provisioning AWS infrastructure..."

  # ECR
  info "ECR repository: $ECR_REPO"
  aws ecr describe-repositories --repository-names "$ECR_REPO" --region "$AWS_REGION" &>/dev/null || \
    aws ecr create-repository \
      --repository-name "$ECR_REPO" \
      --image-scanning-configuration scanOnPush=true \
      --region "$AWS_REGION" \
      --output json > /dev/null
  success "ECR: $ECR_URI"

  # ECS Cluster
  info "ECS cluster: $ECS_CLUSTER"
  CLUSTER_STATUS=$(aws ecs describe-clusters --clusters "$ECS_CLUSTER" --region "$AWS_REGION" \
    --query 'clusters[0].status' --output text 2>/dev/null || echo "MISSING")
  if [[ "$CLUSTER_STATUS" != "ACTIVE" ]]; then
    aws ecs create-cluster \
      --cluster-name "$ECS_CLUSTER" \
      --capacity-providers FARGATE \
      --default-capacity-provider-strategy capacityProvider=FARGATE,weight=1 \
      --region "$AWS_REGION" \
      --output json > /dev/null
  fi
  success "ECS Cluster: $ECS_CLUSTER"

  # S3
  info "S3 bucket: $S3_BUCKET"
  aws s3 ls "s3://$S3_BUCKET" &>/dev/null || \
    aws s3 mb "s3://$S3_BUCKET" --region "$AWS_REGION" 2>/dev/null || true
  success "S3: s3://$S3_BUCKET"

  # CloudWatch log group
  info "CloudWatch log group: /ecs/$APP_NAME"
  aws logs create-log-group --log-group-name "/ecs/$APP_NAME" \
    --region "$AWS_REGION" 2>/dev/null || true
  success "CloudWatch logs: /ecs/$APP_NAME"

  # Store secrets in SSM
  info "Storing secrets in SSM Parameter Store..."
  store_ssm() {
    local name="$1" value="$2"
    aws ssm put-parameter \
      --name "/edugenius/$name" \
      --value "$value" \
      --type SecureString \
      --overwrite \
      --region "$AWS_REGION" \
      --output json > /dev/null 2>&1 && info "SSM: /edugenius/$name" || warn "SSM skip: $name"
  }
  [[ -n "${GEMINI_API_KEY:-}" ]]      && store_ssm "GEMINI_API_KEY"      "$GEMINI_API_KEY"
  [[ -n "${ANTHROPIC_API_KEY:-}" ]]   && store_ssm "ANTHROPIC_API_KEY"   "$ANTHROPIC_API_KEY"
  success "Secrets stored in SSM"

  if $INFRA_ONLY; then
    echo ""
    success "Infrastructure provisioned!"
    echo ""
    echo "  📦 ECR:     $ECR_URI"
    echo "  🚢 Cluster: $ECS_CLUSTER"
    echo "  🪣 S3:      s3://$S3_BUCKET"
    echo ""
    echo "  ⚠️  Still needed (create in AWS Console):"
    echo "    RDS Postgres: https://console.aws.amazon.com/rds/home?region=$AWS_REGION#launch-dbinstance:"
    echo "    ElastiCache:  https://console.aws.amazon.com/elasticache/ (optional)"
    echo ""
    echo "  After creating RDS, add DATABASE_URL to SSM:"
    echo "    aws ssm put-parameter --name /edugenius/DATABASE_URL \\"
    echo "      --value 'postgresql://...' --type SecureString --region $AWS_REGION"
    echo ""
    echo "  Then deploy: ./scripts/deploy-aws.sh --deploy-only"
    exit 0
  fi
fi

# ── Build & Push ──────────────────────────────────────────────
info "Logging into ECR..."
aws ecr get-login-password --region "$AWS_REGION" | \
  docker login --username AWS --password-stdin \
  "$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com"

info "Building Docker image (linux/amd64)..."
docker build -t "$APP_NAME:$IMAGE_TAG" \
  --platform linux/amd64 \
  -f "$PROJECT_ROOT/Dockerfile" \
  "$PROJECT_ROOT"

TIMESTAMP=$(date +%Y%m%d-%H%M%S)
docker tag "$APP_NAME:$IMAGE_TAG" "$ECR_URI:$IMAGE_TAG"
docker tag "$APP_NAME:$IMAGE_TAG" "$ECR_URI:$TIMESTAMP"

info "Pushing to ECR..."
docker push "$ECR_URI:$IMAGE_TAG"
docker push "$ECR_URI:$TIMESTAMP"
success "Image pushed: $ECR_URI:$IMAGE_TAG"

# ── ECS Task Definition ───────────────────────────────────────
info "Registering ECS task definition..."
TASK_DEF=$(cat <<TASKEOF
{
  "family": "$APP_NAME",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "512",
  "memory": "1024",
  "executionRoleArn": "arn:aws:iam::${AWS_ACCOUNT_ID}:role/ecsTaskExecutionRole",
  "containerDefinitions": [
    {
      "name": "$APP_NAME",
      "image": "$ECR_URI:$IMAGE_TAG",
      "portMappings": [{"containerPort": 3000, "protocol": "tcp"}],
      "essential": true,
      "environment": [
        {"name": "NODE_ENV", "value": "production"},
        {"name": "PORT", "value": "3000"},
        {"name": "AWS_REGION", "value": "$AWS_REGION"}
      ],
      "secrets": [
        {"name": "DATABASE_URL",      "valueFrom": "arn:aws:ssm:$AWS_REGION:$AWS_ACCOUNT_ID:parameter/edugenius/DATABASE_URL"},
        {"name": "REDIS_URL",         "valueFrom": "arn:aws:ssm:$AWS_REGION:$AWS_ACCOUNT_ID:parameter/edugenius/REDIS_URL"},
        {"name": "GEMINI_API_KEY",    "valueFrom": "arn:aws:ssm:$AWS_REGION:$AWS_ACCOUNT_ID:parameter/edugenius/GEMINI_API_KEY"},
        {"name": "ANTHROPIC_API_KEY", "valueFrom": "arn:aws:ssm:$AWS_REGION:$AWS_ACCOUNT_ID:parameter/edugenius/ANTHROPIC_API_KEY"}
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/$APP_NAME",
          "awslogs-region": "$AWS_REGION",
          "awslogs-stream-prefix": "ecs",
          "awslogs-create-group": "true"
        }
      },
      "healthCheck": {
        "command": ["CMD-SHELL", "curl -f http://localhost:3000/health || exit 1"],
        "interval": 30,
        "timeout": 5,
        "retries": 3,
        "startPeriod": 60
      }
    }
  ]
}
TASKEOF
)

TASK_ARN=$(aws ecs register-task-definition \
  --cli-input-json "$TASK_DEF" \
  --region "$AWS_REGION" \
  --query 'taskDefinition.taskDefinitionArn' \
  --output text)
success "Task definition: $(echo "$TASK_ARN" | cut -d'/' -f2)"

# ── Update ECS Service ────────────────────────────────────────
info "Deploying to ECS Fargate..."

SERVICE_STATUS=$(aws ecs describe-services \
  --cluster "$ECS_CLUSTER" \
  --services "$ECS_SERVICE" \
  --region "$AWS_REGION" \
  --query 'services[0].status' \
  --output text 2>/dev/null || echo "MISSING")

if [[ "$SERVICE_STATUS" == "ACTIVE" ]]; then
  aws ecs update-service \
    --cluster "$ECS_CLUSTER" \
    --service "$ECS_SERVICE" \
    --task-definition "$TASK_ARN" \
    --desired-count "${ECS_DESIRED_COUNT:-1}" \
    --region "$AWS_REGION" \
    --output json > /dev/null
  success "ECS service updated — new task deploying."
else
  warn "ECS service '$ECS_SERVICE' not found."
  echo ""
  echo "  Create it in the AWS Console:"
  echo "    https://console.aws.amazon.com/ecs/v2/clusters/$ECS_CLUSTER/create-service"
  echo ""
  echo "  Or via CLI (after setting up networking):"
  echo "    aws ecs create-service \\"
  echo "      --cluster $ECS_CLUSTER \\"
  echo "      --service-name $ECS_SERVICE \\"
  echo "      --task-definition $APP_NAME \\"
  echo "      --desired-count 1 \\"
  echo "      --launch-type FARGATE \\"
  echo "      --network-configuration 'awsvpcConfiguration={subnets=[subnet-xxx],securityGroups=[sg-xxx],assignPublicIp=ENABLED}' \\"
  echo "      --region $AWS_REGION"
  echo ""
  info "Task definition is ready: $TASK_ARN"
fi

echo ""
echo -e "${GREEN}════════════════════════════════════════${NC}"
success "EduGenius deployed to AWS!"
echo ""
echo "  📦 Image:    $ECR_URI:$IMAGE_TAG"
echo "  🚢 Cluster:  $ECS_CLUSTER"
echo "  ⚙️  Service:  $ECS_SERVICE"
echo ""
echo "  📋 Logs:    aws logs tail /ecs/$APP_NAME --follow --region $AWS_REGION"
echo "  📈 Status:  ./scripts/deploy-aws.sh --status"
echo "  🌐 Console: https://console.aws.amazon.com/ecs/v2/clusters/$ECS_CLUSTER"
echo -e "${GREEN}════════════════════════════════════════${NC}"
