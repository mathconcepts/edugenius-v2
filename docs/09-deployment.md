# Deployment Guide

Production deployment reference for EduGenius v2.0.

> **TL;DR:** Run `./scripts/check-deps.sh --install` first, then pick your deploy script.
> Full decision guide with costs: [19-deployment-options.md](./19-deployment-options.md)

---

## Overview

EduGenius ships with **5 deployment modes** and a **batch job runner**, each implemented as a self-contained shell script:

| Script | Mode | Cost/month |
|--------|------|-----------|
| `deploy-local.sh` | Docker Compose — everything local | ~$0 |
| `deploy-hybrid.sh` | Local backend + Supabase cloud | ~$0 |
| `deploy-railway.sh` | Railway PaaS (zero ops) | $20–60 |
| `deploy-gcp.sh` | GCP Cloud Run (scale to zero) | $15–40 |
| `deploy-aws.sh` | AWS ECS Fargate (enterprise) | $50–80 |
| `batch-run.sh` | Agent batch job pipeline runner | — |
| `check-deps.sh` | Dependency audit + guided install | — |

All scripts **auto-install their required CLIs** and **guide you through credentials** if anything is missing.

---

## Dependency Check (Run First)

Before deploying, verify your environment:

```bash
# Audit only — no changes
./scripts/check-deps.sh

# Audit + install missing (asks before each)
./scripts/check-deps.sh --install

# Install everything without prompts
./scripts/check-deps.sh --install-all

# Check a specific layer only
./scripts/check-deps.sh --layer system     # Node, Docker, Python, Git, curl
./scripts/check-deps.sh --layer node       # Backend npm packages + build
./scripts/check-deps.sh --layer frontend   # React/Vite packages + build
./scripts/check-deps.sh --layer python     # Manim service deps
./scripts/check-deps.sh --layer creds      # API keys check (no values shown)
./scripts/check-deps.sh --layer cloud      # AWS/GCP/Railway CLIs
./scripts/check-deps.sh --layer docker     # Docker image cache

# JSON output for CI/scripting
./scripts/check-deps.sh --json
```

**Exit codes:** `0` = all required deps satisfied · `1` = missing required deps

---

## Option 1 — Local (Docker Compose)

Runs the full stack on your machine. No external services needed.

### What runs where
```
Your machine (Docker):
├── Postgres 16   → localhost:5432
├── Redis 7       → localhost:6379
├── Backend API   → localhost:3000
└── Frontend      → localhost:80  (Nginx)
```

### Installation
Docker is the only system requirement. The script installs it if missing.

```bash
# Ubuntu/Debian (auto-installed by script):
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
# ... (handled by check-deps.sh or deploy-local.sh)

# macOS: install Docker Desktop from https://docs.docker.com/desktop/install/mac-install/
```

### Deploy

```bash
# First run — creates .env.local template
./scripts/deploy-local.sh

# Edit API keys
nano .env.local   # add GEMINI_API_KEY, ANTHROPIC_API_KEY

# Re-run to start
./scripts/deploy-local.sh

# Other modes
./scripts/deploy-local.sh --dev      # hot reload, attached logs
./scripts/deploy-local.sh --reset    # wipe DB and start fresh
./scripts/deploy-local.sh --down     # stop all services
```

### Verify
```bash
curl http://localhost:3000/health
# {"status":"ok","timestamp":...}
```

### Environment variables
See [`deploy/local.env.example`](../deploy/local.env.example) for the full template.

| Variable | Required | Description |
|----------|----------|-------------|
| `GEMINI_API_KEY` | ✅ | Google Gemini API key |
| `ANTHROPIC_API_KEY` | ✅ | Anthropic Claude API key |
| `DATABASE_URL` | Auto | Set to Docker Postgres |
| `REDIS_URL` | Auto | Set to Docker Redis |
| `PORT` | Default 3000 | Backend port |
| `NODE_ENV` | Default development | |

---

## Option 2 — Hybrid (Supabase + Local Backend)

Local backend + Supabase cloud DB + Redis via Docker. **This is the current live setup.**

```
Your machine:
├── Backend API      → localhost:3000 (Node/Docker)
├── Redis 7          → localhost:6379 (Docker)
└── OpenClaw agents  → (already running)

Cloud:
├── PostgreSQL       → Supabase (tjcrhdavxkjjasfnrxtw.supabase.co)
├── Vector DB        → Supabase pgvector
└── Frontend CDN     → Netlify (edugenius-ui.netlify.app)
```

### Setup

```bash
cp deploy/hybrid.env.example .env.hybrid
nano .env.hybrid    # add Supabase + Gemini keys
./scripts/deploy-hybrid.sh
```

**Where to get Supabase keys:**
1. Go to https://supabase.com/dashboard
2. Select your project
3. Settings → API → copy:
   - **Project URL** → `SUPABASE_URL`
   - **anon public** key → `SUPABASE_ANON_KEY`
   - **service_role** key → `SUPABASE_SERVICE_KEY`

```bash
./scripts/deploy-hybrid.sh --dev     # hot reload
./scripts/deploy-hybrid.sh --down    # stop services
```

---

## Option 3 — Railway PaaS

Zero-ops. Railway manages Postgres + Redis + auto-scaling.

### Installation
Railway CLI is installed automatically if missing:
```bash
npm install -g @railway/cli   # auto-installed by script
railway login                 # browser-based OAuth
```

### One-time project setup

```bash
# Create Railway project + Postgres + Redis plugins
./scripts/deploy-railway.sh --init

# Push API keys to Railway
cp deploy/railway.env.example .env.railway
nano .env.railway   # add GEMINI_API_KEY, ANTHROPIC_API_KEY
./scripts/deploy-railway.sh --env-push
```

**How to create a Railway account:**
1. Go to https://railway.app
2. Sign up with GitHub
3. No credit card needed for hobby tier

### Deploy

```bash
./scripts/deploy-railway.sh
```

Railway builds your Dockerfile, provisions Postgres + Redis, and deploys. Gets a public HTTPS URL automatically.

### Auto-deploy on git push

```bash
# Link repo for continuous deployment
railway link
git push origin main   # triggers automatic redeploy
```

### Useful commands

```bash
./scripts/deploy-railway.sh --logs      # stream live logs
./scripts/deploy-railway.sh --status    # show deployment status
railway variables                        # list all env vars
railway open                             # open dashboard in browser
```

### Environment variables
See [`deploy/railway.env.example`](../deploy/railway.env.example). Railway auto-injects `DATABASE_URL`, `REDIS_URL`, `PORT`.

---

## Option 4 — GCP Cloud Run ⭐ Recommended

Scales to zero (saves money overnight). Native Gemini AI integration. Best value for EdTech load patterns.

### Installation
gcloud CLI is installed automatically:

```bash
# Ubuntu (auto-installed by script):
# Adds Google Cloud apt repo + installs google-cloud-cli

# macOS (auto-installed):
brew install --cask google-cloud-sdk

# Manual: https://cloud.google.com/sdk/docs/install
```

### One-time setup

```bash
# Full guided setup: installs gcloud, authenticates, enables APIs, provisions infra
./scripts/deploy-gcp.sh --setup
```

This guides you through:
1. Creating a GCP account (free $300 credit for new accounts)
2. Creating a project: https://console.cloud.google.com/projectcreate
3. `gcloud auth login` (browser-based)
4. `gcloud auth application-default login`
5. Enabling required APIs (Cloud Run, Artifact Registry, Secret Manager, etc.)

### Configure

```bash
cp deploy/gcp.env.example .env.gcp
nano .env.gcp
```

| Variable | Required | Example |
|----------|----------|---------|
| `GCP_PROJECT_ID` | ✅ | `my-project-id` |
| `GCP_REGION` | Default `asia-south1` | Mumbai — best for India |
| `GEMINI_API_KEY` | ✅ | Stored in Secret Manager |
| `CLOUD_RUN_MIN_INSTANCES` | Default `0` | Set to `1` for no cold start |

**Recommended region for India:** `asia-south1` (Mumbai)

### Deploy

```bash
# Provision infra only (Artifact Registry + GCS + secrets)
./scripts/deploy-gcp.sh --infra-only

# Full deploy (build Docker image → push → Cloud Run)
./scripts/deploy-gcp.sh

# View status
./scripts/deploy-gcp.sh --status

# Stream logs
./scripts/deploy-gcp.sh --logs
```

### Cloud Scheduler (batch jobs)

The GCP deploy script automatically creates Cloud Scheduler jobs for all 6 agent batch pipelines:

| Job | Schedule (IST) | What it does |
|-----|----------------|--------------|
| `atlas-content-gen` | Daily 7:30am | Generate exam content |
| `scout-market-scan` | Monday 11:30am | Competitive intelligence |
| `oracle-analytics` | Every 6 hours | KPI + metrics summary |
| `herald-campaign` | Daily 1:30pm | Campaign status check |
| `mentor-engagement` | Daily 2:30pm | Student engagement nudges |
| `forge-health` | Every 30 min | System health check |

### Cost estimate (asia-south1)

| Resource | Monthly |
|----------|---------|
| Cloud Run (low traffic) | $0–5 |
| Artifact Registry | $0.50 |
| Cloud Storage | $1 |
| Cloud Scheduler (6 jobs) | $0.30 |
| **Total (dev/beta)** | **~$5–10** |
| **Total (production)** | **~$15–40** |

---

## Option 5 — AWS ECS Fargate

For enterprise deployments, compliance requirements, or multi-region needs.

### Installation

AWS CLI v2 is installed automatically:

```bash
# Linux x86 (auto-installed):
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o awscliv2.zip
unzip awscliv2.zip && sudo ./aws/install

# macOS (auto-installed):
# Downloads AWSCLIV2.pkg and installs via installer
```

### One-time setup

```bash
./scripts/deploy-aws.sh --setup
```

This guides you through:
1. Creating an AWS account: https://aws.amazon.com/free/
2. Creating an IAM user with required permissions
3. `aws configure` (Access Key ID + Secret + Region)

**Required IAM permissions:**
- AmazonECS_FullAccess
- AmazonECR_FullAccess
- AmazonRDS_FullAccess (for creating RDS)
- AmazonS3FullAccess
- AmazonSSMFullAccess
- ElasticLoadBalancingFullAccess

### Configure

```bash
cp deploy/aws.env.example .env.aws
nano .env.aws
```

| Variable | Required | Notes |
|----------|----------|-------|
| `AWS_ACCOUNT_ID` | ✅ | Find in AWS Console top-right |
| `AWS_REGION` | ✅ | `ap-south-1` = Mumbai (good for India) |
| `GEMINI_API_KEY` | ✅ | Stored in SSM Parameter Store |

### Deploy

```bash
# Provision ECR + ECS cluster + S3 + SSM secrets only
./scripts/deploy-aws.sh --infra-only

# Create RDS Postgres in AWS Console (required before full deploy)
# https://console.aws.amazon.com/rds/ → Create database → PostgreSQL 16

# Full deploy (build + push image + register task + update service)
./scripts/deploy-aws.sh

# Show ECS service status
./scripts/deploy-aws.sh --status

# View logs
aws logs tail /ecs/edugenius --follow --region $AWS_REGION

# Destroy (ECS service only — RDS/ElastiCache require manual deletion)
./scripts/deploy-aws.sh --destroy
```

### Cost estimate (ap-south-1 Mumbai)

| Resource | Monthly |
|----------|---------|
| ECS Fargate (1 task, 0.5 vCPU) | ~$15 |
| RDS db.t4g.micro (Postgres) | ~$15 |
| ElastiCache cache.t4g.micro | ~$12 |
| ALB | ~$16 |
| S3 + CloudFront | ~$5 |
| **Total (small load)** | **~$63/month** |

---

## Batch Job Runner

All deployment modes support the batch job runner for scheduled agent pipelines.

### Usage

```bash
./scripts/batch-run.sh                      # run all DUE jobs
./scripts/batch-run.sh all                  # force-run ALL jobs
./scripts/batch-run.sh atlas:content-gen    # run one job
./scripts/batch-run.sh status               # show all jobs + last status
./scripts/batch-run.sh list                 # list all registered jobs
./scripts/batch-run.sh all --dry-run        # preview without running

# With explicit env file
ENV_FILE=.env.production ./scripts/batch-run.sh oracle:analytics
```

### Registered jobs

| Job ID | Agent | Schedule | Description |
|--------|-------|----------|-------------|
| `atlas:content-gen` | Atlas | `0 2 * * *` | Batch content generation |
| `scout:market-scan` | Scout | `0 6 * * 1` | Market intelligence sweep |
| `oracle:analytics` | Oracle | `0 */6 * * *` | Analytics + KPI summary |
| `herald:campaign` | Herald | `0 8 * * *` | Marketing campaign check |
| `mentor:engagement` | Mentor | `0 9 * * *` | Student engagement nudges |
| `forge:health` | Forge | `*/30 * * * *` | System health check |

### System cron setup

```bash
# Open crontab editor
crontab -e

# Add these lines (adjust path):
0 2 * * *    /path/to/edugenius/scripts/batch-run.sh atlas:content-gen
0 */6 * * *  /path/to/edugenius/scripts/batch-run.sh oracle:analytics
0 8 * * *    /path/to/edugenius/scripts/batch-run.sh herald:campaign
0 9 * * *    /path/to/edugenius/scripts/batch-run.sh mentor:engagement
0 6 * * 1    /path/to/edugenius/scripts/batch-run.sh scout:market-scan
*/30 * * * * /path/to/edugenius/scripts/batch-run.sh forge:health
```

---

## Environment Variables Reference

Complete reference across all deployment modes:

### Backend

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `GEMINI_API_KEY` | ✅ | — | Google Gemini AI |
| `ANTHROPIC_API_KEY` | ✅ | — | Anthropic Claude |
| `DATABASE_URL` | ✅ | — | PostgreSQL connection string |
| `REDIS_URL` | Recommended | — | Redis connection string |
| `PORT` | — | `3000` | API server port |
| `NODE_ENV` | — | `development` | `development` or `production` |
| `LOG_LEVEL` | — | `info` | `debug`/`info`/`warn`/`error` |
| `SUPABASE_URL` | Cloud | — | Supabase project URL |
| `SUPABASE_ANON_KEY` | Cloud | — | Supabase anonymous key |
| `SUPABASE_SERVICE_KEY` | Cloud | — | Supabase service role key |
| `TAVILY_API_KEY` | Optional | — | Web search (Scout agent) |
| `JWT_SECRET` | Production | — | Auth token signing |
| `API_KEYS` | Optional | — | Comma-separated API key allowlist |

### Frontend (Vite — must start with `VITE_`)

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_API_URL` | — | Backend URL (defaults to same origin) |
| `VITE_SUPABASE_URL` | Cloud | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Cloud | Supabase anonymous key |
| `VITE_WOLFRAM_APP_ID` | Optional | Wolfram Alpha math engine |
| `VITE_GEMINI_API_KEY` | Optional | Client-side Gemini (fallback) |

---

## Docker Images Used

| Image | Version | Purpose |
|-------|---------|---------|
| `node:20-alpine` | 20 LTS | Backend runtime + build |
| `postgres:16-alpine` | 16 | Local PostgreSQL |
| `redis:7-alpine` | 7 | Cache + session store |
| `nginx:alpine` | Latest | Frontend static serving |

---

## Health Checks

```bash
# Backend
curl http://localhost:3000/health
# → {"status":"ok","timestamp":1234567890}

# Agent status
curl http://localhost:3000/status
# → {"status":"running","agents":[...],"uptime":...}

# Manim service (if running)
curl http://localhost:7341/health
# → {"status":"ok","version":"0.20.1"}

# Batch job status
./scripts/batch-run.sh status
```

---

## Rollback

```bash
# Local: restart from last working image
docker compose down && docker compose up -d

# Railway: rollback in dashboard → Deployments → previous deployment → Redeploy

# GCP: redeploy previous image
gcloud run deploy edugenius --image REGION-docker.pkg.dev/PROJECT/edugenius/edugenius:PREV_TAG

# AWS: update ECS service to previous task definition revision
aws ecs update-service --cluster edugenius-cluster --service edugenius-service \
  --task-definition edugenius:PREV_REVISION
```

---

## See Also

- [01-quick-start.md](./01-quick-start.md) — First-run walkthrough
- [19-deployment-options.md](./19-deployment-options.md) — Cost comparison + decision tree
- [10-configuration.md](./10-configuration.md) — Full configuration reference
- [11-multi-agent-setup.md](./11-multi-agent-setup.md) — OpenClaw agent configuration
