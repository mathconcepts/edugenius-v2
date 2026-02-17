# EduGenius Multi-Agent Setup

This document describes the multi-agent architecture for EduGenius v2.0 integrated with OpenClaw and MissionControlHQ.

## Overview

EduGenius uses a squad of 8 AI agents, each with specific responsibilities:

| Agent | Role | Heartbeat | Model |
|-------|------|-----------|-------|
| **Jarvis** (main) | Lead Agent / Chief of Staff | 1h | claude-opus-4-5 |
| **Scout** 🔍 | Market Intelligence & Research | 4h | claude-sonnet-4-20250514 |
| **Atlas** 📚 | Content Engine (Content Factory) | 30m | claude-sonnet-4-20250514 |
| **Sage** 🧙 | AI Tutor (Socratic learning) | 15m | claude-sonnet-4-20250514 |
| **Mentor** 💪 | Engagement & Motivation | 2h | claude-sonnet-4-20250514 |
| **Herald** 📣 | Marketing & Communications | 2h | claude-sonnet-4-20250514 |
| **Forge** 🔨 | Deployment & Infrastructure | 15m | claude-sonnet-4-20250514 |
| **Oracle** 📊 | Analytics & Insights | 15m | claude-sonnet-4-20250514 |

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         OpenClaw Gateway                         │
│                                                                  │
│  ┌─────────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐           │
│  │   Jarvis    │ │  Scout  │ │  Atlas  │ │  Sage   │           │
│  │   (main)    │ │   🔍    │ │   📚    │ │   🧙    │           │
│  │   1h beat   │ │  4h     │ │  30m    │ │  15m    │           │
│  └─────────────┘ └─────────┘ └─────────┘ └─────────┘           │
│                                                                  │
│  ┌─────────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐           │
│  │   Mentor    │ │  Herald │ │  Forge  │ │ Oracle  │           │
│  │     💪      │ │   📣    │ │   🔨    │ │   📊    │           │
│  │    2h       │ │   2h    │ │  15m    │ │  15m    │           │
│  └─────────────┘ └─────────┘ └─────────┘ └─────────┘           │
│                                                                  │
│                    ▼ MissionControlHQ ▼                          │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ Tasks │ Documents │ Squad Chat │ Activity Log │ Supermemory│ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

## Directory Structure

```
~/clawd/
├── agents/
│   ├── scout/
│   │   ├── SOUL.md        # Agent identity & personality
│   │   ├── MEMORY.md      # Long-term memory
│   │   ├── AGENTS.md      # Operating instructions
│   │   └── HEARTBEAT.md   # Heartbeat checklist
│   ├── atlas/
│   │   └── ...
│   ├── sage/
│   │   └── ...
│   ├── mentor/
│   │   └── ...
│   ├── herald/
│   │   └── ...
│   ├── forge/
│   │   └── ...
│   └── oracle/
│       └── ...
├── context/
│   ├── COMPANY.md         # Business overview
│   ├── VOICE.md           # Brand tone
│   ├── CONTACTS.md        # Key people
│   ├── GLOSSARY.md        # Company terms
│   └── SQUAD.md           # Team roster
└── edugenius/             # EduGenius codebase
    └── ...
```

## OpenClaw Configuration

Each agent is configured in `~/.openclaw/openclaw.json`:

```json
{
  "agents": {
    "list": [
      {
        "id": "scout",
        "name": "Scout",
        "workspace": "/home/sprite/clawd/agents/scout",
        "agentDir": "/home/sprite/.openclaw/agents/scout/agent",
        "model": "anthropic/claude-sonnet-4-20250514",
        "heartbeat": {
          "every": "4h"
        }
      }
      // ... other agents
    ]
  }
}
```

## MissionControlHQ Integration

All agents are registered in MissionControlHQ with `openclawAgentId` matching their OpenClaw agent ID:

| Agent | MissionControlHQ ID | OpenClaw Agent ID |
|-------|---------------------|-------------------|
| Jarvis | (auto) | main |
| Scout | (auto) | scout |
| Atlas | (auto) | atlas |
| Sage | (auto) | sage |
| Mentor | (auto) | mentor |
| Herald | (auto) | herald |
| Forge | (auto) | forge |
| Oracle | (auto) | oracle |

## Heartbeat Protocol

Each agent follows a heartbeat checklist on wake:

1. **Check MissionControlHQ** — `missioncontrolhq_attention()` for @mentions and tasks
2. **Domain-specific work** — Each agent performs their specialized duties
3. **Collaboration** — @mention other agents as needed
4. **Update memory** — Log progress in MEMORY.md
5. **Report** — If nothing needs attention, reply `HEARTBEAT_OK`

## Agent Collaboration

Agents communicate through:

1. **Task Comments** — Primary collaboration mechanism
2. **@Mentions** — Direct notifications to specific agents
3. **Squad Chat** — Team-wide announcements (use sparingly)
4. **Supermemory** — Shared knowledge base

### Data Flow

```
Scout (market intel) → Atlas (content gaps)
                     → Herald (competitive positioning)
                     → Oracle (market benchmarks)

Atlas (content) → Sage (tutoring material)
                → Herald (marketing content)

Sage (learning data) → Oracle (learning outcomes)
                     → Mentor (engagement signals)

Mentor (engagement) → Herald (notification campaigns)
                    → Oracle (engagement metrics)

Herald (campaigns) → Oracle (campaign performance)

Forge (deployments) → Oracle (infrastructure metrics)

Oracle (insights) → All agents (actionable recommendations)
```

## Commands

### List agents
```bash
openclaw agents list
```

### Check heartbeat status
```bash
openclaw system heartbeat last
```

### Manually trigger agent heartbeat
```bash
openclaw system event --text "Check for work" --mode now
```

## Troubleshooting

### Agent not responding
1. Check agent workspace exists: `ls ~/clawd/agents/<agent>/`
2. Verify config: `openclaw agents list`
3. Check logs: `tail -f /tmp/openclaw/openclaw-*.log`

### Heartbeat not firing
1. Check heartbeat interval in config
2. Verify active hours (if configured)
3. Check rate limits on model provider

### Agent identity mismatch
1. Ensure `openclawAgentId` in MissionControlHQ matches OpenClaw `agents.list[].id`
2. Agent auto-detection requires registration via `missioncontrolhq_agents_create()`

## Related Documentation

- [Agent Architecture](./02-agent-architecture.md)
- [EduGenius Overview](./00-overview.md)
- [OpenClaw Multi-Agent Docs](https://docs.openclaw.ai/concepts/multi-agent)
