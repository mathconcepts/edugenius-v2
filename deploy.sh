#!/usr/bin/env bash
# ── GATE Math Deploy Script ───────────────────────────────────────────────────
# Deploys to: local (Docker), AWS (ECS/Fargate), GCP (Cloud Run), or Render
#
# Usage:
#   ./deploy.sh local          # Docker Compose on this machine
#   ./deploy.sh aws            # AWS ECS Fargate + RDS
#   ./deploy.sh gcp            # GCP Cloud Run + Cloud SQL
#   ./deploy.sh render         # Render (existing setup)
#   ./deploy.sh docker-build   # Just build the Docker image
#
# Prerequisites:
#   local:  Docker Desktop
#   aws:    AWS CLI + configured credentials
#   gcp:    gcloud CLI + configured project
#   render: Render CLI or git push to main
set -euo pipefail

APP_NAME="gate-math"
REGION_AWS="${AWS_REGION:-ap-south-1}"
REGION_GCP="${GCP_REGION:-asia-south1}"
GCP_PROJECT="${GCP_PROJECT:-}"
PORT="${PORT:-8080}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

info()  { echo -e "${GREEN}[deploy]${NC} $1"; }
warn()  { echo -e "${YELLOW}[deploy]${NC} $1"; }
error() { echo -e "${RED}[deploy]${NC} $1" >&2; }

# ── Validate environment ────────────────────────────────────────────────────
check_env() {
  local missing=0
  for var in "$@"; do
    if [ -z "${!var:-}" ]; then
      error "Missing required env var: $var"
      missing=1
    fi
  done
  return $missing
}

# ── Build Docker image ──────────────────────────────────────────────────────
docker_build() {
  info "Building Docker image: $APP_NAME"
  docker build \
    --build-arg VITE_SUPABASE_URL="${VITE_SUPABASE_URL:-}" \
    --build-arg VITE_SUPABASE_ANON_KEY="${VITE_SUPABASE_ANON_KEY:-}" \
    -t "$APP_NAME" \
    -t "$APP_NAME:$(git rev-parse --short HEAD 2>/dev/null || echo latest)" \
    .
  info "Image built: $APP_NAME"
}

# ── Local (Docker Compose) ──────────────────────────────────────────────────
deploy_local() {
  info "Deploying locally with Docker Compose"

  if ! command -v docker &>/dev/null; then
    error "Docker not found. Install: https://docs.docker.com/get-docker/"
    exit 1
  fi

  # Create .env if it doesn't exist
  if [ ! -f .env ]; then
    warn ".env not found. Creating from .env.example..."
    cp .env.example .env
    warn "Edit .env and set at least GEMINI_API_KEY, then re-run."
    exit 1
  fi

  docker compose up --build -d

  info "Waiting for health check..."
  local retries=0
  while [ $retries -lt 30 ]; do
    if curl -sf "http://localhost:${PORT}/health" >/dev/null 2>&1; then
      info "GATE Math is running at http://localhost:${PORT}"
      info "Health: $(curl -s http://localhost:${PORT}/health | head -c 200)"
      return 0
    fi
    sleep 2
    retries=$((retries + 1))
  done
  error "Health check failed after 60s. Check: docker compose logs app"
  exit 1
}

# ── AWS (ECS Fargate + RDS) ─────────────────────────────────────────────────
deploy_aws() {
  info "Deploying to AWS ECS Fargate ($REGION_AWS)"

  if ! command -v aws &>/dev/null; then
    error "AWS CLI not found. Install: https://aws.amazon.com/cli/"
    exit 1
  fi

  check_env DATABASE_URL GEMINI_API_KEY JWT_SECRET || {
    error "Set required env vars in .env or export them"
    exit 1
  }

  local ACCOUNT_ID
  ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
  local ECR_REPO="$ACCOUNT_ID.dkr.ecr.$REGION_AWS.amazonaws.com/$APP_NAME"

  # 1. Create ECR repo if needed
  info "Ensuring ECR repository exists..."
  aws ecr describe-repositories --repository-names "$APP_NAME" --region "$REGION_AWS" 2>/dev/null || \
    aws ecr create-repository --repository-name "$APP_NAME" --region "$REGION_AWS"

  # 2. Login to ECR
  info "Logging into ECR..."
  aws ecr get-login-password --region "$REGION_AWS" | \
    docker login --username AWS --password-stdin "$ACCOUNT_ID.dkr.ecr.$REGION_AWS.amazonaws.com"

  # 3. Build and push
  docker_build
  docker tag "$APP_NAME" "$ECR_REPO:latest"
  docker tag "$APP_NAME" "$ECR_REPO:$(git rev-parse --short HEAD)"
  info "Pushing to ECR..."
  docker push "$ECR_REPO:latest"
  docker push "$ECR_REPO:$(git rev-parse --short HEAD)"

  # 4. Create or update ECS cluster
  info "Ensuring ECS cluster exists..."
  aws ecs describe-clusters --clusters "$APP_NAME" --region "$REGION_AWS" \
    --query 'clusters[?status==`ACTIVE`].clusterName' --output text | grep -q "$APP_NAME" || \
    aws ecs create-cluster --cluster-name "$APP_NAME" --region "$REGION_AWS" \
      --capacity-providers FARGATE --default-capacity-provider-strategy capacityProvider=FARGATE,weight=1

  # 5. Create CloudWatch log group
  aws logs create-log-group --log-group-name "/ecs/$APP_NAME" --region "$REGION_AWS" 2>/dev/null || true

  # 6. Create or get execution role
  local EXEC_ROLE_ARN
  EXEC_ROLE_ARN=$(aws iam get-role --role-name ecsTaskExecutionRole --query 'Role.Arn' --output text 2>/dev/null || echo "")
  if [ -z "$EXEC_ROLE_ARN" ]; then
    info "Creating ECS task execution role..."
    aws iam create-role --role-name ecsTaskExecutionRole \
      --assume-role-policy-document '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"ecs-tasks.amazonaws.com"},"Action":"sts:AssumeRole"}]}'
    aws iam attach-role-policy --role-name ecsTaskExecutionRole \
      --policy-arn arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy
    EXEC_ROLE_ARN=$(aws iam get-role --role-name ecsTaskExecutionRole --query 'Role.Arn' --output text)
  fi

  # 7. Register task definition
  info "Registering task definition..."
  local TASK_DEF
  TASK_DEF=$(cat <<TASKEOF
{
  "family": "$APP_NAME",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "512",
  "memory": "1024",
  "executionRoleArn": "$EXEC_ROLE_ARN",
  "containerDefinitions": [{
    "name": "$APP_NAME",
    "image": "$ECR_REPO:latest",
    "portMappings": [{"containerPort": $PORT, "protocol": "tcp"}],
    "environment": [
      {"name": "PORT", "value": "$PORT"},
      {"name": "DATABASE_URL", "value": "${DATABASE_URL}"},
      {"name": "GEMINI_API_KEY", "value": "${GEMINI_API_KEY}"},
      {"name": "JWT_SECRET", "value": "${JWT_SECRET}"},
      {"name": "WOLFRAM_APP_ID", "value": "${WOLFRAM_APP_ID:-}"},
      {"name": "CRON_SECRET", "value": "${CRON_SECRET:-}"},
      {"name": "TELEGRAM_BOT_TOKEN", "value": "${TELEGRAM_BOT_TOKEN:-}"},
      {"name": "TELEGRAM_GROUP_IDS", "value": "${TELEGRAM_GROUP_IDS:-}"},
      {"name": "RESEND_API_KEY", "value": "${RESEND_API_KEY:-}"},
      {"name": "NODE_ENV", "value": "production"}
    ],
    "logConfiguration": {
      "logDriver": "awslogs",
      "options": {
        "awslogs-group": "/ecs/$APP_NAME",
        "awslogs-region": "$REGION_AWS",
        "awslogs-stream-prefix": "ecs"
      }
    },
    "healthCheck": {
      "command": ["CMD-SHELL", "wget -qO- http://localhost:$PORT/health || exit 1"],
      "interval": 30,
      "timeout": 5,
      "retries": 3,
      "startPeriod": 15
    }
  }]
}
TASKEOF
)
  echo "$TASK_DEF" > /tmp/gate-math-task-def.json
  aws ecs register-task-definition --cli-input-json file:///tmp/gate-math-task-def.json --region "$REGION_AWS"

  # 8. Create or update service
  local SERVICE_EXISTS
  SERVICE_EXISTS=$(aws ecs describe-services --cluster "$APP_NAME" --services "$APP_NAME" --region "$REGION_AWS" \
    --query 'services[?status==`ACTIVE`].serviceName' --output text 2>/dev/null || echo "")

  if [ -n "$SERVICE_EXISTS" ]; then
    info "Updating ECS service..."
    aws ecs update-service --cluster "$APP_NAME" --service "$APP_NAME" \
      --task-definition "$APP_NAME" --force-new-deployment --region "$REGION_AWS" >/dev/null
  else
    # Need VPC/subnet/security group — get defaults
    local VPC_ID SUBNET_IDS SG_ID
    VPC_ID=$(aws ec2 describe-vpcs --filters Name=isDefault,Values=true --region "$REGION_AWS" \
      --query 'Vpcs[0].VpcId' --output text)
    SUBNET_IDS=$(aws ec2 describe-subnets --filters "Name=vpc-id,Values=$VPC_ID" --region "$REGION_AWS" \
      --query 'Subnets[*].SubnetId' --output text | tr '\t' ',')
    SG_ID=$(aws ec2 describe-security-groups --filters "Name=vpc-id,Values=$VPC_ID" "Name=group-name,Values=default" \
      --region "$REGION_AWS" --query 'SecurityGroups[0].GroupId' --output text)

    # Open port in security group
    aws ec2 authorize-security-group-ingress --group-id "$SG_ID" --protocol tcp \
      --port "$PORT" --cidr 0.0.0.0/0 --region "$REGION_AWS" 2>/dev/null || true

    info "Creating ECS service..."
    aws ecs create-service --cluster "$APP_NAME" --service-name "$APP_NAME" \
      --task-definition "$APP_NAME" --desired-count 1 --launch-type FARGATE \
      --network-configuration "awsvpcConfiguration={subnets=[$SUBNET_IDS],securityGroups=[$SG_ID],assignPublicIp=ENABLED}" \
      --region "$REGION_AWS" >/dev/null
  fi

  info "Deployed to AWS ECS. Waiting for service to stabilize..."
  aws ecs wait services-stable --cluster "$APP_NAME" --services "$APP_NAME" --region "$REGION_AWS" 2>/dev/null || \
    warn "Service may still be starting. Check: aws ecs describe-services --cluster $APP_NAME --services $APP_NAME"

  # Get public IP
  local TASK_ARN ENI_ID PUBLIC_IP
  TASK_ARN=$(aws ecs list-tasks --cluster "$APP_NAME" --service-name "$APP_NAME" --region "$REGION_AWS" \
    --query 'taskArns[0]' --output text 2>/dev/null || echo "")
  if [ -n "$TASK_ARN" ] && [ "$TASK_ARN" != "None" ]; then
    ENI_ID=$(aws ecs describe-tasks --cluster "$APP_NAME" --tasks "$TASK_ARN" --region "$REGION_AWS" \
      --query 'tasks[0].attachments[0].details[?name==`networkInterfaceId`].value' --output text 2>/dev/null || echo "")
    if [ -n "$ENI_ID" ]; then
      PUBLIC_IP=$(aws ec2 describe-network-interfaces --network-interface-ids "$ENI_ID" --region "$REGION_AWS" \
        --query 'NetworkInterfaces[0].Association.PublicIp' --output text 2>/dev/null || echo "")
      [ -n "$PUBLIC_IP" ] && info "Live at: http://$PUBLIC_IP:$PORT"
    fi
  fi

  info "AWS deployment complete."
  info "Next steps:"
  info "  - Add an ALB for HTTPS: aws elbv2 create-load-balancer ..."
  info "  - Add a custom domain via Route 53"
  info "  - Move secrets to AWS Secrets Manager for production"
}

# ── GCP (Cloud Run) ─────────────────────────────────────────────────────────
deploy_gcp() {
  info "Deploying to GCP Cloud Run ($REGION_GCP)"

  if ! command -v gcloud &>/dev/null; then
    error "gcloud CLI not found. Install: https://cloud.google.com/sdk/docs/install"
    exit 1
  fi

  # Auto-detect project if not set
  if [ -z "$GCP_PROJECT" ]; then
    GCP_PROJECT=$(gcloud config get-value project 2>/dev/null || echo "")
    if [ -z "$GCP_PROJECT" ]; then
      error "Set GCP_PROJECT or run: gcloud config set project YOUR_PROJECT"
      exit 1
    fi
  fi

  check_env DATABASE_URL GEMINI_API_KEY JWT_SECRET || {
    error "Set required env vars in .env or export them"
    exit 1
  }

  local GCR_REPO="gcr.io/$GCP_PROJECT/$APP_NAME"

  # 1. Enable required APIs
  info "Enabling Cloud Run and Container Registry APIs..."
  gcloud services enable run.googleapis.com containerregistry.googleapis.com --project "$GCP_PROJECT" 2>/dev/null || true

  # 2. Build and push (using Cloud Build for speed, falls back to local)
  info "Building and pushing image..."
  if gcloud builds submit --tag "$GCR_REPO:latest" --project "$GCP_PROJECT" --timeout=600 2>/dev/null; then
    info "Built with Cloud Build"
  else
    warn "Cloud Build failed, building locally..."
    docker_build
    docker tag "$APP_NAME" "$GCR_REPO:latest"
    gcloud auth configure-docker --quiet
    docker push "$GCR_REPO:latest"
  fi

  # 3. Deploy to Cloud Run
  info "Deploying to Cloud Run..."
  gcloud run deploy "$APP_NAME" \
    --image "$GCR_REPO:latest" \
    --platform managed \
    --region "$REGION_GCP" \
    --port "$PORT" \
    --memory 512Mi \
    --cpu 1 \
    --min-instances 0 \
    --max-instances 3 \
    --allow-unauthenticated \
    --set-env-vars "PORT=$PORT,DATABASE_URL=${DATABASE_URL},GEMINI_API_KEY=${GEMINI_API_KEY},JWT_SECRET=${JWT_SECRET},WOLFRAM_APP_ID=${WOLFRAM_APP_ID:-},CRON_SECRET=${CRON_SECRET:-},TELEGRAM_BOT_TOKEN=${TELEGRAM_BOT_TOKEN:-},TELEGRAM_GROUP_IDS=${TELEGRAM_GROUP_IDS:-},RESEND_API_KEY=${RESEND_API_KEY:-},NODE_ENV=production" \
    --project "$GCP_PROJECT"

  local SERVICE_URL
  SERVICE_URL=$(gcloud run services describe "$APP_NAME" --platform managed --region "$REGION_GCP" \
    --project "$GCP_PROJECT" --format 'value(status.url)' 2>/dev/null || echo "")

  info "Deployed to GCP Cloud Run"
  [ -n "$SERVICE_URL" ] && info "Live at: $SERVICE_URL"
  info "Next steps:"
  info "  - Add Cloud SQL for managed PostgreSQL"
  info "  - Map a custom domain: gcloud run domain-mappings create ..."
  info "  - Move secrets to Secret Manager for production"
}

# ── Render (existing setup) ─────────────────────────────────────────────────
deploy_render() {
  info "Deploying to Render"
  info "Render auto-deploys from the main branch."
  info "Pushing to main triggers a deploy."

  local CURRENT_BRANCH
  CURRENT_BRANCH=$(git branch --show-current)

  if [ "$CURRENT_BRANCH" = "main" ]; then
    info "On main branch. Pushing..."
    git push origin main
    info "Deploy triggered. Watch at: https://dashboard.render.com"
    info "Live at: https://gate-math-api.onrender.com"
  else
    info "Not on main. To deploy:"
    info "  git checkout main && git merge $CURRENT_BRANCH && git push origin main"
    info "  Or merge the PR at: https://github.com/mathconcepts/edugenius-v2/pulls"
  fi
}

# ── Main ────────────────────────────────────────────────────────────────────
case "${1:-help}" in
  local)
    deploy_local
    ;;
  aws)
    # Source .env if it exists
    [ -f .env ] && set -a && source .env && set +a
    deploy_aws
    ;;
  gcp)
    [ -f .env ] && set -a && source .env && set +a
    deploy_gcp
    ;;
  render)
    deploy_render
    ;;
  docker-build)
    [ -f .env ] && set -a && source .env && set +a
    docker_build
    ;;
  *)
    echo "GATE Math Deploy"
    echo ""
    echo "Usage: ./deploy.sh <target>"
    echo ""
    echo "Targets:"
    echo "  local         Docker Compose (PostgreSQL + app)"
    echo "  aws           AWS ECS Fargate (ap-south-1)"
    echo "  gcp           GCP Cloud Run (asia-south1)"
    echo "  render        Render (git push to main)"
    echo "  docker-build  Build Docker image only"
    echo ""
    echo "Environment:"
    echo "  Required: GEMINI_API_KEY, DATABASE_URL, JWT_SECRET"
    echo "  Optional: WOLFRAM_APP_ID, TELEGRAM_BOT_TOKEN, RESEND_API_KEY"
    echo "  AWS:      AWS_REGION (default: ap-south-1)"
    echo "  GCP:      GCP_PROJECT, GCP_REGION (default: asia-south1)"
    echo ""
    echo "Quick start:"
    echo "  cp .env.example .env  # edit with your keys"
    echo "  ./deploy.sh local     # runs on http://localhost:8080"
    ;;
esac
