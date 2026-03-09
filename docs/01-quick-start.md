# Quick Start Guide

Get EduGenius v2.0 running in under 10 minutes.

---

## Prerequisites

Before you begin, you need at minimum:

- **Git** — to clone the repo
- **A terminal** — bash/zsh (macOS, Linux) or WSL2 (Windows)
- **API key** — [Google Gemini](https://aistudio.google.com/app/apikey) (free)

Everything else (Node.js, Docker, Python, etc.) can be installed automatically by the setup script.

---

## Step 1 — Clone the Repo

```bash
git clone https://github.com/mathconcepts/edugenius-v2.git
cd edugenius-v2
```

---

## Step 2 — Check Dependencies

Run the dependency audit. It scans all 7 layers of the stack and tells you exactly what's missing:

```bash
./scripts/check-deps.sh
```

**Example output:**
```
✅ Node.js          v22.20.0
✅ npm              v11.10.0
❌ Docker           not installed
✅ Python 3         v3.13.3
✅ pip              v26.0.1
✅ node_modules     178 packages
✅ Python: manim    0.20.1
❌ Credential: GEMINI_API_KEY   → https://aistudio.google.com/app/apikey
⚠️  Supabase credentials         → needed for cloud mode

Missing: 2 required  |  Warnings: 3 optional
```

### Install missing deps automatically

```bash
# Asks before each install (recommended)
./scripts/check-deps.sh --install

# Installs everything without prompting
./scripts/check-deps.sh --install-all

# Check only one layer
./scripts/check-deps.sh --layer system    # system|node|frontend|python|creds|cloud|docker
```

The installer is OS-aware — it uses `apt` on Ubuntu/Debian, `dnf` on Fedora, `brew` on macOS.

---

## Step 3 — Configure Environment

Choose the deployment mode that fits your situation, copy the matching template:

| Mode | When to use | Template |
|------|-------------|----------|
| **Local** | Dev/testing, offline | `deploy/local.env.example` |
| **Hybrid** | Early users, Supabase DB | `deploy/hybrid.env.example` |
| **Railway** | Public launch | `deploy/railway.env.example` |
| **GCP** | Scale (recommended) | `deploy/gcp.env.example` |
| **AWS** | Enterprise | `deploy/aws.env.example` |

```bash
# Example: local mode
cp deploy/local.env.example .env.local
nano .env.local
```

### Minimum required variables

```bash
# Get free key at: https://aistudio.google.com/app/apikey
GEMINI_API_KEY=AIza...

# Get at: https://console.anthropic.com/
ANTHROPIC_API_KEY=sk-ant-...
```

### Optional but recommended

```bash
# Supabase (for persistent DB + vector search)
# Get from: https://supabase.com/dashboard → Settings → API
SUPABASE_URL=https://tjcrhdavxkjjasfnrxtw.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_KEY=eyJ...

# Wolfram Alpha (activates math computation engine)
# Get free key at: https://developer.wolframalpha.com/
VITE_WOLFRAM_APP_ID=XXXXX-XXXXXXXXXX

# Tavily (web search for Scout agent)
# Get at: https://tavily.com/
TAVILY_API_KEY=tvly-...
```

---

## Step 4 — Launch

### Option A: Fully Local (Docker Compose)

Runs everything on your machine. Postgres + Redis + Backend + Frontend all in Docker.

```bash
./scripts/deploy-local.sh
```

- Backend: http://localhost:3000
- Frontend: http://localhost:80
- Postgres: localhost:5432
- Redis: localhost:6379

**Dev mode** (hot reload, logs attached):
```bash
./scripts/deploy-local.sh --dev
```

**Reset database:**
```bash
./scripts/deploy-local.sh --reset
```

**Stop:**
```bash
./scripts/deploy-local.sh --down
```

---

### Option B: Hybrid (Current Setup)

Local backend + Supabase cloud DB. The existing live configuration.

```bash
cp deploy/hybrid.env.example .env.hybrid
# Fill in Supabase + Gemini keys
./scripts/deploy-hybrid.sh
```

Frontend stays on Netlify: https://edugenius-ui.netlify.app

---

### Option C: Railway PaaS (Recommended for Launch)

Zero-ops cloud deploy. Railway handles Postgres + Redis automatically.

```bash
# One-time setup (installs Railway CLI, creates project)
./scripts/deploy-railway.sh --init

# Push your API keys
./scripts/deploy-railway.sh --env-push

# Deploy
./scripts/deploy-railway.sh
```

Cost: $20–60/month. Auto-deploys on every `git push`.

---

### Option D: GCP Cloud Run (Best Value at Scale)

Scales to zero overnight. Native Gemini integration.

```bash
cp deploy/gcp.env.example .env.gcp
# Fill in GCP_PROJECT_ID + GEMINI_API_KEY

# Guided setup (installs gcloud, enables APIs, provisions infra)
./scripts/deploy-gcp.sh --setup

# Deploy
./scripts/deploy-gcp.sh
```

Cost: $15–40/month. Includes Cloud Scheduler for batch jobs.

---

### Option E: AWS ECS Fargate

Enterprise-grade. Use when compliance or multi-region is required.

```bash
cp deploy/aws.env.example .env.aws
# Fill in AWS_ACCOUNT_ID + AWS_REGION

# Guided setup (installs AWS CLI, configures credentials, provisions ECR/ECS/S3)
./scripts/deploy-aws.sh --setup

# Deploy
./scripts/deploy-aws.sh
```

Cost: $50–80/month.

---

## Step 5 — Verify

```bash
# Health check
curl http://localhost:3000/health

# Expected:
# {"status":"ok","timestamp":1234567890}

# Agent status
curl http://localhost:3000/status
```

---

## Step 6 — Start the Manim Visualisation Service (Optional)

For animated math visualisations in Sage responses:

```bash
cd manim-service
./start.sh
```

Service runs on port 7341. Enable in the frontend: Settings → Manim Visualisation.

Requirements (auto-installed by `check-deps.sh --layer python`):
- Python 3.9+, pip, FastAPI, uvicorn, manim
- System: ffmpeg, texlive-latex-base, texlive-latex-extra, libcairo2

---

## Step 7 — Run Backend Tests

```bash
npm test                # run all tests
npm run test:watch      # watch mode
npm run test:coverage   # with coverage report
npm run typecheck       # TypeScript type check
```

---

## Step 8 — Run Frontend in Dev Mode

```bash
cd frontend
npm install             # if not already installed
npm run dev             # Vite dev server on http://localhost:5173
npm run build           # production build → frontend/dist/
```

---

## Batch Jobs

Agent pipelines run on schedule. Trigger manually:

```bash
# Show all jobs and their status
./scripts/batch-run.sh status

# Run all due jobs (based on cron schedule)
./scripts/batch-run.sh

# Run a specific agent's job
./scripts/batch-run.sh atlas:content-gen
./scripts/batch-run.sh scout:market-scan
./scripts/batch-run.sh oracle:analytics
./scripts/batch-run.sh forge:health
./scripts/batch-run.sh herald:campaign
./scripts/batch-run.sh mentor:engagement

# Dry run (preview, no side effects)
./scripts/batch-run.sh all --dry-run
```

**Add to system cron** (`crontab -e`):
```bash
0 2 * * *   /path/to/edugenius/scripts/batch-run.sh atlas:content-gen
0 */6 * * * /path/to/edugenius/scripts/batch-run.sh oracle:analytics
0 8 * * *   /path/to/edugenius/scripts/batch-run.sh herald:campaign
0 9 * * *   /path/to/edugenius/scripts/batch-run.sh mentor:engagement
0 6 * * 1   /path/to/edugenius/scripts/batch-run.sh scout:market-scan
*/30 * * * * /path/to/edugenius/scripts/batch-run.sh forge:health
```

---

## Common Issues

### "GEMINI_API_KEY not set"
Get a free key at https://aistudio.google.com/app/apikey and add it to your `.env.*` file.

### "Docker not running"
- **Ubuntu/Linux:** `sudo systemctl start docker`
- **macOS:** Open Docker Desktop from Applications

### "port 3000 already in use"
```bash
# Find and kill the process using the port
lsof -ti:3000 | xargs kill -9
# Or set a different port in your .env file:
PORT=3001
```

### "Cannot find module" after build
```bash
npm run build    # rebuild dist/
```

### Frontend shows blank page
```bash
cd frontend && npm install && npm run build
```

### Manim renders fail
```bash
# Check service is running
curl http://localhost:7341/health

# Install system deps
sudo apt-get install -y ffmpeg texlive-latex-base texlive-latex-extra libcairo2-dev
pip3 install manim
```

---

## Next Steps

- **[02-agent-architecture.md](./02-agent-architecture.md)** — Understand the 7-agent system
- **[06-api-reference.md](./06-api-reference.md)** — Full REST API reference
- **[19-deployment-options.md](./19-deployment-options.md)** — Deployment decision guide with costs
- **[11-multi-agent-setup.md](./11-multi-agent-setup.md)** — OpenClaw multi-agent configuration
- **[CEO-INTEGRATIONS-GUIDE.md](./CEO-INTEGRATIONS-GUIDE.md)** — Connect external tools
