# EduGenius v2.0

**AI-powered EdTech platform — personalized exam tutoring at scale.**

Adaptive learning for GATE, CAT, JEE, NEET and more. Multi-agent backend (Scout · Atlas · Sage · Mentor · Herald · Forge · Oracle) + React frontend + Wolfram math engine.

🌐 **Live:** https://edugenius-ui.netlify.app  
📦 **Repo:** https://github.com/mathconcepts/edugenius-v2  
🗄️ **DB:** Supabase (pgvector RAG + auth)

---

## ⚡ 60-Second Setup

```bash
git clone https://github.com/mathconcepts/edugenius-v2.git
cd edugenius-v2

# 1. Check and install all dependencies (with prompts)
./scripts/check-deps.sh --install

# 2. Copy env template and add your API keys
cp deploy/local.env.example .env.local
nano .env.local          # add GEMINI_API_KEY at minimum

# 3. Launch locally
./scripts/deploy-local.sh
```

Frontend opens at **http://localhost:80** · API at **http://localhost:3000**

---

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                    EduGenius Platform                        │
├──────────────────────────────────────────────────────────────┤
│  React Frontend (Vite)   ←→   Node.js Backend (Express)      │
│  TailwindCSS + Zustand        TypeScript ESM + pg            │
│  KaTeX · Recharts · Framer    Supabase · Redis               │
├──────────────────────────────────────────────────────────────┤
│                     7 AI Agents                              │
│  Scout    Atlas    Sage     Mentor  Herald  Forge   Oracle   │
│  Market   Content  Tutor    Engage  Market  DevOps  Analytics│
├──────────────────────────────────────────────────────────────┤
│           Knowledge Layer                                    │
│  Wolfram Alpha · Gemini RAG · Static PYQs · Supabase pgvec  │
├──────────────────────────────────────────────────────────────┤
│  Manim Visualisation (Python/FastAPI · port 7341)            │
└──────────────────────────────────────────────────────────────┘
```

---

## Deployment Options

| Option | Command | Cost/month | Best For |
|--------|---------|-----------|----------|
| **Local** (Docker) | `./scripts/deploy-local.sh` | ~$0 | Dev / testing |
| **Hybrid** (Supabase) | `./scripts/deploy-hybrid.sh` | ~$0 | ✅ Current setup |
| **Railway PaaS** | `./scripts/deploy-railway.sh` | $20–60 | Launch |
| **GCP Cloud Run** | `./scripts/deploy-gcp.sh` | $15–40 | Scale (recommended) |
| **AWS ECS Fargate** | `./scripts/deploy-aws.sh` | $50–80 | Enterprise |

Each script **auto-installs** its required CLIs and guides you through credentials.

> See [`docs/19-deployment-options.md`](docs/19-deployment-options.md) for full decision guide.

---

## Dependency Check

```bash
# Audit all 7 layers — no changes made
./scripts/check-deps.sh

# Audit + install missing (asks before each)
./scripts/check-deps.sh --install

# Install everything silently
./scripts/check-deps.sh --install-all

# Check only one layer
./scripts/check-deps.sh --layer python   # system|node|frontend|python|creds|cloud|docker
```

**Layers checked:**
- System: Node 20, Docker, Git, curl, Python 3, pip
- Backend npm: all 11 packages + TypeScript build
- Frontend npm: React, Vite, Supabase, KaTeX, Tailwind, Recharts…
- Python/Manim: FastAPI, manim, numpy, ffmpeg, LaTeX, cairo
- Credentials: Gemini, Anthropic, Supabase, Wolfram, Tavily
- Cloud CLIs: AWS (+ auth), gcloud (+ auth), Railway (+ login)
- Docker images: postgres:16, redis:7, node:20

---

## Batch Jobs

Agent tasks run on a schedule via `batch-run.sh`:

```bash
./scripts/batch-run.sh                        # run all DUE jobs
./scripts/batch-run.sh all                    # run ALL jobs now
./scripts/batch-run.sh atlas:content-gen      # run one specific job
./scripts/batch-run.sh status                 # show all job statuses
./scripts/batch-run.sh atlas:content-gen --dry-run
```

**Built-in jobs:**

| Job | Agent | Default Schedule |
|-----|-------|-----------------|
| `atlas:content-gen` | Atlas | Daily 2am |
| `scout:market-scan` | Scout | Monday 6am |
| `oracle:analytics` | Oracle | Every 6 hours |
| `herald:campaign` | Herald | Daily 8am |
| `mentor:engagement` | Mentor | Daily 9am |
| `forge:health` | Forge | Every 30 min |

---

## Project Structure

```
edugenius/
├── src/                    # Backend TypeScript source
│   ├── agents/             # 7 AI domain agents
│   ├── api/                # REST API (Express)
│   ├── autonomy/           # BatchRunner + self-improvement
│   ├── deployment/         # DeploymentManager + options registry
│   ├── llm/                # LLM abstraction (Gemini, Anthropic)
│   ├── orchestrator/       # Agent coordinator
│   ├── workflows/          # End-to-end workflows
│   └── index.ts
├── frontend/               # React + Vite frontend
│   └── src/
│       ├── components/     # UI components
│       ├── pages/          # Route pages (CEO, Student, Teacher...)
│       ├── services/       # API clients, LLM, knowledge router
│       ├── stores/         # Zustand state
│       └── types/
├── manim-service/          # Python FastAPI — math animation renderer
│   ├── main.py             # FastAPI app (port 7341)
│   └── start.sh
├── agents/                 # Agent workspace files (SOUL.md etc.)
├── scripts/                # Deploy + maintenance scripts
│   ├── check-deps.sh       # Dependency audit + install
│   ├── deploy-local.sh     # Docker Compose local
│   ├── deploy-hybrid.sh    # Local + Supabase
│   ├── deploy-railway.sh   # Railway PaaS
│   ├── deploy-aws.sh       # AWS ECS Fargate
│   ├── deploy-gcp.sh       # GCP Cloud Run
│   ├── batch-run.sh        # Agent batch job runner
│   └── _install_common.sh  # Shared OS-aware installer library
├── deploy/                 # Environment templates
│   ├── local.env.example
│   ├── hybrid.env.example
│   ├── railway.env.example
│   ├── aws.env.example
│   └── gcp.env.example
├── supabase/               # DB migrations + seeds
│   ├── migrations/         # pgvector RAG schema
│   └── seeds/              # GATE EM + CAT PYQs
├── docs/                   # Full documentation (20 docs)
├── Dockerfile
├── docker-compose.yml
└── railway.json
```

---

## Key API Endpoints

```bash
GET  /health                    # System health
GET  /status                    # Agent status
POST /tutoring/sessions         # Start a tutoring session
POST /tutoring/sessions/:id/ask # Ask a question
GET  /analytics/report          # Analytics report
POST /api/batch/:agent/:job     # Trigger batch job (cloud schedulers)
```

---

## API Keys Required

| Key | Where to Get | Required? |
|-----|-------------|-----------|
| `GEMINI_API_KEY` | [aistudio.google.com](https://aistudio.google.com/app/apikey) | ✅ Yes |
| `ANTHROPIC_API_KEY` | [console.anthropic.com](https://console.anthropic.com/) | ✅ Yes |
| `SUPABASE_URL` + keys | [supabase.com/dashboard](https://supabase.com/dashboard) | For cloud DB |
| `VITE_WOLFRAM_APP_ID` | [developer.wolframalpha.com](https://developer.wolframalpha.com/) | For math engine |
| `TAVILY_API_KEY` | [tavily.com](https://tavily.com/) | For Scout search |

---

## Development

```bash
# Backend dev (hot reload)
npm run dev

# Frontend dev (Vite HMR)
cd frontend && npm run dev

# Manim service (Python)
cd manim-service && ./start.sh

# Type check
npm run typecheck

# Tests
npm test
npm run test:coverage
```

---

## Documentation

| Doc | Description |
|-----|-------------|
| [01-quick-start.md](docs/01-quick-start.md) | Installation + first run |
| [02-agent-architecture.md](docs/02-agent-architecture.md) | 7-agent system design |
| [09-deployment.md](docs/09-deployment.md) | Deployment reference |
| [19-deployment-options.md](docs/19-deployment-options.md) | Deploy options + cost guide |
| [11-multi-agent-setup.md](docs/11-multi-agent-setup.md) | OpenClaw multi-agent config |
| [17-master-design-documentation.md](docs/17-master-design-documentation.md) | Full system specs (1500+ lines) |
| [CEO-INTEGRATIONS-GUIDE.md](docs/CEO-INTEGRATIONS-GUIDE.md) | CEO portal integrations |

---

## Current Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 · Vite 5 · TailwindCSS 3 · Zustand · Framer Motion |
| Backend | Node.js 20 · TypeScript 5 · Express 5 · ESM |
| Database | Supabase (PostgreSQL 16 + pgvector) |
| Cache | Redis 7 |
| AI | Google Gemini · Anthropic Claude · Wolfram Alpha |
| Visualisation | Manim 0.20 · FastAPI · ffmpeg |
| Auth | Supabase Auth (OTP + Google) |
| Hosting | Netlify (frontend) · local/Railway/GCP (backend) |

---

*EduGenius v2.0 — Built with OpenClaw multi-agent framework*
