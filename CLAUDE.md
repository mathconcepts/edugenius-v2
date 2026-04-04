# CLAUDE.md

## Project: GATE Math

GATE Math is a focused, mobile-first exam prep app for GATE Engineering Mathematics.
This is the active project — the legacy 7-agent EduGenius system (src/index.ts, agents/) is NOT in use.

### Key Entry Points
- **Server:** `src/gate-server.ts` (NOT `src/index.ts`) — standalone GATE API on port 8080
- **Frontend:** `frontend/src/App.tsx` — 10-route React SPA
- **Deploy:** Render (auto-deploys from `main` branch) — see `render.yaml`
- **DB:** Supabase (PostgreSQL + pgvector) — migrations in `supabase/migrations/`
- **Live:** https://gate-math-api.onrender.com

### Running Locally
```bash
npm install && cd frontend && npm install && cd ..
npx tsx src/gate-server.ts        # backend on :8080
cd frontend && npm run dev        # frontend on :3000 (separate terminal)
```

### Architecture
- **3-tier verification:** RAG cache → Gemini 2.5-flash dual-solve → Wolfram Alpha
- **Auth:** Supabase Auth (Google OAuth + email/password), anonymous-first with optional upgrade
- **Roles:** student (default), teacher, admin
- **AI Tutor:** Streaming chat via SSE at POST /api/chat (Gemini 2.5-flash)
- **Social Autopilot:** Content flywheel generates social posts; admin approves at /admin
- **Content Intelligence:** Trend collection → priority scoring → smart flywheel → feedback scoring (self-improving loop)

### Important Files
- `src/api/gate-routes.ts` — Core API (topics, problems, verify, SR)
- `src/api/chat-routes.ts` — AI tutor chat (SSE streaming)
- `src/api/auth-middleware.ts` — JWT verification + role-based access
- `src/verification/tiered-orchestrator.ts` — 3-tier verification engine
- `src/jobs/content-flywheel.ts` — Auto-generate problems + social content
- `src/jobs/trend-collector.ts` — External trend collection (Reddit, Stack Exchange, YouTube, NewsAPI)
- `src/jobs/content-prioritizer.ts` — 5-signal weighted priority scoring
- `src/jobs/feedback-scorer.ts` — Blog post scoring + auto-archive
- `frontend/src/components/gate/GateLayout.tsx` — Layout with 5-tab bottom nav

### Database
6 migrations applied (001–005, 010). Key tables: pyq_questions, sr_sessions, chat_messages, user_profiles, social_content, verification_log, rag_cache, blog_posts, trend_signals, content_priorities.

### Design System
Always read DESIGN.md before making any visual or UI decisions.
All font choices, colors, spacing, and aesthetic direction are defined there.
Do not deviate without explicit user approval.
In QA mode, flag any code that doesn't match DESIGN.md.

---

## gstack

Use the `/browse` skill from gstack for all web browsing. Never use `mcp__claude-in-chrome__*` tools.

Available skills:
- `/office-hours` — YC-style brainstorming and idea validation
- `/plan-ceo-review` — CEO/founder-mode plan review
- `/plan-eng-review` — Engineering manager plan review
- `/plan-design-review` — Designer's eye plan review
- `/design-consultation` — Design system and brand guidelines
- `/review` — Pre-landing PR code review
- `/ship` — Ship workflow (test, review, PR)
- `/land-and-deploy` — Merge, deploy, and verify production
- `/canary` — Post-deploy canary monitoring
- `/benchmark` — Performance regression detection
- `/browse` — Headless browser for QA and dogfooding
- `/qa` — QA test and fix bugs
- `/qa-only` — QA report only (no fixes)
- `/design-review` — Visual QA and design polish
- `/setup-browser-cookies` — Import browser cookies for auth
- `/setup-deploy` — Configure deployment settings
- `/retro` — Weekly engineering retrospective
- `/investigate` — Systematic debugging with root cause analysis
- `/document-release` — Post-ship documentation update
- `/codex` — OpenAI Codex second opinion
- `/cso` — Security audit and threat modeling
- `/autoplan` — Auto-review pipeline (CEO + design + eng)
- `/careful` — Destructive command warnings
- `/freeze` — Restrict edits to a specific directory
- `/guard` — Full safety mode (careful + freeze)
- `/unfreeze` — Clear freeze boundary
- `/gstack-upgrade` — Upgrade gstack to latest version

If gstack skills aren't working, run `cd .claude/skills/gstack && ./setup` to build the binary and register skills.

## Skill routing

When the user's request matches an available skill, ALWAYS invoke it using the Skill
tool as your FIRST action. Do NOT answer directly, do NOT use other tools first.
The skill has specialized workflows that produce better results than ad-hoc answers.

Key routing rules:
- Product ideas, "is this worth building", brainstorming → invoke office-hours
- Bugs, errors, "why is this broken", 500 errors → invoke investigate
- Ship, deploy, push, create PR → invoke ship
- QA, test the site, find bugs → invoke qa
- Code review, check my diff → invoke review
- Update docs after shipping → invoke document-release
- Weekly retro → invoke retro
- Design system, brand → invoke design-consultation
- Visual audit, design polish → invoke design-review
- Architecture review → invoke plan-eng-review
