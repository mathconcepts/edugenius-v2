# EduGenius v2.0 — Deployment Options Guide

> **Decision guide for Giri (CEO):** Which deployment option to pick, at which stage, and what it costs.

---

## Step 0 — Check Dependencies First

Before deploying in any mode, run the dependency audit:

```bash
# Audit only — see what's missing
./scripts/check-deps.sh

# Audit + install missing (with consent per item)
./scripts/check-deps.sh --install

# Install everything silently
./scripts/check-deps.sh --install-all
```

The script checks all 7 layers: system tools, Node backend packages, frontend packages, Python/Manim, API credentials, cloud CLIs, and Docker images. It auto-installs missing items on Ubuntu, Fedora, and macOS.

---

## TL;DR Decision Matrix

| Stage | Recommended Option | Monthly Cost | Why |
|-------|--------------------|--------------|-----|
| Local dev / testing | 🖥️ Totally Local | ~$3 (electricity) | Zero cost, fast iteration |
| Solo founder MVP | 🔀 Hybrid (Supabase) | $0–$25 | Cloud DB durability, backend on your machine |
| Public launch (< 500 users) | 🚂 PaaS (Railway) | $15–$40 | Zero ops, one command deploy |
| Growth stage (500–10k users) | 🔵 GCP Cloud Run | $10–$40 | Cheapest cloud, scales to zero |
| Enterprise / regulated | 🟠 AWS ECS Fargate | $30–$80 | Compliance, multi-region, HA |

---

## Option 1: Totally Local 🖥️

**Best for:** Development, privacy-first, home server, zero budget.

### Architecture
```
[Your machine]
├── Docker: Postgres 16      (port 5432)
├── Docker: Redis 7          (port 6379)
├── Docker: Backend (Node)   (port 3000)
└── Docker: Nginx → Frontend (port 80)
```

### Quick Start
```bash
# 1. Copy env template
cp deploy/local.env.example .env.local

# 2. Edit .env.local — add GEMINI_API_KEY
nano .env.local

# 3. Launch everything
./scripts/deploy-local.sh

# Or directly:
docker compose up -d
```

### Requirements
- Docker Engine 24+ with Compose v2
- 2GB RAM minimum, 4GB recommended
- Ports 3000, 5432, 6379 available

### Batch Jobs
Batch jobs run via system cron or `./scripts/batch-run.sh all`. Since everything is local, cron triggers work perfectly.

```bash
# Add to crontab for Atlas nightly content generation:
0 2 * * * cd /path/to/edugenius && ./scripts/batch-run.sh atlas:content-generation

# Or run all due jobs every minute:
* * * * * cd /path/to/edugenius && ./scripts/batch-run.sh all
```

---

## Option 2: Local + Cloud Hybrid 🔀

**Best for:** Solo founders who want cloud DB durability without cloud compute bills.

### Architecture
```
[Your machine]
├── Docker: Redis 7 (local)
└── Node: Backend

[Supabase Cloud]
└── Postgres (managed, free tier: 500MB)

[Cloudinary Cloud]
└── Media storage + CDN (free: 25 credits/month)
```

### Quick Start
```bash
# 1. Create Supabase project at https://app.supabase.io
# 2. Get URL + anon key + service key from Settings → API

# 3. Copy env template
cp deploy/hybrid.env.example .env.hybrid

# 4. Fill in Supabase credentials
nano .env.hybrid

# 5. Deploy
./scripts/deploy-hybrid.sh

# Dev mode (tsx watch):
./scripts/deploy-hybrid.sh --dev
```

### Cost Breakdown
| Service | Cost |
|---------|------|
| Supabase (free tier) | $0 |
| Cloudinary (free tier) | $0 |
| Redis (local Docker) | $0 |
| Backend (local machine) | ~$3–5 electricity |
| **Total** | **$3–$25/month** |

---

## Option 3: Cloud PaaS — Railway.app 🚂

**Best for:** MVP launch, zero ops, team without cloud expertise.

### Architecture
```
[Railway Cloud]
├── Service: Backend (Dockerfile)
├── Plugin: Postgres (managed)
└── Plugin: Redis (managed)

[Netlify / Railway CDN]
└── Frontend (static)
```

### Quick Start
```bash
# 1. Install Railway CLI
npm i -g @railway/cli

# 2. Login
railway login

# 3. Initialize project + plugins
./scripts/deploy-railway.sh --init

# 4. Set environment variables
cp deploy/railway.env.example .env.railway
nano .env.railway
./scripts/deploy-railway.sh --env-push

# 5. Deploy
./scripts/deploy-railway.sh

# View logs:
./scripts/deploy-railway.sh --logs
```

### Cost Breakdown
| Service | Cost |
|---------|------|
| Railway Hobby plan | $5/month base |
| Backend compute | ~$5–15/month (usage-based) |
| Postgres plugin | ~$10/month |
| Redis plugin | ~$5/month |
| **Total** | **$15–$40/month** |

### Batch Jobs on Railway
Railway doesn't have native cron yet. Use one of:
1. **Cron service in Railway** — add a second service that calls `batch-run.sh`
2. **External cron** (cron-job.org, EasyCron) that hits your batch API endpoint:
   ```
   POST https://your-railway-url.railway.app/api/batch/atlas:content-generation
   ```

---

## Option 4: AWS ECS Fargate 🟠

**Best for:** Enterprise workloads, existing AWS accounts, high-scale, compliance requirements.

### Architecture
```
[AWS — ap-south-1]
├── ECS Fargate: Backend container (0.5vCPU / 1GB RAM)
├── RDS Postgres: db.t3.micro / db.t3.small
├── ElastiCache: Redis t3.micro
├── ECR: Docker image registry
├── S3: Media / asset storage
├── CloudFront: CDN for frontend + media
├── ALB: Application load balancer
├── CloudWatch: Logs + metrics
└── SSM Parameter Store: Secrets
```

### Quick Start
```bash
# 1. Configure AWS CLI
aws configure  # Enter access key, secret, region: ap-south-1

# 2. Copy env
cp deploy/aws.env.example .env.aws
nano .env.aws  # Set AWS_ACCOUNT_ID, AWS_REGION, etc.

# 3. Provision infrastructure (ECR, S3, ECS cluster)
./scripts/deploy-aws.sh --infra-only

# 4. Create RDS + ElastiCache in AWS Console (or via CDK)
# Store connection strings in SSM:
aws ssm put-parameter \
  --name /edugenius/DATABASE_URL \
  --value "postgresql://user:pass@rds-endpoint:5432/edugenius" \
  --type SecureString

# 5. Deploy
./scripts/deploy-aws.sh

# Update after code change:
./scripts/deploy-aws.sh --deploy-only
```

### Required IAM Permissions
```json
{
  "Version": "2012-10-17",
  "Statement": [
    { "Effect": "Allow", "Action": ["ecr:*", "ecs:*", "s3:*", "ssm:*", "cloudwatch:*"], "Resource": "*" }
  ]
}
```

### Cost Breakdown (ap-south-1, ~100 DAU)
| Service | Cost |
|---------|------|
| ECS Fargate (0.5vCPU/1GB, 1 task) | ~$18/month |
| RDS db.t3.micro | ~$25/month |
| ElastiCache t3.micro | ~$15/month |
| ECR (image storage) | ~$2/month |
| S3 + CloudFront | ~$5/month |
| CloudWatch | ~$3/month |
| NAT Gateway | ~$5/month |
| **Total** | **~$70/month** |

### Batch Jobs on AWS
Use **EventBridge Scheduler** to trigger batch endpoints:
```bash
aws scheduler create-schedule \
  --name atlas-nightly \
  --schedule-expression "cron(0 2 * * ? *)" \
  --target '{"Arn":"arn:aws:lambda:...", ...}' \
  --flexible-time-window '{"Mode": "OFF"}'
```

Or use ECS Scheduled Tasks with EventBridge rules.

---

## Option 5: GCP Cloud Run 🔵

**Best for:** Startups watching cloud spend, spiky traffic, Vertex AI roadmap.

### Architecture
```
[GCP — asia-south1 (Mumbai)]
├── Cloud Run: Backend (1vCPU / 512MB, scales to 0)
├── Cloud SQL: Postgres (db-f1-micro)
├── Memorystore: Redis (optional, 1GB)
├── Artifact Registry: Docker images
├── Cloud Storage: Media assets
├── Cloud CDN: Optional CDN layer
├── Cloud Scheduler: Batch job triggers
├── Secret Manager: API keys
└── Cloud Logging: Centralized logs
```

### Quick Start
```bash
# 1. Install gcloud + authenticate
gcloud auth login
gcloud auth configure-docker asia-south1-docker.pkg.dev

# 2. Copy env
cp deploy/gcp.env.example .env.gcp
nano .env.gcp  # Set GCP_PROJECT_ID, GCP_REGION

# 3. Enable required APIs
./scripts/deploy-gcp.sh --enable-apis

# 4. Provision infrastructure (Artifact Registry, GCS)
./scripts/deploy-gcp.sh --infra-only

# 5. Create Cloud SQL instance in GCP Console:
#    Name: edugenius-db, Type: Postgres 15, Tier: db-f1-micro

# 6. Deploy
./scripts/deploy-gcp.sh

# Update after code change:
./scripts/deploy-gcp.sh
```

### Cost Breakdown (asia-south1, ~100 DAU)
| Service | Cost |
|---------|------|
| Cloud Run (1vCPU/512MB, ~100 req/day) | ~$2–5/month |
| Cloud SQL db-f1-micro | ~$10–18/month |
| Memorystore Redis 1GB (optional) | ~$35/month → use in-memory cache for MVP |
| Artifact Registry | ~$1/month |
| Cloud Storage (10GB) | ~$0.20/month |
| Cloud Scheduler (5 jobs) | $0 (free tier) |
| Cloud Logging | ~$0/month (free tier) |
| **Total (without Redis)** | **~$15–$25/month** |
| **Total (with Memorystore)** | **~$50–$60/month** |

> 💡 Tip: Skip Memorystore at early stage. Use in-process cache or Supabase as a Redis alternative.

### Batch Jobs on GCP
Cloud Scheduler is auto-configured by `deploy-gcp.sh`. Jobs call HTTP endpoints:
```
POST https://your-cloud-run-url/api/batch/atlas:content-generation
POST https://your-cloud-run-url/api/batch/scout:market-scan
POST https://your-cloud-run-url/api/batch/oracle:analytics-summary
POST https://your-cloud-run-url/api/batch/herald:campaign-check
POST https://your-cloud-run-url/api/batch/forge:health-check
```

---

## Batch Job Schedule Table

| Job ID | Agent | Schedule | Timeout | Description |
|--------|-------|----------|---------|-------------|
| `atlas:content-generation` | Atlas 📚 | `0 2 * * *` (2:00 AM daily) | 10 min | Nightly question + content generation |
| `scout:market-scan` | Scout 🔍 | `0 6 * * 1` (Mon 6:00 AM) | 15 min | Weekly competitive intelligence scan |
| `oracle:analytics-summary` | Oracle 📊 | `0 */6 * * *` (every 6h) | 5 min | Analytics aggregation + dashboard update |
| `herald:campaign-check` | Herald 📣 | `0 8 * * *` (8:00 AM daily) | 5 min | Marketing campaign health check |
| `forge:health-check` | Forge ⚙️ | `*/30 * * * *` (every 30 min) | 2 min | Infrastructure health monitoring |

### Running Batch Jobs Manually
```bash
# Run a specific job
./scripts/batch-run.sh atlas:content-generation

# Run all jobs that are currently due
./scripts/batch-run.sh all

# Dry run (no side effects)
./scripts/batch-run.sh atlas:content-generation --dry-run

# Check job status
./scripts/batch-run.sh status
```

---

## Agent Impact Matrix

Which agents run in which deployment tier, and how:

| Agent | Local | Hybrid | Railway | AWS | GCP |
|-------|-------|--------|---------|-----|-----|
| 📚 Atlas | ✅ cron | ✅ cron | ✅ external cron | ✅ EventBridge | ✅ Cloud Scheduler |
| 🔍 Scout | ✅ cron | ✅ cron | ✅ external cron | ✅ EventBridge | ✅ Cloud Scheduler |
| 📊 Oracle | ✅ cron | ✅ cron | ✅ external cron | ✅ EventBridge | ✅ Cloud Scheduler |
| 📣 Herald | ✅ cron | ✅ cron | ✅ external cron | ✅ EventBridge | ✅ Cloud Scheduler |
| ⚙️ Forge | ✅ cron | ✅ cron | ✅ external cron | ✅ EventBridge | ✅ Cloud Scheduler |
| 🧑‍🏫 Sage | ✅ real-time | ✅ real-time | ✅ real-time | ✅ real-time | ✅ real-time |
| 👨‍🎓 Mentor | ✅ real-time | ✅ real-time | ✅ real-time | ✅ real-time | ✅ real-time |

---

## Migration Path

```
Local Dev ──▶ Hybrid ──▶ Railway PaaS ──▶ GCP Cloud Run ──▶ AWS Fargate
  $0           $0-25        $15-40          $15-40              $50-80
  (dev)        (MVP)        (launch)        (growth)           (enterprise)
```

**Migration is zero-downtime for Hybrid → PaaS → GCP because:**
- Same Postgres schema across all options (Supabase / Railway / Cloud SQL / RDS are all standard Postgres)
- Same Docker image — just a different deployment target
- Same env var names — change values, not code

---

## Environment Files Reference

| File | Purpose | Copy from |
|------|---------|-----------|
| `.env.local` | Local Docker Compose | `deploy/local.env.example` |
| `.env.hybrid` | Supabase + local backend | `deploy/hybrid.env.example` |
| `.env.railway` | Railway deployment | `deploy/railway.env.example` |
| `.env.aws` | AWS ECS Fargate | `deploy/aws.env.example` |
| `.env.gcp` | GCP Cloud Run | `deploy/gcp.env.example` |

---

## Scripts Reference

| Script | Purpose | Key flags |
|--------|---------|-----------|
| `check-deps.sh` | Dependency audit + guided install | `--install` `--install-all` `--layer X` `--json` |
| `deploy-local.sh` | Local Docker Compose | `--dev` `--reset` `--down` |
| `deploy-hybrid.sh` | Local + Supabase | `--dev` `--down` |
| `deploy-railway.sh` | Railway PaaS | `--init` `--env-push` `--logs` `--status` |
| `deploy-gcp.sh` | GCP Cloud Run | `--setup` `--enable-apis` `--infra-only` `--status` `--logs` `--destroy` |
| `deploy-aws.sh` | AWS ECS Fargate | `--setup` `--infra-only` `--deploy-only` `--status` `--destroy` |
| `batch-run.sh` | Agent batch jobs | `[job-id\|all\|status\|list]` `--dry-run` |
| `_install_common.sh` | Shared installer library | (sourced by other scripts) |

---

## Files Reference

```
scripts/
├── check-deps.sh              — Dependency audit + install (7 layers, 50+ checks)
├── deploy-local.sh            — Local Docker Compose deployment
├── deploy-hybrid.sh           — Hybrid (local backend + Supabase) deployment
├── deploy-railway.sh          — Railway PaaS deployment
├── deploy-aws.sh              — AWS ECS Fargate deployment
├── deploy-gcp.sh              — GCP Cloud Run deployment
├── batch-run.sh               — Batch pipeline runner CLI
└── _install_common.sh         — Shared OS-aware installer library

deploy/
├── local.env.example          — Local env template
├── hybrid.env.example         — Hybrid env template
├── railway.env.example        — Railway env template
├── aws.env.example            — AWS env template
└── gcp.env.example            — GCP env template

src/
├── deployment/options.ts      — Deployment config registry (5 options)
└── autonomy/batchRunner.ts    — Batch job runner engine

frontend/src/components/
└── DeploymentOptionsPanel.tsx — CEO dashboard deployment UI

railway.json                   — Zero-config Railway deployment
```

---

## See Also

- [`01-quick-start.md`](./01-quick-start.md) — Full installation walkthrough
- [`09-deployment.md`](./09-deployment.md) — Complete deployment reference
- [`11-multi-agent-setup.md`](./11-multi-agent-setup.md) — OpenClaw agent config

---

*Last updated: 2026-03-09 | Maintained by: Forge ⚙️*
