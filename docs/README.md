# EduGenius Documentation

**Version:** 2.0.0  
**Last Updated:** 2026-02-17

---

## Documentation Index

| # | Document | Description | Size |
|---|----------|-------------|------|
| 00 | [Overview](./00-overview.md) | Executive summary, architecture diagram | 5 KB |
| 01 | [Quick Start](./01-quick-start.md) | Installation, running, first actions | 4 KB |
| 02 | [Agent Architecture](./02-agent-architecture.md) | All 7 agents with 45 sub-agents | 13 KB |
| 03 | [LLM Abstraction](./03-llm-abstraction.md) | Multi-provider, routing, fallbacks | 9 KB |
| 04 | [Event System](./04-event-system.md) | Event bus, channels, workflows | 11 KB |
| 05 | [Data Layer](./05-data-layer.md) | Repositories, caching, vectors | 11 KB |
| 06 | [API Reference](./06-api-reference.md) | All 23 REST endpoints | 11 KB |
| 07 | [Workflows](./07-workflows.md) | End-to-end automated workflows | 11 KB |
| 08 | [Testing Guide](./08-testing-guide.md) | Test structure, running tests | 11 KB |
| 09 | [Deployment](./09-deployment.md) | Production deployment guide | 9 KB |
| 10 | [Configuration](./10-configuration.md) | All configuration options | 10 KB |
| 11 | [Multi-Agent Setup](./11-multi-agent-setup.md) | OpenClaw + MissionControlHQ integration | 6 KB |

**Total Documentation:** ~111 KB

---

## Quick Links

### Getting Started
- [Installation](./01-quick-start.md#installation)
- [Running the Platform](./01-quick-start.md#running-the-platform)
- [Your First Actions](./01-quick-start.md#your-first-actions)

### Agents
- [Scout (Market Intelligence)](./02-agent-architecture.md#scout-agent--market-intelligence)
- [Atlas (Content Engine)](./02-agent-architecture.md#atlas-agent--content-engine)
- [Sage (AI Tutor)](./02-agent-architecture.md#sage-agent--ai-tutor)
- [Mentor (Engagement)](./02-agent-architecture.md#mentor-agent--student-engagement)
- [Herald (Marketing)](./02-agent-architecture.md#herald-agent--marketing-automation)
- [Forge (Deployment)](./02-agent-architecture.md#forge-agent--deployment--infrastructure)
- [Oracle (Analytics)](./02-agent-architecture.md#oracle-agent--analytics--insights)

### API
- [Health & Status](./06-api-reference.md#health--status)
- [Tutoring](./06-api-reference.md#tutoring-sage)
- [Content](./06-api-reference.md#content-atlas)
- [Analytics](./06-api-reference.md#analytics-oracle)

### Operations
- [Docker Deployment](./09-deployment.md#docker-deployment)
- [Kubernetes Deployment](./09-deployment.md#kubernetes-deployment)
- [Monitoring](./09-deployment.md#health-monitoring)

---

## Platform Statistics

| Metric | Value |
|--------|-------|
| **Lines of Code** | 24,240 |
| **Test Lines** | 3,440 |
| **Domain Agents** | 7 |
| **Sub-Agents** | 45 |
| **API Endpoints** | 23 |
| **Workflows** | 5 |
| **Documentation** | 105 KB |

---

## Architecture at a Glance

```
┌─────────────────────────────────────────────────────────────────┐
│                        API Layer (REST)                          │
├─────────────────────────────────────────────────────────────────┤
│                        ORCHESTRATOR                              │
├───────┬───────┬───────┬───────┬───────┬───────┬───────┬────────┤
│ Scout │ Atlas │ Sage  │Mentor │Herald │ Forge │Oracle │        │
│  (5)  │  (7)  │  (7)  │  (6)  │  (7)  │  (7)  │  (6)  │        │
├───────┴───────┴───────┴───────┴───────┴───────┴───────┴────────┤
│                         EVENT BUS                                │
├─────────────────────┬─────────────────┬────────────────────────┤
│     LLM LAYER       │   DATA LAYER    │      UTILITIES         │
│  (Multi-provider)   │ (Cache/Vector)  │  (Validation/Retry)    │
└─────────────────────┴─────────────────┴────────────────────────┘
```

---

## Version History

| Version | Date | Highlights |
|---------|------|------------|
| **2.0.0** | 2026-02-17 | Full platform implementation, 7 agents, 45 sub-agents, API, tests |
| 1.0.0 | 2026-02-15 | Initial architecture design and documentation |

---

## Support

- **GitHub Issues:** Report bugs and feature requests
- **Documentation:** You're reading it!
- **API Reference:** [06-api-reference.md](./06-api-reference.md)

---

*EduGenius — Autonomous AI Agent Platform for Education*
