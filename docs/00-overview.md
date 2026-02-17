# EduGenius v2.0 — Complete Platform Documentation

## Executive Summary

EduGenius is an **autonomous AI agent platform** designed for educational technology. It combines 7 specialized AI agents with 45 sub-agents to automate the entire educational content lifecycle — from market research to content creation, tutoring, engagement, marketing, deployment, and analytics.

### Key Metrics

| Metric | Value |
|--------|-------|
| Total Lines of Code | 24,240 |
| Test Coverage Lines | 3,440 |
| Domain Agents | 7 |
| Sub-Agents | 45 |
| API Endpoints | 23 |
| Workflows | 5 |

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        API Layer (REST)                              │
│                    23 endpoints, auth, CORS                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│                        ORCHESTRATOR                                   │
│            Agent lifecycle • Event routing • Workflows                │
│                                                                       │
├───────────┬───────────┬───────────┬───────────┬───────────┬─────────┤
│           │           │           │           │           │         │
│  🔍 Scout │  📚 Atlas │  🎓 Sage  │  💪 Mentor│  📣 Herald│         │
│   Market  │  Content  │   Tutor   │  Engage   │ Marketing │         │
│  5 subs   │  7 subs   │  7 subs   │  6 subs   │  7 subs   │         │
│           │           │           │           │           │         │
├───────────┴───────────┴───────────┼───────────┴───────────┴─────────┤
│                                   │                                   │
│            ⚙️ Forge               │            📊 Oracle             │
│           Deployment              │            Analytics             │
│            7 subs                 │             6 subs               │
│                                   │                                   │
├───────────────────────────────────┴───────────────────────────────────┤
│                                                                       │
│                          EVENT BUS                                    │
│         Typed events • Priority queue • Wildcards • DAG              │
│                                                                       │
├─────────────────────────┬─────────────────────┬───────────────────────┤
│      LLM LAYER          │     DATA LAYER      │     UTILITIES         │
│  Multi-provider         │  Repositories       │  Validation           │
│  Fallback routing       │  Caching            │  Retry/Circuit        │
│  Budget tracking        │  Vector store       │  Error handling       │
└─────────────────────────┴─────────────────────┴───────────────────────┘
```

---

## Document Index

| # | Document | Description |
|---|----------|-------------|
| 00 | Overview (this) | Executive summary, architecture |
| 01 | Quick Start | Installation, running, basic usage |
| 02 | Agent Architecture | All 7 agents with sub-agents |
| 03 | LLM Abstraction | Multi-provider, routing, fallbacks |
| 04 | Event System | Event bus, channels, workflows |
| 05 | Data Layer | Repositories, caching, vectors |
| 06 | API Reference | All 23 endpoints |
| 07 | Workflows | End-to-end automated workflows |
| 08 | Testing Guide | Test structure, running tests |
| 09 | Deployment | Production deployment guide |
| 10 | Configuration | All configuration options |

---

## Technology Stack

| Layer | Technology |
|-------|------------|
| Language | TypeScript 5.3+ |
| Runtime | Node.js 18+ |
| LLM Providers | Gemini, Anthropic, OpenAI, Ollama |
| Testing | Vitest |
| Package Manager | npm |

---

## Quick Links

- **Start the platform:** `npm run dev`
- **Run tests:** `npm test`
- **Build for production:** `npm run build`
- **API documentation:** [06-api-reference.md](./06-api-reference.md)

---

## Core Concepts

### Agents
Autonomous units that perform specific functions. Each agent:
- Has a defined responsibility domain
- Contains multiple sub-agents for specialized tasks
- Operates on a heartbeat cycle
- Tracks its own budget and state
- Communicates via typed events

### Sub-Agents
Specialized workers within an agent:
- Handle specific tasks (e.g., "TrendSpotter" within Scout)
- Can be invoked by parent agent
- Share parent's budget and event context

### Events
Typed messages that flow through the system:
- Enable loose coupling between agents
- Support wildcards for cross-cutting concerns
- Have priority levels for ordering
- Include full audit trail

### Workflows
Multi-step processes that coordinate agents:
- Defined as DAGs (Directed Acyclic Graphs)
- Support parallel execution
- Include compensation (rollback) logic
- Can be triggered by events or manually

---

## Agent Summary

| Agent | Role | Sub-Agents | Heartbeat |
|-------|------|------------|-----------|
| **Scout** | Market Intelligence | 5 | 4 hours |
| **Atlas** | Content Engine | 7 | 30 min |
| **Sage** | AI Tutoring | 7 | 5 min |
| **Mentor** | Student Engagement | 6 | 2 hours |
| **Herald** | Marketing Automation | 7 | 2 hours |
| **Forge** | Deployment & CI/CD | 7 | 5 min |
| **Oracle** | Analytics & Insights | 6 | 5 min |

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 2.0.0 | 2026-02-17 | Full platform implementation |
| 1.0.0 | 2026-02-15 | Initial architecture design |
