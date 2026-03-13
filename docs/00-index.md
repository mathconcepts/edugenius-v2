# EduGenius v2.0 — Documentation Index

> **Last updated:** 2026-03-13  
> **Total docs:** 26 files + 1 guide + infra/  

This is the master index of all documentation in the `docs/` directory, organised hierarchically.

---

## 🏗️ Foundation

| # | File | Contents |
|---|------|----------|
| 00 | `00-overview.md` | Product overview, mission, agent roster |
| 01 | `01-quick-start.md` | 5-minute local setup guide |
| 02 | `02-agent-architecture.md` | All 7 agents, roles, signal wiring |
| 03 | `03-llm-abstraction.md` | LLM service layer, model fallback chain |
| 04 | `04-event-system.md` | Typed signal bus, event catalogue |
| 05 | `05-data-layer.md` | localStorage schema, IndexedDB, Supabase |

---

## 🔌 Integration & API

| # | File | Contents |
|---|------|----------|
| 06 | `06-api-reference.md` | All service APIs, function signatures |
| 07 | `07-workflows.md` | Multi-step agent workflow diagrams |
| 10 | `10-configuration.md` | All env vars, connection keys, feature flags |
| — | `CEO-INTEGRATIONS-GUIDE.md` | CEO-facing guide to all API connections |

---

## 🚀 Deployment & Infrastructure

| # | File | Contents |
|---|------|----------|
| 09 | `09-deployment.md` | Deployment overview + strategies |
| 12 | `12-go-live-checklist.md` | Pre-launch checklist |
| 13 | `13-deployment-modes.md` | Local / Hybrid / PaaS / AWS / GCP modes |
| 19 | `19-deployment-options.md` | Deployment options comparison matrix |
| — | `infra/` | Infrastructure configuration files |

---

## 🎓 Feature Guides

| # | File | Contents |
|---|------|----------|
| 11 | `11-multi-agent-setup.md` | Running multiple agents simultaneously |
| 12 | `12-content-delivery.md` | Content delivery pipeline, sequencing |
| 14 | `14-exam-configuration.md` | Per-exam setup: Wolfram, Telegram, Pinecone |
| 15 | `15-frontend-preview.md` | Frontend routes, role views, UI overview |
| 16 | `16-website-portal-architecture.md` | Public website + app portal architecture |

---

## 🧭 Master Design & Audits

| # | File | Contents |
|---|------|----------|
| 17 | `17-master-design-documentation.md` | Complete system design, data flows |
| 18 | `18-agent-connection-map.md` | Bidirectional signal reference for all 8 agents (updated 2026-03-11: Prism + FUNNEL_INSIGHT + inbox processors) |
| 19 | `19-audit-report.md` | Full dual-direction audit (2026-03-10) — findings + fixes |
| 20 | `20-content-system.md` | Content generation & delivery system architecture (2026-03-10; updated 2026-03-13: two-layer architecture, new services, new CEO pages) |
| 21 | `21-course-summary-outline.md` | Pre-approval hierarchical course outline — data model, API, UI, Atlas integration (2026-03-11) |
| 22 | `22-help-manual.md` | **Complete help manual** — scratch-to-deploy all options, every agent + sub-agent, all connections, full student journey to course content (updated 2026-03-13: content personalization + course playbook) |
| 23 | `23-two-layer-content-architecture.md` | Mandatory + personalized two-layer content system — 16 SlotIds, 18 ContentModules, 9 resolution scenarios, layer-aware generation pipeline, ContentLayerService orchestration (2026-03-13) |
| 24 | `24-course-playbook.md` | Course Playbook — universal knowledge graph, 10-section schema, agent ownership map, progressive update hooks, CEO page guide, localStorage schema, Supabase migration path, 10 seeded GATE EM subtopics, full API reference (2026-03-13) |
| 25 | `25-course-material-generator.md` | Course Material Generator — 8 templates, 34 personalization variables (5-dimension table), free-form request parsing, generateCourseMaterial() flow, autoPersonalize(), CourseMaterialStudio CEO + student modes, Sage integration (2026-03-13) |

---

## 🧪 Testing

| # | File | Contents |
|---|------|----------|
| 08 | `08-testing-guide.md` | Test setup, unit + integration test patterns |

---

## Notes

- `00-overview.md` was previously the closest to an index — this file supersedes it as master index
- `12-content-delivery.md` and `12-go-live-checklist.md` share the `12-` prefix (renaming deferred)
- `19-deployment-options.md` and `19-audit-report.md` share the `19-` prefix (audit report added 2026-03-10)
- `infra/` contains infrastructure-specific configs (docker-compose, nginx, etc.)
