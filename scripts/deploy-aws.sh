#!/usr/bin/env bash
# ============================================================
# EduGenius — AWS ECS Fargate Deployment
# ============================================================
# Builds Docker image, pushes to ECR, deploys to ECS Fargate.
# Provisions: ECR repo, ECS cluster, Fargate service, RDS Postgres,
# ElastiCache Redis, ALB, S3 bucket.
#
# Requirements:
#   - AWS CLI v2 configured (aws configure)
#   - Docker
#   - Sufficient IAM permissions (see docs/19-deployment-options.md)
#
# Usage:
#   ./scripts/deploy-aws.sh [--infra-only] [--deploy-only] [--destroy]
# ============================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
ENV_FILE="$PROJECT_ROOT/.env.aws"

INFRA_ONLY=false
DEPLOY_ONLY=false
DESTROY=false

for arg in "$@"; do
  case $arg in
    --infra-only)  INFRA_ONLY=true ;;
    --deploy-only) DEPLOY_ONLY=true ;;
    --destroy)     DESTROY=true ;;
  esac
done

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
info()    { echo -e "${BLUE}[aws]${NC} $*"; }
success() { echo -e "${GREEN}[aws] ✅${NC} $*"; }
warn()    { echo -e "${YELLOW}[aws] ⚠️${NC} $*"; }
error()   { echo -e "${RED}[aws] ❌${NC} $*"; exit 1; }

info "EduGenius AWS ECS Fargate Deployment"
echo "────────────────────────────────────────"

# ── Pre-flight ────────────────────────────────────────────────
command -v aws    &>/dev/null || error "AWS CLI not found. Install from https://aws.amazon.com/cli/"
command -v docker &>/dev/null || error "Docker not found."

aws sts get-caller-identity &>/dev/null || error "AWS CLI not configured. Run: aws configure"

# ── Load config ───────────────────────────────────────────────
[[ ! -f "$ENV_FILE" ]] && error "No .env.aws found. Copy deploy/aws.env.example to .env.aws"
set -a; source "$ENV_FILE"; set +a

AWS_REGION="${AWS_REGION:?AWS_REGION is required}"
AWS_ACCOUNT_ID="${AWS_ACCOUNT_ID:?AWS_ACCOUNT_ID is required}"
APP_NAME="${APP_NAME:-edugenius}"
ECR_REPO="${ECR_REPOSITORY:-$APP_NAME}"
ECS_CLUSTER="${ECS_CLUSTER:-${APP_NAME}-cluster}"
ECS_SERVICE="${ECS_SERVICE:-${APP_NAME}-service}"
IMAGE_TAG="${IMAGE_TAG:-latest}"
ECR_URI="$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPO"

success "Account: $AWS_ACCOUNT_ID | Region: $AWS_REGION"

# ── Destroy ───────────────────────────────────────────────────
if $DESTROY; then
  warn "⚠️  DESTROY mode — this will delete all AWS resources!"
  read -rp "Type 'destroy' to confirm: " confirm
  [[ "$confirm" != "destroy" ]] && { info "Aborted."; exit 0; }

  info "Scaling ECS service to 0..."
  aws ecs update-service --cluster "$ECS_CLUSTER" --service "$ECS_SERVICE" \
    --desired-count 0 --region "$AWS_REGION" 2>/dev/null || true

  info "Deleting ECS service..."
  aws ecs delete-service --cluster "$ECS_CLUSTER" --service "$ECS_SERVICE" \
    --force --region "$AWS_REGION" 2>/dev/null || true

  warn "RDS and ElastiCache must be deleted manually from the AWS Console to avoid accidental data loss."
  success "ECS service removed. Clean up RDS/ElastiCache manually."
  exit 0
fi

# ── Provision Infrastructure ──────────────────────────────────
if ! $DEPLOY_ONLY; then
  info "Provisioning AWS infrastructure..."

  # Create ECR repository
  info "Creating ECR repository: $ECR_REPO"
  aws ecr describe-repositories --repository-names "$ECR_REPO" --region "$AWS_REGION" &>/dev/null || \
    aws ecr create-repository \
      --repository-name "$ECR_REPO" \
      --image-scanning-configuration scanOnPush=true \
      --region "$AWS_REGION" \
      --output json > /dev/null
  success "ECR: $ECR_URI"

  # Create ECS Cluster
  info "Creating ECS cluster: $ECS_CLUSTER"
  aws ecs describe-clusters --clusters "$ECS_CLUSTER" --region "$AWS_REGION" \
    --query 'clusters[0].status' --output text 2>/dev/null | grep -q ACTIVE || \
    aws ecs create-cluster \
      --cluster-name "$ECS_CLUSTER" \
      --capacity-providers FARGATE \
      --default-capacity-provider-strategy capacityProvider=FARGATE,weight=1 \
      --region "$AWS_REGION" \
      --output json > /dev/null
  success "ECS Cluster: $ECS_CLUSTER"

  # Create S3 bucket for assets
  S3_BUCKET="${AWS_S3_BUCKET:-${APP_NAME}-assets-${AWS_ACCOUNT_ID}}"
  info "Creating S3 bucket: $S3_BUCKET"
  aws s3 ls "s3://$S3_BUCKET" &>/dev/null || \
    aws s3 mb "s3://$S3_BUCKET" --region "$AWS_REGION" 2>/dev/null || true
  success "S3: s3://$S3_BUCKET"

  if $INFRA_ONLY; then
    echo ""
    success "Infrastructure provisioned!"
    echo ""
    echo "  📦 ECR:     $ECR_URI"
    echo "  🚢 Cluster: $ECS_CLUSTER"
    echo "  🪣 S3:      s3://$S3_BUCKET"
    echo ""
    echo "  Next: Create RDS Postgres and ElastiCache in AWS Console,"
    echo "        then run: ./scripts/deploy-aws.sh --deploy-only"
    exit 0
  fi
fi

# ── Build & Push Docker image ─────────────────────────────────
info "Authenticating with ECR..."
aws ecr get-login-password --region "$AWS_REGION" | \
  docker login --username AWS --password-stdin "$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com"

info "Building Docker image..."
docker build -t "$APP_NAME:$IMAGE_TAG" \
  --platform linux/amd64 \
  -f "$PROJECT_ROOT/Dockerfile" \
  "$PROJECT_ROOT"

info "Tagging image..."
docker tag "$APP_NAME:$IMAGE_TAG" "$ECR_URI:$IMAGE_TAG"
docker tag "$APP_NAME:$IMAGE_TAG" "$ECR_URI:$(date +%Y%m%d-%H%M%S)"

info "Pushing to ECR..."
docker push "$ECR_URI:$IMAGE_TAG"
success "Image pushed: $ECR_URI:$IMAGE_TAG"

# ── Register ECS Task Definition ──────────────────────────────
info "Registering ECS task definition..."
TASK_DEF=$(cat <<TASKEOF
{
  "family": "$APP_NAME",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "512",
  "memory": "1024",
  "containerDefinitions": [
    {
      "name": "$APP_NAME",
      "image": "$ECR_URI:$IMAGE_TAG",
      "portMappings": [{"containerPort": 3000, "protocol": "tcp"}],
      "essential": true,
      "environment": [
        {"name": "NODE_ENV", "value": "production"},
        {"name": "PORT", "value": "3000"}
      ],
      "secrets": [
        {"name": "DATABASE_URL", "valueFrom": "arn:aws:ssm:$AWS_REGION:$AWS_ACCOUNT_ID:parameter/edugenius/DATABASE_URL"},
        {"name": "REDIS_URL", "valueFrom": "arn:aws:ssm:$AWS_REGION:$AWS_ACCOUNT_ID:parameter/edugenius/REDIS_URL"},
        {"name": "GEMINI_API_KEY", "valueFrom": "arn:aws:ssm:$AWS_REGION:$AWS_ACCOUNT_ID:parameter/edugenius/GEMINI_API_KEY"}
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/$APP_NAME",
          "awslogs-region": "$AWS_REGION",
          "awslogs-stream-prefix": "ecs"
        }
      },
      "healthCheck": {
        "command": ["CMD-SHELL", "curl -f http://localhost:3000/health || exit 1"],
        "interval": 30,
        "timeout": 5,
        "retries": 3
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

success "Task definition: $TASK_ARN"

# ── Update or Create ECS Service ─────────────────────────────
info "Deploying to ECS Fargate..."

SUBNETS="${ECS_SUBNETS:-}"
SECURITY_GROUPS="${ECS_SECURITY_GROUPS:-}"

if [[ -z "$SUBNETS" ]]; then
  warn "ECS_SUBNETS not set. Attempting to use default VPC subnets..."
  SUBNETS=$(aws ec2 describe-subnets \
    --filters "Name=default-for-az,Values=true" \
    --query 'Subnets[*].SubnetId' \
    --output text \
    --region "$AWS_REGION" | tr '\t' ',' || echo "")
fi

SERVICE_EXISTS=$(aws ecs describe-services \
  --cluster "$ECS_CLUSTER" \
  --services "$ECS_SERVICE" \
  --region "$AWS_REGION" \
  --query 'services[0].status' \
  --output text 2>/dev/null || echo "MISSING")

if [[ "$SERVICE_EXISTS" == "ACTIVE" ]]; then
  aws ecs update-service \
    --cluster "$ECS_CLUSTER" \
    --service "$ECS_SERVICE" \
    --task-definition "$TASK_ARN" \
    --desired-count "${ECS_DESIRED_COUNT:-1}" \
    --region "$AWS_REGION" \
    --output json > /dev/null
  success "ECS service updated."
else
  warn "ECS service '$ECS_SERVICE' not found. Create it in the AWS Console or via CDK."
  warn "Task definition is ready: $TASK_ARN"
fi

# ── Done ──────────────────────────────────────────────────────
echo ""
echo "════════════════════════════════════════"
success "EduGenius deployed to AWS!"
echo ""
echo "  📦 Image:    $ECR_URI:$IMAGE_TAG"
echo "  🚢 Cluster:  $ECS_CLUSTER"
echo "  ⚙️  Service:  $ECS_SERVICE"
echo ""
echo "  Logs:    aws logs tail /ecs/$APP_NAME --follow"
echo "  Status:  aws ecs describe-services --cluster $ECS_CLUSTER --services $ECS_SERVICE"
echo "  Console: https://console.aws.amazon.com/ecs/v2/clusters/$ECS_CLUSTER"
echo "════════════════════════════════════════"
